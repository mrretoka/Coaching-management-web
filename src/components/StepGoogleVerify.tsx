import { AlertCircle, ArrowRight, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';

interface StepGoogleVerifyProps {
  signingIn: boolean;
  checkingEligibility: boolean;
  isBlocked: boolean;
  blockedEmail: string | null;
  authError: string | null;
  onSignInWithGoogle: () => void;
  onSwitchAccount: () => void;
}

export function StepGoogleVerify({
  signingIn,
  checkingEligibility,
  isBlocked,
  blockedEmail,
  authError,
  onSignInWithGoogle,
  onSwitchAccount,
}: StepGoogleVerifyProps) {
  if (checkingEligibility) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-700" aria-hidden="true" />
          <h2 className="mt-4 font-display text-lg font-semibold text-slate-900">
            Verifying Account Eligibility
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-slate-600">
            Please wait a moment while we confirm your Google profile for admission access.
          </p>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="rounded-xl border border-rose-200 bg-white p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-rose-700">
              Admission Access Restricted
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">
              Unable to Proceed with This Account
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Your Google account is currently restricted from submitting a new admission. Please
              contact the coaching center.
            </p>
            {blockedEmail && (
              <p className="mt-3 text-xs text-slate-500">
                Signed in as <span className="font-medium text-slate-800">{blockedEmail}</span>
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onSwitchAccount}
                className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors whitespace-nowrap"
              >
                Use a Different Google Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold text-indigo-700">Step 01 of 03</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-[28px]">
            Sign In with Your Google Account
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            Verify your email identity with Google before completing the student admission form.
            This helps the coaching center keep your registration linked to a verified contact
            profile.
          </p>
        </div>

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-slate-900">Verified Student Identity</p>
              <p className="mt-0.5 text-xs text-slate-600">
                Uses your active Google email automatically.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-slate-900">Instant Slip Generation</p>
              <p className="mt-0.5 text-xs text-slate-600">
                Receive your printable admission slip immediately.
              </p>
            </div>
          </div>
        </div>

        {authError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/80 p-3.5 text-sm text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{authError}</span>
          </div>
        )}

        <div className="pt-1">
          <button
            type="button"
            disabled={signingIn}
            onClick={onSignInWithGoogle}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-3 rounded-lg bg-indigo-700 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors sm:w-auto"
          >
            {signingIn ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <span className="flex h-5 w-5 items-center justify-center rounded bg-white p-0.5">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                </span>
                <span>Continue with Google</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
