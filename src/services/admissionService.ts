import {
  addDoc,
  collection,
  collectionGroup,
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
  const candidates = [
    data.batches,
    data.batchList,
    data.batchNames,
    data.batchTimings,
    data.sections,
  ];
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
          record.enabled !== false &&
          record.deleted !== true &&
          record.isDeleted !== true &&
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
  if (
    data.isActive === false ||
    data.active === false ||
    data.enabled === false ||
    data.deleted === true ||
    data.isDeleted === true
  ) {
    return false;
  }
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

function parseClassEntry(
  id: string,
  data: DocumentData,
  fallbackIndex: number,
  preloadedSubBatches: string[] = []
): CoachingClassItem {
  const rawName =
    data.name || data.className || data.title || data.label || data.grade || data.standard || id;
  const fullYearFee = parseNumericFee(
    data.fullYearFee ??
      data.annualFee ??
      data.yearlyFee ??
      data.totalFee ??
      data.courseFee ??
      data.classFee ??
      data.fee ??
      data.fees ??
      data.tuitionFee ??
      data.amount
  );

  const inlineBatches = extractBatchesFromData(data);
  const batches = inlineBatches.length > 0 ? inlineBatches : preloadedSubBatches;

  const rawOrder =
    typeof data.order === 'number'
      ? data.order
      : typeof data.sortOrder === 'number'
        ? data.sortOrder
        : fallbackIndex;

  return {
    id,
    name: String(rawName).trim(),
    fullYearFee,
    batches,
    order: rawOrder,
  };
}

async function fetchClassesForSetup(
  setupId: string,
  setupRawData?: DocumentData
): Promise<{ classes: CoachingClassItem[]; permissionDenied: boolean }> {
  const classesPath = `coaching_setup/${setupId}/classes`;
  let classesSnap;
  try {
    classesSnap = await getDocs(collection(db, 'coaching_setup', setupId, 'classes'));
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('permission') || message.includes('insufficient')) {
      return { classes: [], permissionDenied: true };
    }
    handleFirestoreError(error, OperationType.LIST, classesPath);
  }

  const classPromises = classesSnap.docs
    .filter((docSnap) => isClassActive(docSnap.data()))
    .map(async (docSnap, index): Promise<CoachingClassItem> => {
      const data = docSnap.data();
      const inlineBatches = extractBatchesFromData(data);
      const hasInlineBatchArray =
        Array.isArray(data.batches) ||
        Array.isArray(data.batchList) ||
        Array.isArray(data.batchNames) ||
        Array.isArray(data.batchTimings) ||
        Array.isArray(data.sections);

      let subBatches: string[] = [];
      if (inlineBatches.length === 0 && !hasInlineBatchArray) {
        try {
          const subBatchesSnap = await getDocs(
            collection(db, 'coaching_setup', setupId, 'classes', docSnap.id, 'batches')
          );
          if (!subBatchesSnap.empty) {
            const subLabels = subBatchesSnap.docs
              .filter((b) => isClassActive(b.data()))
              .map((b) => {
                const bData = b.data();
                return String(bData.name || bData.batchName || bData.title || b.id).trim();
              })
              .filter(Boolean);
            subBatches = Array.from(new Set(subLabels));
          }
        } catch {
          // Subcollection optional; ignore if absent or restricted
        }
      }

      return parseClassEntry(docSnap.id, data, index, subBatches);
    });

  let classes = await Promise.all(classPromises);

  // Optional fallback: if subcollection has no classes, inspect embedded classes array on setup doc
  if (classes.length === 0 && setupRawData && Array.isArray(setupRawData.classes)) {
    classes = setupRawData.classes
      .filter((item): item is DocumentData => Boolean(item && typeof item === 'object'))
      .filter((item) => isClassActive(item))
      .map((item, idx) =>
        parseClassEntry(
          String(item.id || item.classId || item.name || item.className || `class_${idx}`),
          item,
          idx
        )
      );
  }

  classes.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return { classes, permissionDenied: false };
}

export interface SetupCatalogResult {
  setup: CoachingSetupInfo | null;
  classes: CoachingClassItem[];
  catalogPermissionDenied: boolean;
}

export async function fetchActiveSetupAndClasses(
  preferredSetupId?: string | null
): Promise<SetupCatalogResult> {
  // 1. If a specific setupId is provided in URL, load it directly
  if (preferredSetupId && preferredSetupId.trim()) {
    const cleanId = preferredSetupId.trim();
    try {
      const setupSnap = await getDoc(doc(db, 'coaching_setup', cleanId));
      const setupData = setupSnap.exists() ? setupSnap.data() : undefined;
      const setupInfo = setupSnap.exists()
        ? parseSetupDoc(setupSnap.id, setupData!)
        : {
            id: cleanId,
            name: 'Coaching Center',
            academicYear: '2026–27',
            currencySymbol: '₹',
          };
      const { classes, permissionDenied } = await fetchClassesForSetup(cleanId, setupData);
      if (permissionDenied) {
        return { setup: setupSnap.exists() ? setupInfo : null, classes: [], catalogPermissionDenied: true };
      }
      return { setup: setupInfo, classes, catalogPermissionDenied: false };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('permission') || message.includes('insufficient')) {
        return { setup: null, classes: [], catalogPermissionDenied: true };
      }
      handleFirestoreError(error, OperationType.GET, `coaching_setup/${cleanId}`);
    }
  }

  // 2. Discover setup documents in coaching_setup
  let setupDocs: { id: string; data: DocumentData }[] = [];
  try {
    const setupsSnap = await getDocs(collection(db, 'coaching_setup'));
    setupDocs = setupsSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('permission') || message.includes('insufficient')) {
      return { setup: null, classes: [], catalogPermissionDenied: true };
    }
    handleFirestoreError(error, OperationType.LIST, 'coaching_setup');
  }

  if (setupDocs.length === 0) {
    // Fallback: handle Firestore setups where subcollection docs exist without a parent coaching_setup doc
    try {
      const groupSnap = await getDocs(collectionGroup(db, 'classes'));
      const discovered = groupSnap.docs.filter((d) => isClassActive(d.data()));
      if (discovered.length > 0) {
        const firstSetupId = discovered[0].ref.parent.parent?.id;
        if (firstSetupId) {
          const matchingClasses = discovered
            .filter((d) => d.ref.parent.parent?.id === firstSetupId)
            .map((d, idx) => parseClassEntry(d.id, d.data(), idx))
            .sort((a, b) =>
              a.order !== b.order
                ? a.order - b.order
                : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
            );
          return {
            setup: {
              id: firstSetupId,
              name: 'Coaching Center',
              academicYear: '2026–27',
              currencySymbol: '₹',
            },
            classes: matchingClasses,
            catalogPermissionDenied: false,
          };
        }
      }
    } catch {
      // Ignore if collectionGroup rule is not enabled
    }
    return { setup: null, classes: [], catalogPermissionDenied: false };
  }

  // Prioritize active setups first, then fallback to others so a setup with classes is never missed
  const orderedSetups = [
    ...setupDocs.filter((d) => isSetupActive(d.data)),
    ...setupDocs.filter((d) => !isSetupActive(d.data)),
  ];

  let fallbackSetup: CoachingSetupInfo | null = null;
  let sawPermissionDenied = false;

  for (const candidate of orderedSetups) {
    const setupInfo = parseSetupDoc(candidate.id, candidate.data);
    if (!fallbackSetup) fallbackSetup = setupInfo;

    const { classes, permissionDenied } = await fetchClassesForSetup(candidate.id, candidate.data);
    if (permissionDenied) {
      sawPermissionDenied = true;
      continue;
    }
    if (classes.length > 0) {
      return { setup: setupInfo, classes, catalogPermissionDenied: false };
    }
  }

  if (sawPermissionDenied) {
    return { setup: fallbackSetup, classes: [], catalogPermissionDenied: true };
  }

  return {
    setup: fallbackSetup,
    classes: [],
    catalogPermissionDenied: false,
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
