import { User, signOut } from 'firebase/auth';
import { Timestamp, doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Invite, UserProfile } from '../types';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Crown,
  LogOut,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { generateBio } from '../lib/gemini';
import { cn } from '../lib/utils';
import { INTERESTS } from '../constants';

type NoticeTone = 'error' | 'success' | 'info';

export default function ApplicationView({ user }: { user: User; profile: UserProfile | null }) {
  const [step, setStep] = useState(0);
  const [inviteCode, setInviteCode] = useState('');
  const [validatingInvite, setValidatingInvite] = useState(false);
  const [validatedInvite, setValidatedInvite] = useState<Invite | null>(null);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [generatedBio, setGeneratedBio] = useState('');
  const [loadingBio, setLoadingBio] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

  const handleLogout = () => signOut(auth);
  const isRootAdmin = user.email === 'rakshith.e07@gmail.com';

  const nameError = useMemo(() => {
    if (!displayName.trim()) return 'Enter your name to continue.';
    if (displayName.trim().length < 2) return 'Use at least 2 characters for your name.';
    return '';
  }, [displayName]);

  useEffect(() => {
    if (step === 3 && !generatedBio && selectedInterests.length > 0) {
      void handleGenerateBio();
    }
  }, [step]);

  const handleValidateInvite = async () => {
    if (isRootAdmin) {
      setNotice(null);
      setStep(1);
      return;
    }

    if (!inviteCode.trim()) {
      setNotice({ tone: 'error', message: 'Enter your invite code to continue.' });
      return;
    }

    setValidatingInvite(true);
    setNotice(null);
    try {
      const inviteRef = doc(db, 'invites', inviteCode.trim().toUpperCase());
      const snap = await getDoc(inviteRef);

      if (!snap.exists()) {
        setNotice({ tone: 'error', message: 'That invite code was not found. Please check it and try again.' });
        return;
      }

      const inviteData = { id: snap.id, ...snap.data() } as Invite;
      if (inviteData.usedBy) {
        setNotice({ tone: 'error', message: 'This invite code has already been used.' });
        return;
      }

      setValidatedInvite(inviteData);
      setNotice({ tone: 'success', message: 'Invite validated. You can continue with your application.' });
      setStep(1);
    } catch (err) {
      setNotice({ tone: 'error', message: 'We could not validate your invite right now. Please try again.' });
      handleFirestoreError(err, OperationType.GET, `invites/${inviteCode}`);
    } finally {
      setValidatingInvite(false);
    }
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleGenerateBio = async () => {
    if (selectedInterests.length === 0) {
      setNotice({ tone: 'error', message: 'Select at least one interest before generating your bio.' });
      return;
    }

    setLoadingBio(true);
    setNotice(null);
    const result = await generateBio(selectedInterests, displayName.trim());
    setLoadingBio(false);

    if (!result.ok) {
      setNotice({ tone: 'error', message: result.message || 'Bio generation failed. Please try again.' });
      return;
    }

    setGeneratedBio(result.bio);
    if (result.message) {
      setNotice({ tone: 'info', message: result.message });
    } else {
      setNotice({ tone: 'success', message: 'Your bio is ready. You can edit it before submitting.' });
    }
  };

  const handleSubmit = async () => {
    if (!isRootAdmin && !validatedInvite) {
      setNotice({ tone: 'error', message: 'Validate your invite before submitting.' });
      return;
    }

    if (nameError) {
      setNotice({ tone: 'error', message: nameError });
      return;
    }

    if (selectedInterests.length === 0) {
      setNotice({ tone: 'error', message: 'Choose at least one interest before submitting.' });
      return;
    }

    let bioToSave = generatedBio.trim();
    if (!bioToSave) {
      setNotice({ tone: 'info', message: 'Generating your bio before submission...' });
      const result = await generateBio(selectedInterests, displayName.trim());
      if (!result.ok || !result.bio) {
        setNotice({ tone: 'error', message: result.message || 'We could not prepare your bio. Please try again.' });
        return;
      }
      bioToSave = result.bio;
      setGeneratedBio(result.bio);
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const profileData: Partial<UserProfile> = {
        userId: user.uid,
        displayName: displayName.trim() || user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
        status: isRootAdmin ? 'approved' : 'pending',
        role: isRootAdmin ? 'admin' : 'member',
        verificationStatus: 'unverified',
        presenceStatus: 'online',
        interests: selectedInterests,
        bio: bioToSave,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };

      await setDoc(doc(db, 'users', user.uid), profileData);

      if (validatedInvite) {
        await updateDoc(doc(db, 'invites', validatedInvite.id), {
          usedBy: user.uid,
        });
      }

      setNotice({ tone: 'success', message: 'Application submitted successfully.' });
    } catch (error) {
      setNotice({ tone: 'error', message: 'We could not submit your application. Please try again.' });
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-8 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),_transparent_24%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.03),_transparent_40%,_rgba(212,175,55,0.05)_100%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/12 bg-white/8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
      >
        <div className="border-b border-white/8 px-6 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-gold/20 bg-gold/10">
              <Crown className="h-7 w-7 text-gold" />
            </div>
            <div>
              <h1 className="text-3xl font-serif text-white sm:text-4xl">Membership Application</h1>
              <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-platinum/45">Elite Society</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8 sm:py-8">
          {notice && <Notice tone={notice.tone} message={notice.message} />}

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-serif text-white sm:text-3xl">Start with your access route</h2>
                  <p className="mt-2 text-sm leading-7 text-platinum/65">
                    Approved members can sign in directly from the homepage. New applicants can continue here with a valid invite code.
                  </p>
                </div>

                {isRootAdmin && (
                  <div className="rounded-2xl border border-gold/20 bg-gold/10 p-4 text-sm leading-7 text-gold/90">
                    Founder account detected. Invite validation is skipped for profile recovery and admin access.
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-[11px] uppercase tracking-[0.28em] text-platinum/45">Invite Code</label>
                  <div className="relative">
                    <Ticket className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-platinum/28" />
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="ELITE-XXXXX-2026"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 py-4 pl-12 pr-4 text-sm tracking-[0.18em] text-white outline-none transition focus:border-gold/40"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleLogout}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-5 py-4 text-sm font-semibold text-platinum transition hover:bg-white/10 sm:w-auto"
                  >
                    <LogOut className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleValidateInvite}
                    disabled={(!isRootAdmin && !inviteCode.trim()) || validatingInvite}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gold px-5 py-4 text-sm font-bold text-onyx transition hover:bg-[#e4c252] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {validatingInvite ? 'Validating...' : 'Continue'}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-serif text-white sm:text-3xl">Tell us who you are</h2>
                  <p className="mt-2 text-sm leading-7 text-platinum/65">
                    Your profile begins with the name you want members and reviewers to see.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] uppercase tracking-[0.28em] text-platinum/45">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-lg text-white outline-none transition focus:border-gold/40"
                  />
                  {nameError && <p className="text-sm text-rose-200">{nameError}</p>}
                </div>

                <StepActions
                  onBack={() => setStep(0)}
                  onNext={() => setStep(2)}
                  nextDisabled={!!nameError}
                />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-serif text-white sm:text-3xl">Select your interests</h2>
                  <p className="mt-2 text-sm leading-7 text-platinum/65">
                    These help us generate your bio and shape how your profile is displayed to other members.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {INTERESTS.map(({ id, label, icon }) => {
                    const selected = selectedInterests.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleInterest(id)}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition',
                          selected
                            ? 'border-gold/35 bg-gold/10 text-gold shadow-[0_12px_30px_rgba(212,175,55,0.08)]'
                            : 'border-white/10 bg-white/5 text-platinum/70 hover:border-white/18 hover:bg-white/8'
                        )}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/18">{icon}</div>
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>

                <StepActions
                  onBack={() => setStep(1)}
                  onNext={() => setStep(3)}
                  nextDisabled={selectedInterests.length === 0}
                  nextLabel="Continue to Bio"
                />
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-serif text-white sm:text-3xl">Review your generated bio</h2>
                  <p className="mt-2 text-sm leading-7 text-platinum/65">
                    We’ll save this bio to your profile when you submit. You can regenerate it or fine-tune it before finishing.
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  {loadingBio ? (
                    <div className="flex min-h-36 flex-col items-center justify-center gap-4">
                      <div className="h-10 w-10 rounded-full border-2 border-gold/70 border-t-transparent animate-spin" />
                      <p className="text-[11px] uppercase tracking-[0.28em] text-gold/70">Generating Bio</p>
                    </div>
                  ) : (
                    <textarea
                      value={generatedBio}
                      onChange={(e) => setGeneratedBio(e.target.value)}
                      rows={5}
                      className="min-h-36 w-full resize-none bg-transparent text-base leading-8 text-platinum outline-none"
                      placeholder="Your profile bio will appear here..."
                    />
                  )}
                </div>

                <button
                  onClick={handleGenerateBio}
                  disabled={loadingBio}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-gold/20 bg-gold/8 px-5 py-4 text-sm font-semibold text-gold transition hover:bg-gold/12 disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {loadingBio ? 'Generating...' : 'Regenerate Bio'}
                </button>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => setStep(2)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-5 py-4 text-sm font-semibold text-platinum transition hover:bg-white/10 sm:w-auto"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || loadingBio || !generatedBio.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gold px-5 py-4 text-sm font-bold text-onyx transition hover:bg-[#e4c252] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Submit Membership Request'}
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between border-t border-white/8 bg-black/18 px-6 py-5 sm:px-8">
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={cn(
                  'h-1.5 w-10 rounded-full transition',
                  step >= index ? 'bg-gold' : 'bg-white/10'
                )}
              />
            ))}
          </div>
          <span className="text-[11px] uppercase tracking-[0.25em] text-platinum/40">Step {step + 1} of 4</span>
        </div>
      </motion.div>
    </div>
  );
}

function StepActions({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = 'Next Step',
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        onClick={onBack}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-5 py-4 text-sm font-semibold text-platinum transition hover:bg-white/10 sm:w-auto"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gold px-5 py-4 text-sm font-bold text-onyx transition hover:bg-[#e4c252] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {nextLabel}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Notice({ tone, message }: { tone: NoticeTone; message: string }) {
  const toneClasses =
    tone === 'error'
      ? 'border-rose-300/18 bg-rose-300/8 text-rose-100'
      : tone === 'success'
        ? 'border-emerald-300/18 bg-emerald-300/8 text-emerald-100'
        : 'border-gold/20 bg-gold/8 text-gold';

  return (
    <div className={cn('mb-6 rounded-2xl border px-4 py-3 text-sm leading-7', toneClasses)}>
      {message}
    </div>
  );
}
