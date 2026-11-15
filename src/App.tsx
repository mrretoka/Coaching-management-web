import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { InstitutionalSidebar } from './components/InstitutionalSidebar';
import { PortalHeader } from './components/PortalHeader';
import { StepAdmissionForm } from './components/StepAdmissionForm';
import { StepConfirmationSlip } from './components/StepConfirmationSlip';
import { StepGoogleVerify } from './components/StepGoogleVerify';
import { auth, googleProvider } from './firebase';
import {
  BlockedProfileError,
  checkBlockedGoogleProfile,
  fetchActiveSetupAndClasses,
  normalizeEmail,
  submitStudentAdmission,
} from './services/admissionService';
import type {
  CoachingClassItem,
  CoachingSetupInfo,
  ConfirmedAdmissionRecord,
  PortalStep,
} from './types/admission';

function getFriendlyAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in was cancelled. Please select your Google account to continue.';
  }
  if (code === 'auth/popup-blocked') {
    return 'The sign-in window was blocked by your browser. Please allow pop-ups and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection error. Please check your internet connection and try again.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'Please sign in using your standard Google account.';
  }
  return 'Unable to verify your Google account right now. Please try again.';
}

function getFriendlySubmitError(error: unknown): string {
  if (error instanceof BlockedProfileError) {
    return error.message;
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (
      !lower.includes('firebase') &&
      !lower.includes('firestore') &&
      !lower.includes('permission') &&
      !lower.includes('{') &&
      error.message.trim().length > 0 &&
      error.message.length < 160
    ) {
      return error.message;
    }
  }
  return 'Unable to submit your admission application right now. Please verify your details or contact the coaching center.';
}

export default function App() {
  const preferredSetupId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('setupId');
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [setup, setSetup] = useState<CoachingSetupInfo | null>(null);
  const [classes, setClasses] = useState<CoachingClassItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [requiresSignInForCatalog, setRequiresSignInForCatalog] = useState(false);

  const [signingIn, setSigningIn] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedRecord, setConfirmedRecord] = useState<ConfirmedAdmissionRecord | null>(null);

  const formCardRef = useRef<HTMLDivElement | null>(null);

  const loadCatalog = useCallback(async (): Promise<CoachingSetupInfo | null> => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const result = await fetchActiveSetupAndClasses(preferredSetupId);
      setSetup(result.setup);
      setClasses(result.classes);
      setRequiresSignInForCatalog(result.requiresSignInForCatalog);
      return result.setup;
    } catch {
      setCatalogError('Unable to load available classes right now. Please try again.');
      return null;
    } finally {
      setCatalogLoading(false);
    }
  }, [preferredSetupId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const verifyUserEligibility = useCallback(
    async (activeUser: User) => {
      setCheckingEligibility(true);
      setAuthError(null);

      try {
        let activeSetup = setup;
        if (!activeSetup || requiresSignInForCatalog) {
          activeSetup = await loadCatalog();
        }

        const email = normalizeEmail(activeUser.email);
        if (!email) {
          setIsBlocked(false);
          setAuthError('A verified Google email address is required to continue.');
          await signOut(auth);
          return;
        }

        if (activeSetup) {
          const blocked = await checkBlockedGoogleProfile(activeSetup.id, email, activeUser.uid);
          setIsBlocked(blocked);
        } else {
          setIsBlocked(false);
        }
      } catch {
        // Keep verification fail-safe without exposing technical details
        setIsBlocked(false);
        setAuthError('Unable to verify account eligibility right now. Please try again.');
      } finally {
        setCheckingEligibility(false);
      }
    },
    [loadCatalog, requiresSignInForCatalog, setup]
  );

  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      setAuthReady(true);
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      window.clearTimeout(fallbackTimer);
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        void verifyUserEligibility(nextUser);
      } else {
        setIsBlocked(false);
        setCheckingEligibility(false);
        setConfirmedRecord(null);
        setSubmitError(null);
      }
    });

    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [verifyUserEligibility]);

  const handleSignInWithGoogle = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(getFriendlyAuthError(error));
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOutAndSwitch = async () => {
    setAuthError(null);
    setSubmitError(null);
    setIsBlocked(false);
    setConfirmedRecord(null);
    setSelectedClassId('');
    await signOut(auth);
  };

  const handleSubmitAdmission = async (values: {
    name: string;
    fatherName: string;
    contactNumber: string;
    classId: string;
    batch: string | null;
  }) => {
    if (!setup) {
      setSubmitError('Admission configuration is not available right now. Please try again later.');
      return;
    }

    const chosenClass = classes.find((c) => c.id === values.classId);
    if (!chosenClass) {
      setSubmitError('Please select a valid class from the list.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const record = await submitStudentAdmission({
        name: values.name,
        fatherName: values.fatherName,
        contactNumber: values.contactNumber,
        setup,
        selectedClass: chosenClass,
        selectedBatch: values.batch,
      });
      setConfirmedRecord(record);
    } catch (error) {
      if (error instanceof BlockedProfileError) {
        setIsBlocked(true);
        setSubmitError(null);
        return;
      }
      setSubmitError(getFriendlySubmitError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterAnother = () => {
    setConfirmedRecord(null);
    setSelectedClassId('');
    setSubmitError(null);
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const currentStep: PortalStep = useMemo(() => {
    if (confirmedRecord && !isBlocked) return 'confirmation';
    if (user && !checkingEligibility && !isBlocked && !authError) return 'details';
    return 'verify';
  }, [authError, checkingEligibility, confirmedRecord, isBlocked, user]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const verifiedEmail = normalizeEmail(user?.email);

  return (
    <MotionConfig reducedMotion="user">
      <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <PortalHeader
          instituteName={setup?.name ?? 'Coaching Center Admissions'}
          user={user}
          onSignOut={handleSignOutAndSwitch}
          onStartAction={() => {
            formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (!user && !signingIn) {
              void handleSignInWithGoogle();
            }
          }}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            {/* Left Institutional Column (Desktop) / Context Summary (Mobile bottom or secondary) */}
            <div className="order-2 lg:order-1 lg:col-span-5">
              <InstitutionalSidebar
                setup={setup}
                classes={classes}
                selectedClass={selectedClass}
                currentStep={currentStep}
                catalogLoading={catalogLoading}
                requiresSignInForCatalog={requiresSignInForCatalog}
              />
            </div>

            {/* Primary Step-by-Step Admission Card */}
            <div ref={formCardRef} className="order-1 lg:order-2 lg:col-span-7">
              {!authReady ? (
                <div className="rounded-xl border border-slate-200 bg-white p-8">
                  <div className="space-y-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                    <div className="h-7 w-2/3 animate-pulse rounded bg-slate-100" />
                    <div className="h-24 w-full animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {currentStep === 'verify' && (
                    <motion.div
                      key="step-verify"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <StepGoogleVerify
                        signingIn={signingIn}
                        checkingEligibility={checkingEligibility}
                        isBlocked={isBlocked}
                        blockedEmail={verifiedEmail || null}
                        authError={authError}
                        onSignInWithGoogle={handleSignInWithGoogle}
                        onSwitchAccount={handleSignOutAndSwitch}
                      />
                    </motion.div>
                  )}

                  {currentStep === 'details' && (
                    <motion.div
                      key="step-details"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <StepAdmissionForm
                        verifiedEmail={verifiedEmail}
                        setup={setup}
                        classes={classes}
                        catalogLoading={catalogLoading}
                        catalogError={catalogError}
                        selectedClassId={selectedClassId}
                        onSelectClassId={setSelectedClassId}
                        onRetryCatalog={() => void loadCatalog()}
                        onSwitchAccount={handleSignOutAndSwitch}
                        onSubmit={handleSubmitAdmission}
                        submitting={submitting}
                        submitError={submitError}
                      />
                    </motion.div>
                  )}

                  {currentStep === 'confirmation' && confirmedRecord && (
                    <motion.div
                      key="step-confirmation"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <StepConfirmationSlip
                        record={confirmedRecord}
                        onRegisterAnother={handleRegisterAnother}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>
        </main>

        <footer className="no-print border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 text-xs text-slate-500 sm:px-6 lg:px-8">
            <p>
              &copy; {new Date().getFullYear()} {setup?.name ?? 'Coaching Center'} · Online Admission
              Portal
            </p>
            <p>Session {setup?.academicYear ?? '2026–27'}</p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
