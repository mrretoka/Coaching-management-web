import { CheckCircle2, Printer, UserPlus } from 'lucide-react';
import type { ConfirmedAdmissionRecord } from '../types/admission';
import { formatCurrency } from './InstitutionalSidebar';

interface StepConfirmationSlipProps {
  record: ConfirmedAdmissionRecord;
  onRegisterAnother: () => void;
}

export function StepConfirmationSlip({
  record,
  onRegisterAnother,
}: StepConfirmationSlipProps) {
  const formattedDate = new Date(record.submittedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="print-only-container rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
      {/* Slip Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-indigo-700">
            {record.instituteName} · Session {record.academicYear}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            Admission Confirmation Slip
          </h1>
          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Application Registered Successfully</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left sm:text-right">
          <p className="text-[11px] font-medium text-slate-500">Registration ID</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
            {record.studentId}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">Date: {formattedDate}</p>
        </div>
      </div>

      {/* Student & Enrollment Details */}
      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div className="border-b border-slate-100 pb-3">
          <dt className="text-xs font-medium text-slate-500">Student Full Name</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{record.name}</dd>
        </div>

        <div className="border-b border-slate-100 pb-3">
          <dt className="text-xs font-medium text-slate-500">Father&apos;s Name</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{record.fatherName}</dd>
        </div>

        <div className="border-b border-slate-100 pb-3">
          <dt className="text-xs font-medium text-slate-500">Mobile Contact Number</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
            {record.contactNumber}
          </dd>
        </div>

        <div className="border-b border-slate-100 pb-3">
          <dt className="text-xs font-medium text-slate-500">Verified Google Email</dt>
          <dd className="mt-1 text-sm font-medium text-slate-800 break-all">{record.email}</dd>
        </div>

        <div className="border-b border-slate-100 pb-3">
          <dt className="text-xs font-medium text-slate-500">Enrolled Class</dt>
          <dd className="mt-1 text-sm font-semibold text-indigo-900">{record.className}</dd>
        </div>

        <div className="border-b border-slate-100 pb-3">
          <dt className="text-xs font-medium text-slate-500">Selected Batch</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">
            {record.batch ?? 'Standard Batch'}
          </dd>
        </div>

        {record.fullYearFee !== null && (
          <div className="border-b border-slate-100 pb-3 sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500">Full-Year Program Fee</dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
              {formatCurrency(record.fullYearFee, record.currencySymbol)}
            </dd>
          </div>
        )}
      </dl>

      {/* Official Notice */}
      <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50/70 p-4 text-sm leading-relaxed text-indigo-950">
        Admission application submitted successfully. Please contact the coaching center for batch
        timings and fee deposition.
      </div>

      {/* Actions */}
      <div className="no-print mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors whitespace-nowrap"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          <span>Print / Save as PDF</span>
        </button>

        <button
          type="button"
          onClick={onRegisterAnother}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors whitespace-nowrap"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          <span>Register Another Student</span>
        </button>
      </div>
    </div>
  );
}
