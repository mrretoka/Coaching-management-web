import { useState } from 'react';
import { BookOpen, Check, GraduationCap, MapPin, Phone } from 'lucide-react';
import campusHallImg from '../assets/images/academic_campus_hall_1794716779107.jpg';
import type { CoachingClassItem, CoachingSetupInfo, PortalStep } from '../types/admission';

interface InstitutionalSidebarProps {
  setup: CoachingSetupInfo | null;
  classes: CoachingClassItem[];
  selectedClass: CoachingClassItem | null;
  currentStep: PortalStep;
  catalogLoading: boolean;
  catalogPermissionDenied: boolean;
  isSignedIn: boolean;
}

const STEPS: { id: PortalStep; number: string; title: string; subtitle: string }[] = [
  {
    id: 'verify',
    number: '01',
    title: 'Google Account Verification',
    subtitle: 'Confirm your student or parent Google profile',
  },
  {
    id: 'details',
    number: '02',
    title: 'Student & Academic Details',
    subtitle: 'Enter personal information, mobile number, and class',
  },
  {
    id: 'confirmation',
    number: '03',
    title: 'Admission Confirmation Slip',
    subtitle: 'Download or print your registration receipt',
  },
];

export function formatCurrency(amount: number, symbol: string): string {
  try {
    if (symbol === '₹' || symbol.toUpperCase() === 'INR') {
      return `₹${amount.toLocaleString('en-IN')}`;
    }
    return `${symbol}${amount.toLocaleString('en-US')}`;
  } catch {
    return `${symbol}${amount}`;
  }
}

export function InstitutionalSidebar({
  setup,
  classes,
  selectedClass,
  currentStep,
  catalogLoading,
  catalogPermissionDenied,
  isSignedIn,
}: InstitutionalSidebarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <aside className="no-print space-y-6">
      {/* Campus Banner & Institute Identity */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
          {!imageFailed ? (
            <img
              src={campusHallImg}
              alt="Bright academic coaching center study hall"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-6 text-white">
              <GraduationCap className="h-10 w-10 text-indigo-200" aria-hidden="true" />
              <p className="mt-2 font-display text-sm font-semibold tracking-tight text-indigo-50">
                {setup?.name ?? 'Coaching Center Admissions'}
              </p>
            </div>
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/15 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <p className="text-xs font-medium text-indigo-100">
              Online Admission Portal · Session {setup?.academicYear ?? '2026–27'}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-semibold leading-snug text-white">
              {setup?.name ?? 'Coaching Center'}
            </h2>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-600">
            <span className="text-emerald-700 font-semibold">Admissions Open</span>
            <span aria-hidden="true">·</span>
            <span>Self-Registration</span>
            {classes.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{classes.length} Active Classes</span>
              </>
            )}
          </div>

          {(setup?.address || setup?.contactPhone) && (
            <div className="space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
              {setup.address && (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span>{setup.address}</span>
                </p>
              )}
              {setup.contactPhone && (
                <p className="flex items-center gap-2 tabular-nums">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span>{setup.contactPhone}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step Roadmap */}
      <section
        id="admission-steps"
        aria-label="Admission progress"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h3 className="font-display text-sm font-semibold text-slate-900">
          Registration Process
        </h3>
        <ol className="mt-4 space-y-4">
          {STEPS.map((step, idx) => {
            const isComplete = idx < stepIndex;
            const isActive = idx === stepIndex;

            return (
              <li key={step.id} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-colors ${
                    isComplete
                      ? 'bg-emerald-600 text-white'
                      : isActive
                        ? 'bg-indigo-700 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : step.number}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold leading-tight ${
                      isActive ? 'text-indigo-900' : isComplete ? 'text-slate-800' : 'text-slate-500'
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.subtitle}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Dynamic Class & Fee Schedule Preview (Read-Only) */}
      <section
        id="program-overview"
        aria-label="Available classes and fees"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            {selectedClass ? 'Selected Class Summary' : 'Available Classes & Fees'}
          </h3>
          <BookOpen className="h-4 w-4 text-indigo-700" aria-hidden="true" />
        </div>

        {catalogLoading ? (
          <div className="mt-3 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        ) : catalogPermissionDenied ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            {isSignedIn
              ? 'Available classes could not be loaded right now. Please contact the coaching center to enable online portal access.'
              : 'Sign in with your Google account to view open classes, batches, and annual fee schedules.'}
          </p>
        ) : selectedClass ? (
          <dl className="mt-3 divide-y divide-slate-100 text-sm">
            <div className="flex items-center justify-between py-2">
              <dt className="text-slate-500">Class</dt>
              <dd className="font-semibold text-slate-900">{selectedClass.name}</dd>
            </div>
            {selectedClass.fullYearFee !== null && (
              <div className="flex items-center justify-between py-2">
                <dt className="text-slate-500">Full-Year Fee</dt>
                <dd className="font-mono font-semibold text-indigo-800 tabular-nums">
                  {formatCurrency(selectedClass.fullYearFee, setup?.currencySymbol ?? '₹')}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between py-2">
              <dt className="text-slate-500">Batches</dt>
              <dd className="text-right font-medium text-slate-800">
                {selectedClass.batches.length > 0
                  ? selectedClass.batches.join(', ')
                  : 'Standard Batch'}
              </dd>
            </div>
          </dl>
        ) : classes.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100 text-xs">
            {classes.slice(0, 6).map((cls) => (
              <li key={cls.id} className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium text-slate-800">{cls.name}</span>
                <span className="font-mono font-medium text-slate-600 tabular-nums">
                  {cls.fullYearFee !== null
                    ? formatCurrency(cls.fullYearFee, setup?.currencySymbol ?? '₹')
                    : 'Fee at office'}
                </span>
              </li>
            ))}
            {classes.length > 6 && (
              <li className="pt-2 text-slate-500">
                + {classes.length - 6} more classes available in the form
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Class schedules will appear once configured by the coaching center.
          </p>
        )}
      </section>

      {/* Guidelines */}
      <section
        id="guidelines"
        aria-label="Admission guidelines"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h3 className="font-display text-sm font-semibold text-slate-900">
          Before You Begin
        </h3>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
          <li>1. Use an active student or parent Google account for verification.</li>
          <li>2. Provide a valid 10-digit mobile number for batch updates.</li>
          <li>3. Fee payment and batch timing confirmation are completed at the coaching center.</li>
        </ul>
      </section>
    </aside>
  );
}
