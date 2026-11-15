export type PortalStep = 'verify' | 'details' | 'confirmation';

export interface CoachingSetupInfo {
  id: string;
  name: string;
  academicYear: string;
  address?: string;
  contactPhone?: string;
  currencySymbol: string;
}

export interface CoachingClassItem {
  id: string;
  name: string;
  fullYearFee: number | null;
  batches: string[];
  order: number;
}

export interface StudentAdmissionPayload {
  name: string;
  fatherName: string;
  contactNumber: string;
  setupId: string;
  classId: string;
  batch: string | null;
  email: string;
  googleUid: string;
  feeStatus: 0;
  dueDateLevel: 0;
  currentDueDate: null;
  firstDueDate: null;
  receipts: never[];
}

export interface ConfirmedAdmissionRecord {
  studentId: string;
  name: string;
  fatherName: string;
  contactNumber: string;
  email: string;
  setupId: string;
  instituteName: string;
  academicYear: string;
  classId: string;
  className: string;
  batch: string | null;
  fullYearFee: number | null;
  currencySymbol: string;
  submittedAt: string;
}
