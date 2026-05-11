import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { UserProfile, UserStatus } from './types';
import { motion } from 'motion/react';
import { Crown, LogOut, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { PresenceProvider } from './context/PresenceContext';

import LandingView from './views/LandingView';
import ApplicationView from './views/ApplicationView';
import MemberApp from './apps/MemberApp';
import AdminApp from './apps/AdminApp';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [appMode, setAppMode] = useState<'member' | 'admin'>('member');
  const [presenceIntent, setPresenceIntent] = useState<'online' | 'busy'>('online');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;

          if (user.email === 'rakshith.e07@gmail.com' && data.role !== 'admin') {
            updateDoc(profileRef, {
              role: 'admin',
              status: 'approved',
              updatedAt: serverTimestamp(),
            });
          }

          setProfile(data);
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
      (err) => {
        if (err.message.includes('insufficient permissions') && !profile) {
          setLoading(false);
          return;
        }
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-onyx">
        <motion.div
          animate={{ scale: [1, 1.08, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          className="h-14 w-14 rounded-full border-2 border-gold/80 border-t-transparent shadow-[0_0_30px_rgba(212,175,55,0.18)]"
        />
      </div>
    );
  }

  if (!user) {
    return <LandingView onLogin={handleLogin} onApply={handleLogin} />;
  }

  if (!profile || profile.status === 'applying' || profile.status === 'new') {
    return <ApplicationView user={user} profile={profile} />;
  }

  if (profile.status === 'pending' || profile.status === 'waitlisted') {
    return (
      <AuthStatusView
        icon={<ShieldCheck className="h-14 w-14 text-gold" />}
        eyebrow="Membership Review"
        title={profile.status === 'waitlisted' ? 'You are on our priority waitlist' : 'Application Under Review'}
        description={
          profile.status === 'waitlisted'
            ? 'Your application has been received and placed on our priority waitlist. We will contact you as soon as space opens for the next cohort.'
            : 'Your application has been submitted successfully. Our team is reviewing it carefully, and approved members can return here anytime to log in.'
        }
        status={profile.status}
        actionLabel="Sign Out"
        onAction={handleLogout}
      />
    );
  }

  if (profile.status === 'rejected') {
    return (
      <AuthStatusView
        icon={<XCircle className="h-14 w-14 text-rose-300" />}
        eyebrow="Application Update"
        title="We’re unable to offer membership at this time"
        description="Thank you for your interest in Elite Society. After review, we’re not able to approve this application right now. You may contact the team later if you believe your application should be reconsidered."
        status={profile.status}
        actionLabel="Sign Out"
        onAction={handleLogout}
        tone="rejected"
      />
    );
  }

  if (profile.role === 'admin' && appMode === 'admin') {
    return (
      <PresenceProvider user={user} profile={profile} intent={presenceIntent}>
        <AdminApp
          profile={profile}
          onLogout={handleLogout}
          onSwitchToMember={() => setAppMode('member')}
          onPresenceIntentChange={setPresenceIntent}
        />
      </PresenceProvider>
    );
  }

  return (
    <PresenceProvider user={user} profile={profile} intent={presenceIntent}>
      <MemberApp
        profile={profile}
        onLogout={handleLogout}
        onSwitchToAdmin={profile.role === 'admin' ? () => setAppMode('admin') : undefined}
        onPresenceIntentChange={setPresenceIntent}
      />
    </PresenceProvider>
  );
}

function AuthStatusView({
  icon,
  eyebrow,
  title,
  description,
  status,
  actionLabel,
  onAction,
  tone = 'review',
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  status: UserStatus;
  actionLabel: string;
  onAction: () => void;
  tone?: 'review' | 'rejected';
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),_transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.04),_transparent_35%,_rgba(212,175,55,0.06)_100%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-xl rounded-[2rem] border border-white/12 bg-white/8 p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-12"
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/10 bg-white/6">
          {icon}
        </div>
        <div className="mb-4 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.35em] text-platinum/55">
          <Crown className="h-4 w-4 text-gold" />
          <span>{eyebrow}</span>
        </div>
        <h1 className="mb-4 text-4xl font-serif leading-tight text-white sm:text-5xl">{title}</h1>
        <p className="mx-auto mb-8 max-w-lg text-sm leading-7 text-platinum/70 sm:text-base">{description}</p>
        <div
          className={`mx-auto mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] ${
            tone === 'rejected'
              ? 'border-rose-300/20 bg-rose-300/8 text-rose-200'
              : 'border-gold/20 bg-gold/8 text-gold'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Status: {status}</span>
        </div>
        <button
          onClick={onAction}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-5 py-4 text-sm font-semibold text-platinum transition hover:border-white/20 hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
          {actionLabel}
        </button>
      </motion.div>
    </div>
  );
}
