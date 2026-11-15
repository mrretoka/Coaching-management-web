import type { User } from 'firebase/auth';

interface PortalHeaderProps {
  instituteName: string;
  user: User | null;
  onSignOut: () => void;
  onStartAction: () => void;
}

export function PortalHeader({
  instituteName,
  user,
  onSignOut,
  onStartAction,
}: PortalHeaderProps) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 sm:text-lg"
        >
          {instituteName}
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Portal sections"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <a
            href="#admission-steps"
            className="hover:text-indigo-700 transition-colors whitespace-nowrap shrink-0"
          >
            Admission Steps
          </a>
          <a
            href="#program-overview"
            className="hover:text-indigo-700 transition-colors whitespace-nowrap shrink-0"
          >
            Classes &amp; Fees
          </a>
          <a
            href="#guidelines"
            className="hover:text-indigo-700 transition-colors whitespace-nowrap shrink-0"
          >
            Guidelines
          </a>
        </nav>

        {/* Zone 3: Single Primary Header Action */}
        <div className="flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors whitespace-nowrap shrink-0"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartAction}
              className="min-h-[40px] rounded-lg bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors whitespace-nowrap shrink-0"
            >
              Start Admission
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
