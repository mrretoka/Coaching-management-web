import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { MOBILE_REGEX } from '../services/admissionService';
import type { CoachingClassItem, CoachingSetupInfo } from '../types/admission';
import { formatCurrency } from './InstitutionalSidebar';

interface StepAdmissionFormProps {
  verifiedEmail: string;
  setup: CoachingSetupInfo | null;
  classes: CoachingClassItem[];
  catalogLoading: boolean;
  catalogError: string | null;
  selectedClassId: string;
  onSelectClassId: (classId: string) => void;
  onRetryCatalog: () => void;
  onSwitchAccount: () => void;
  onSubmit: (values: {
    name: string;
    fatherName: string;
    contactNumber: string;
    classId: string;
    batch: string | null;
  }) => Promise<void>;
  submitting: boolean;
  submitError: string | null;
}

export function StepAdmissionForm({
  verifiedEmail,
  setup,
  classes,
  catalogLoading,
  catalogError,
  selectedClassId,
  onSelectClassId,
  onRetryCatalog,
  onSwitchAccount,
  onSubmit,
  submitting,
  submitError,
}: StepAdmissionFormProps) {
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? null;
  const hasBatches = Boolean(selectedClass && selectedClass.batches.length > 0);

  const handleClassChange = (nextClassId: string) => {
    onSelectClassId(nextClassId);
    setSelectedBatch('');
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy.classId;
      delete copy.batch;
      return copy;
    });
  };

  const handlePhoneChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 10);
    setContactNumber(digitsOnly);
    if (fieldErrors.contactNumber && MOBILE_REGEX.test(digitsOnly)) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy.contactNumber;
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedFather = fatherName.trim();

    if (trimmedName.length < 2) {
      errors.name = 'Please enter the student full name (at least 2 characters).';
    } else if (trimmedName.length > 100) {
      errors.name = 'Student name must be 100 characters or fewer.';
    }

    if (trimmedFather.length < 2) {
      errors.fatherName = "Please enter the father's full name (at least 2 characters).";
    } else if (trimmedFather.length > 100) {
      errors.fatherName = "Father's name must be 100 characters or fewer.";
    }

    if (!MOBILE_REGEX.test(contactNumber)) {
      errors.contactNumber = 'Enter a valid 10-digit mobile number (numbers only).';
    }

    if (!selectedClass) {
      errors.classId = 'Please select a class to enroll in.';
    }

    if (hasBatches && !selectedBatch.trim()) {
      errors.batch = 'Please select a preferred batch for this class.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || !selectedClass || submitting) return;

    await onSubmit({
      name: name.trim(),
      fatherName: fatherName.trim(),
      contactNumber,
      classId: selectedClass.id,
      batch: hasBatches ? selectedBatch.trim() : null,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="space-y-6">
        {/* Step Heading */}
        <div>
          <p className="text-xs font-semibold text-indigo-700">Step 02 of 03</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-[28px]">
            Student &amp; Academic Details
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Complete the student details below to submit your admission application.
          </p>
        </div>

        {/* Verified Google Account Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <div className="min-w-0 text-xs">
              <span className="text-slate-500">Verified Google Account · </span>
              <span className="font-semibold text-slate-900 break-all">{verifiedEmail}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onSwitchAccount}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline whitespace-nowrap shrink-0"
          >
            Switch account
          </button>
        </div>

        {catalogError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              <span>{catalogError}</span>
            </div>
            <button
              type="button"
              onClick={onRetryCatalog}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} noValidate className="space-y-5">
          {/* Student Full Name */}
          <div>
            <label htmlFor="student-name" className="block text-sm font-semibold text-slate-800">
              Student Full Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="student-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.name;
                    return copy;
                  });
                }
              }}
              placeholder="e.g., Aarav Sharma"
              className={`mt-1.5 block min-h-[44px] w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 ${
                fieldErrors.name
                  ? 'border-rose-400 focus:border-rose-500'
                  : 'border-slate-300 focus:border-indigo-600'
              }`}
            />
            {fieldErrors.name && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">{fieldErrors.name}</p>
            )}
          </div>

          {/* Father's Name */}
          <div>
            <label htmlFor="father-name" className="block text-sm font-semibold text-slate-800">
              Father&apos;s Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="father-name"
              name="fatherName"
              type="text"
              required
              maxLength={100}
              value={fatherName}
              onChange={(e) => {
                setFatherName(e.target.value);
                if (fieldErrors.fatherName) {
                  setFieldErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.fatherName;
                    return copy;
                  });
                }
              }}
              placeholder="e.g., Rajesh Sharma"
              className={`mt-1.5 block min-h-[44px] w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 ${
                fieldErrors.fatherName
                  ? 'border-rose-400 focus:border-rose-500'
                  : 'border-slate-300 focus:border-indigo-600'
              }`}
            />
            {fieldErrors.fatherName && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">{fieldErrors.fatherName}</p>
            )}
          </div>

          {/* 10-Digit Mobile Number (No OTP) */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="contact-number" className="block text-sm font-semibold text-slate-800">
                Mobile Contact Number <span className="text-rose-600">*</span>
              </label>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {contactNumber.length}/10 digits
              </span>
            </div>
            <input
              id="contact-number"
              name="contactNumber"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              maxLength={10}
              value={contactNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="Enter 10-digit mobile number"
              className={`mt-1.5 block min-h-[44px] w-full rounded-lg border px-3.5 py-2.5 font-mono text-sm tracking-wide text-slate-900 tabular-nums placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 ${
                fieldErrors.contactNumber
                  ? 'border-rose-400 focus:border-rose-500'
                  : 'border-slate-300 focus:border-indigo-600'
              }`}
            />
            <p className="mt-1 text-xs text-slate-500">
              Enter exactly 10 digits without spaces or country code.
            </p>
            {fieldErrors.contactNumber && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {fieldErrors.contactNumber}
              </p>
            )}
          </div>

          {/* Class Selection */}
          <div>
            <label htmlFor="class-select" className="block text-sm font-semibold text-slate-800">
              Class Selection <span className="text-rose-600">*</span>
            </label>
            <select
              id="class-select"
              name="classId"
              required
              disabled={catalogLoading || classes.length === 0}
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className={`mt-1.5 block min-h-[44px] w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
                fieldErrors.classId
                  ? 'border-rose-400 focus:border-rose-500'
                  : 'border-slate-300 focus:border-indigo-600'
              }`}
            >
              <option value="">
                {catalogLoading
                  ? 'Loading available classes...'
                  : classes.length === 0
                    ? 'No active classes available right now'
                    : 'Select a class'}
              </option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                  {cls.fullYearFee !== null
                    ? ` — ${formatCurrency(cls.fullYearFee, setup?.currencySymbol ?? '₹')} / year`
                    : ''}
                </option>
              ))}
            </select>
            {fieldErrors.classId && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">{fieldErrors.classId}</p>
            )}
          </div>

          {/* Read-only Full-Year Fee Information (strictly non-editable) */}
          {selectedClass && selectedClass.fullYearFee !== null && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200/80 bg-indigo-50/50 px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-indigo-950">Full-Year Program Fee</p>
                <p className="text-xs text-indigo-800/80">
                  Official annual fee for {selectedClass.name} (settled at center)
                </p>
              </div>
              <p className="font-mono text-base font-bold text-indigo-900 tabular-nums shrink-0">
                {formatCurrency(selectedClass.fullYearFee, setup?.currencySymbol ?? '₹')}
              </p>
            </div>
          )}

          {/* Conditional Batch Selection (Rendered ONLY if batches exist for the selected class) */}
          {hasBatches && selectedClass && (
            <div>
              <label htmlFor="batch-select" className="block text-sm font-semibold text-slate-800">
                Batch Selection <span className="text-rose-600">*</span>
              </label>
              <select
                id="batch-select"
                name="batch"
                required
                value={selectedBatch}
                onChange={(e) => {
                  setSelectedBatch(e.target.value);
                  if (fieldErrors.batch) {
                    setFieldErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.batch;
                      return copy;
                    });
                  }
                }}
                className={`mt-1.5 block min-h-[44px] w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 ${
                  fieldErrors.batch
                    ? 'border-rose-400 focus:border-rose-500'
                    : 'border-slate-300 focus:border-indigo-600'
                }`}
              >
                <option value="">Select a batch (e.g., Morning, Evening)</option>
                {selectedClass.batches.map((batchName) => (
                  <option key={batchName} value={batchName}>
                    {batchName}
                  </option>
                ))}
              </select>
              {fieldErrors.batch && (
                <p className="mt-1.5 text-xs font-medium text-rose-600">{fieldErrors.batch}</p>
              )}
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={submitting || catalogLoading || classes.length === 0 || !setup}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Submitting Admission...</span>
                </>
              ) : (
                <span>Submit Admission Application</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
