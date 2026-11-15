import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  CoachingClassItem,
  CoachingSetupInfo,
  ConfirmedAdmissionRecord,
  StudentAdmissionPayload,
} from '../types/admission';

export class BlockedProfileError extends Error {
  constructor(
    message = 'Your Google account is currently restricted from submitting a new admission. Please contact the coaching center.'
  ) {
    super(message);
    this.name = 'BlockedProfileError';
  }
}

export const MOBILE_REGEX = /^[0-9]{10}$/;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

function parseNumericFee(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return raw;
  }
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    if (cleaned.length > 0) {
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  }
  return null;
}

function extractBatchesFromData(data: DocumentData): string[] {
  const candidates = [data.batches, data.batchList, data.batchNames, data.sections];
  const collected: string[] = [];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    for (const item of candidate) {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) collected.push(trimmed);
      } else if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const isActive =
          record.isActive !== false &&
          record.active !== false &&
          String(record.status ?? '').toLowerCase() !== 'inactive';
        if (!isActive) continue;

        const label =
          typeof record.name === 'string'
            ? record.name
            : typeof record.batchName === 'string'
              ? record.batchName
              : typeof record.title === 'string'
                ? record.title
                : typeof record.label === 'string'
                  ? record.label
                  : '';
        const trimmed = label.trim();
        if (trimmed) collected.push(trimmed);
      }
    }

    if (collected.length > 0) break;
  }

  return Array.from(new Set(collected));
}

function isClassActive(data: DocumentData): boolean {
  if (data.isActive === false || data.active === false) return false;
  const status = String(data.status ?? '').toLowerCase();
  if (status === 'inactive' || status === 'archived' || status === 'disabled') {
    return false;
  }
  return true;
}

function isSetupActive(data: DocumentData): boolean {
  if (data.isActive === true || data.active === true) return true;
  const status = String(data.status ?? '').toLowerCase();
  return status === 'active';
}

function parseSetupDoc(id: string, data: DocumentData): CoachingSetupInfo {
  const rawName =
    data.coachingName ||
    data.instituteName ||
    data.centerName ||
    data.academyName ||
    data.name ||
    data.title;

  const rawYear =
    data.academicYear || data.session || data.year || data.currentSession || '2026–27';

  const rawAddress = data.address || data.location || data.branchAddress || undefined;
  const rawPhone = data.contactPhone || data.phone || data.helpline || undefined;
  const rawCurrency =
    typeof data.currencySymbol === 'string' && data.currencySymbol.trim()
      ? data.currencySymbol.trim()
      : '₹';

  return {
    id,
    name: typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'Coaching Center',
    academicYear:
      typeof rawYear === 'string' && rawYear.trim() ? rawYear.trim() : String(rawYear),
    address: typeof rawAddress === 'string' && rawAddress.trim() ? rawAddress.trim() : undefined,
    contactPhone: typeof rawPhone === 'string' && rawPhone.trim() ? rawPhone.trim() : undefined,
    currencySymbol: rawCurrency,
  };
}

export interface SetupCatalogResult {
  setup: CoachingSetupInfo | null;
  classes: CoachingClassItem[];
  requiresSignInForCatalog: boolean;
}

export async function fetchActiveSetupAndClasses(
  preferredSetupId?: string | null
): Promise<SetupCatalogResult> {
  let setup: CoachingSetupInfo | null = null;

  try {
    if (preferredSetupId && preferredSetupId.trim()) {
      const setupSnap = await getDoc(doc(db, 'coaching_setup', preferredSetupId.trim()));
      if (setupSnap.exists()) {
        setup = parseSetupDoc(setupSnap.id, setupSnap.data());
      }
    }

    if (!setup) {
      const setupsSnap = await getDocs(collection(db, 'coaching_setup'));
      if (!setupsSnap.empty) {
        const docs = setupsSnap.docs;
        const activeDoc = docs.find((d) => isSetupActive(d.data())) ?? docs[0];
        setup = parseSetupDoc(activeDoc.id, activeDoc.data());
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('permission') || message.includes('insufficient')) {
      return { setup: null, classes: [], requiresSignInForCatalog: true };
    }
    handleFirestoreError(error, OperationType.LIST, 'coaching_setup');
  }

  if (!setup) {
    return { setup: null, classes: [], requiresSignInForCatalog: false };
  }

  const classesPath = `coaching_setup/${setup.id}/classes`;
  let classesSnap;
  try {
    classesSnap = await getDocs(collection(db, 'coaching_setup', setup.id, 'classes'));
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('permission') || message.includes('insufficient')) {
      return { setup, classes: [], requiresSignInForCatalog: true };
    }
    handleFirestoreError(error, OperationType.LIST, classesPath);
  }

  const classPromises = classesSnap.docs
    .filter((docSnap) => isClassActive(docSnap.data()))
    .map(async (docSnap, index): Promise<CoachingClassItem> => {
      const data = docSnap.data();
      const rawName = data.name || data.className || data.title || docSnap.id;
      const fullYearFee = parseNumericFee(
        data.fullYearFee ??
          data.annualFee ??
          data.yearlyFee ??
          data.totalFee ??
          data.fee ??
          data.tuitionFee
      );

      let batches = extractBatchesFromData(data);

      // Fallback: inspect optional batches subcollection only when array is absent
      if (batches.length === 0) {
        try {
          const subBatchesSnap = await getDocs(
            collection(db, 'coaching_setup', setup!.id, 'classes', docSnap.id, 'batches')
          );
          if (!subBatchesSnap.empty) {
            const subLabels = subBatchesSnap.docs
              .filter((b) => isClassActive(b.data()))
              .map((b) => {
                const bData = b.data();
                return String(bData.name || bData.batchName || bData.title || b.id).trim();
              })
              .filter(Boolean);
            batches = Array.from(new Set(subLabels));
          }
        } catch {
          // Subcollection optional; ignore if absent or restricted
        }
      }

      const rawOrder =
        typeof data.order === 'number'
          ? data.order
          : typeof data.sortOrder === 'number'
            ? data.sortOrder
            : index;

      return {
        id: docSnap.id,
        name: String(rawName).trim(),
        fullYearFee,
        batches,
        order: rawOrder,
      };
    });

  const classes = await Promise.all(classPromises);
  classes.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return {
    setup,
    classes,
    requiresSignInForCatalog: false,
  };
}

function isRecordBlocked(data: DocumentData | undefined): boolean {
  if (!data) return false;
  if (data.isBlocked === false || data.blocked === false || data.active === false) {
    return false;
  }
  const status = String(data.status ?? '').toLowerCase();
  if (status === 'unblocked' || status === 'inactive' || status === 'removed') {
    return false;
  }
  return true;
}

export async function checkBlockedGoogleProfile(
  setupId: string,
  email: string,
  uid: string
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const blockedCol = collection(db, 'coaching_setup', setupId, 'blocked_profiles');
  let successfulCheckCount = 0;

  // 1. Direct document checks (keyed by UID or normalized email)
  const directIds = Array.from(new Set([uid, normalized].filter(Boolean)));
  for (const docId of directIds) {
    try {
      const snap = await getDoc(doc(blockedCol, docId));
      successfulCheckCount += 1;
      if (snap.exists() && isRecordBlocked(snap.data())) {
        return true;
      }
    } catch {
      // Continue to query checks
    }
  }

  // 2. Targeted query checks matching email or googleUid / uid fields
  const queryChecks = [
    ...(normalized ? [query(blockedCol, where('email', '==', normalized))] : []),
    ...(uid ? [query(blockedCol, where('googleUid', '==', uid))] : []),
    ...(uid ? [query(blockedCol, where('uid', '==', uid))] : []),
  ];

  for (const q of queryChecks) {
    try {
      const snap = await getDocs(q);
      successfulCheckCount += 1;
      if (!snap.empty && snap.docs.some((d) => isRecordBlocked(d.data()))) {
        return true;
      }
    } catch {
      // Existing Android rules may restrict list queries while allowing direct getDoc
    }
  }

  // If no direct or query check was permitted at all, verify via broad read fallback
  if (successfulCheckCount === 0) {
    try {
      const allSnap = await getDocs(blockedCol);
      for (const d of allSnap.docs) {
        const data = d.data();
        const docEmail = normalizeEmail(
          typeof data.email === 'string'
            ? data.email
            : typeof data.blockedEmail === 'string'
              ? data.blockedEmail
              : ''
        );
        const docUid =
          typeof data.googleUid === 'string'
            ? data.googleUid
            : typeof data.uid === 'string'
              ? data.uid
              : '';
        if (
          ((normalized && docEmail === normalized) || (uid && docUid === uid)) &&
          isRecordBlocked(data)
        ) {
          return true;
        }
      }
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.GET,
        `coaching_setup/${setupId}/blocked_profiles`
      );
    }
  }

  return false;
}

export interface SubmitAdmissionInput {
  name: string;
  fatherName: string;
  contactNumber: string;
  setup: CoachingSetupInfo;
  selectedClass: CoachingClassItem;
  selectedBatch: string | null;
}

export async function submitStudentAdmission(
  input: SubmitAdmissionInput
): Promise<ConfirmedAdmissionRecord> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('Please sign in with your Google account before submitting.');
  }

  const normalized = normalizeEmail(user.email);
  const trimmedName = input.name.trim().slice(0, 100);
  const trimmedFatherName = input.fatherName.trim().slice(0, 100);
  const cleanContact = input.contactNumber.trim();

  if (trimmedName.length < 2) {
    throw new Error('Please enter the student full name.');
  }
  if (trimmedFatherName.length < 2) {
    throw new Error("Please enter the father's full name.");
  }
  if (!MOBILE_REGEX.test(cleanContact)) {
    throw new Error('Please enter a valid 10-digit mobile number.');
  }

  const hasBatches = input.selectedClass.batches.length > 0;
  const resolvedBatch = hasBatches ? (input.selectedBatch ?? '').trim() : null;
  if (hasBatches && !resolvedBatch) {
    throw new Error('Please select a batch for the chosen class.');
  }

  // Re-verify blocked status immediately prior to creating the admission record
  const isBlocked = await checkBlockedGoogleProfile(input.setup.id, normalized, user.uid);
  if (isBlocked) {
    throw new BlockedProfileError();
  }

  const payload: StudentAdmissionPayload = {
    name: trimmedName,
    fatherName: trimmedFatherName,
    contactNumber: cleanContact,
    setupId: input.setup.id,
    classId: input.selectedClass.id,
    batch: resolvedBatch,
    email: normalized,
    googleUid: user.uid,
    feeStatus: 0,
    dueDateLevel: 0,
    currentDueDate: null,
    firstDueDate: null,
    receipts: [],
  };

  try {
    const docRef = await addDoc(collection(db, 'students'), payload);
    return {
      studentId: docRef.id,
      name: payload.name,
      fatherName: payload.fatherName,
      contactNumber: payload.contactNumber,
      email: payload.email,
      setupId: payload.setupId,
      instituteName: input.setup.name,
      academicYear: input.setup.academicYear,
      classId: payload.classId,
      className: input.selectedClass.name,
      batch: payload.batch,
      fullYearFee: input.selectedClass.fullYearFee,
      currencySymbol: input.setup.currencySymbol,
      submittedAt: new Date().toISOString(),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('permission') || msg.includes('insufficient')) {
      // Server-side rule rejection could indicate blocked profile or validation constraint
      const blockedAfterCheck = await checkBlockedGoogleProfile(
        input.setup.id,
        normalized,
        user.uid
      ).catch(() => false);
      if (blockedAfterCheck) {
        throw new BlockedProfileError();
      }
      handleFirestoreError(error, OperationType.CREATE, 'students');
    }
    throw error;
  }
}
