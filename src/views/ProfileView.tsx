import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Camera,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Edit2,
  ExternalLink,
  Linkedin,
  Plus,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Twitter,
  X,
} from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Invite, UserProfile } from '../types';
import { cn, formatDate } from '../lib/utils';
import { INTERESTS } from '../constants';
import { generateBio } from '../lib/gemini';
import Avatar from '../components/Avatar';
import { usePresence } from '../context/PresenceContext';
import { getPresenceTone } from '../lib/presence';

type FeedbackTone = 'error' | 'success' | 'info';

export default function ProfileView({ profile, onLogout }: { profile: UserProfile; onLogout: () => void }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inviteDeleteConfirm, setInviteDeleteConfirm] = useState<{ show: boolean; id: string; code: string }>({
    show: false,
    id: '',
    code: '',
  });
  const [resignConfirm, setResignConfirm] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(profile.displayName);
  const [editedInterests, setEditedInterests] = useState<string[]>(profile.interests || []);
  const [editedSocials, setEditedSocials] = useState({
    linkedin: profile.socialLinks?.linkedin || '',
    twitter: profile.socialLinks?.twitter || '',
    website: profile.socialLinks?.website || '',
  });
  const [editedBio, setEditedBio] = useState(profile.bio || '');
  const [loadingBio, setLoadingBio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);
  const { getPresence, getPresenceText } = usePresence();

  const livePresence = getPresence(profile.userId);
  const livePresenceText = getPresenceText(profile.userId);

  useEffect(() => {
    setEditedName(profile.displayName);
    setEditedInterests(profile.interests || []);
    setEditedSocials({
      linkedin: profile.socialLinks?.linkedin || '',
      twitter: profile.socialLinks?.twitter || '',
      website: profile.socialLinks?.website || '',
    });
    setEditedBio(profile.bio || '');
  }, [profile]);

  useEffect(() => {
    const q = query(collection(db, 'invites'), where('createdBy', '==', profile.userId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setInvites(snap.docs.map((inviteDoc) => ({ id: inviteDoc.id, ...inviteDoc.data() } as Invite)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'invites')
    );

    return unsubscribe;
  }, [profile.userId]);

  const toggleInterest = (id: string) => {
    setEditedInterests((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setFeedback({ tone: 'error', message: 'Please choose an image smaller than 1MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onloadstart = () => {
      setSaving(true);
      setFeedback(null);
    };
    reader.onloadend = async () => {
      try {
        await updateDoc(doc(db, 'users', profile.userId), {
          photoURL: reader.result as string,
          updatedAt: serverTimestamp(),
        });
        setFeedback({ tone: 'success', message: 'Profile photo updated.' });
      } catch (err) {
        setFeedback({ tone: 'error', message: 'We could not update your photo. Please try again.' });
        handleFirestoreError(err, OperationType.UPDATE, `users/${profile.userId}`);
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateBio = async () => {
    if (editedInterests.length === 0) {
      setFeedback({ tone: 'error', message: 'Select at least one interest before generating a bio.' });
      return;
    }

    setLoadingBio(true);
    setFeedback(null);
    const result = await generateBio(editedInterests, editedName.trim());
    setLoadingBio(false);

    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message || 'Bio generation failed. Please try again.' });
      return;
    }

    setEditedBio(result.bio);
    setFeedback({
      tone: result.source === 'ai' ? 'success' : 'info',
      message: result.message || 'Bio generated successfully.',
    });
  };

  const handleSaveProfile = async () => {
    if (!editedName.trim()) {
      setFeedback({ tone: 'error', message: 'Your display name cannot be empty.' });
      return;
    }

    if (editedInterests.length === 0) {
      setFeedback({ tone: 'error', message: 'Choose at least one interest for your profile.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await updateDoc(doc(db, 'users', profile.userId), {
        displayName: editedName.trim(),
        interests: editedInterests,
        socialLinks: editedSocials,
        bio: editedBio.trim(),
        updatedAt: serverTimestamp(),
      });
      setIsEditing(false);
      setFeedback({ tone: 'success', message: 'Profile updated successfully.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: 'We could not save your profile changes.' });
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.userId}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestVerification = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await updateDoc(doc(db, 'users', profile.userId), {
        verificationStatus: 'pending',
        updatedAt: serverTimestamp(),
      });
      setFeedback({ tone: 'success', message: 'Verification request submitted.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: 'Verification request failed. Please try again.' });
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.userId}`);
    } finally {
      setSaving(false);
    }
  };

  const generateInvite = async () => {
    setLoadingInvites(true);
    setFeedback(null);
    try {
      const code = `ELITE-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${new Date().getFullYear()}`;
      await setDoc(doc(db, 'invites', code), {
        code,
        createdBy: profile.userId,
        createdAt: serverTimestamp(),
      });
      setFeedback({ tone: 'success', message: 'New invite generated.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: 'Invite generation failed. Please try again.' });
      handleFirestoreError(err, OperationType.CREATE, 'invites');
    } finally {
      setLoadingInvites(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'invites', inviteId));
      setInviteDeleteConfirm({ show: false, id: '', code: '' });
      setFeedback({ tone: 'success', message: 'Invite deleted.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: 'Invite deletion failed. Please try again.' });
      handleFirestoreError(err, OperationType.DELETE, `invites/${inviteId}`);
    }
  };

  const handleDeleteAccount = async () => {
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'users', profile.userId));
      setResignConfirm(false);
      onLogout();
    } catch (err) {
      setFeedback({ tone: 'error', message: 'We could not remove your profile.' });
      handleFirestoreError(err, OperationType.DELETE, `users/${profile.userId}`);
    } finally {
      setSaving(false);
    }
  };

  const presenceOptions = [
    { id: 'online', color: 'bg-emerald-500', label: 'Online' },
    { id: 'busy', color: 'bg-rose-500', label: 'Busy' },
    { id: 'offline', color: 'bg-platinum/25', label: 'Offline' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {feedback && <FeedbackBanner tone={feedback.tone} message={feedback.message} />}

      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.25)] backdrop-blur-2xl sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex justify-center lg:justify-start">
            <label className="group relative block cursor-pointer">
              <Avatar
                name={profile.displayName}
                src={profile.photoURL}
                className="h-36 w-36 rounded-[2rem] border border-white/10 shadow-[0_12px_35px_rgba(0,0,0,0.3)] sm:h-40 sm:w-40"
                textClassName="text-5xl"
                presenceStatus={livePresence.status}
                showPresence
                presenceClassName="h-5 w-5 border-4"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[2rem] bg-black/45 opacity-0 transition group-hover:opacity-100">
                <Camera className="mb-2 h-7 w-7 text-gold" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">Update Photo</span>
              </div>
              {saving && (
                <div className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-onyx/70">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={saving} />
            </label>
          </div>

          <div className="space-y-5 text-center lg:text-left">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center justify-center gap-3 lg:justify-start">
                  <h1 className="text-4xl font-serif text-white sm:text-5xl">{profile.displayName}</h1>
                  {profile.verificationStatus === 'verified' && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-onyx shadow-[0_0_15px_rgba(212,175,55,0.35)]">
                      <Check className="h-4 w-4 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.28em] text-gold/75 lg:justify-start">
                  <span>{profile.status}</span>
                  <span className="h-1 w-1 rounded-full bg-gold/45" />
                  <span>{profile.role}</span>
                </div>
                <div className={cn('mt-3 text-sm font-medium', getPresenceTone(livePresence.status))}>{livePresenceText}</div>
              </div>

              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-platinum transition hover:border-gold/25 hover:text-white"
              >
                <Edit2 className="h-4 w-4" />
                Edit Profile
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              {presenceOptions.map((option) => (
                <button
                  key={option.id}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] transition hover:-translate-y-0.5',
                    livePresence.status === option.id
                      ? 'border-gold/25 bg-gold/10 text-gold'
                      : 'border-white/10 bg-white/4 text-platinum/45 hover:text-platinum/80'
                  )}
                  type="button"
                >
                  <span className={cn('h-2.5 w-2.5 rounded-full', option.color)} />
                  {option.label}
                </button>
              ))}
            </div>

            {!profile.verificationStatus || profile.verificationStatus === 'unverified' ? (
              <button
                onClick={handleRequestVerification}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm font-semibold text-gold transition hover:bg-gold/14 disabled:opacity-60"
              >
                <Shield className="h-4 w-4" />
                Request Identity Verification
              </button>
            ) : profile.verificationStatus === 'pending' ? (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-platinum/70">
                <Clock className="h-4 w-4 text-gold" />
                Verification Pending Review
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 backdrop-blur-2xl sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.28em] text-platinum/45">Biography</h2>
            <p className="mt-4 text-xl font-serif italic leading-9 text-platinum/90">
              "{profile.bio || 'A thoughtful bio will appear here once it is saved to your profile.'}"
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-[11px] uppercase tracking-[0.28em] text-platinum/45">Member Since</h2>
              <div className="mt-3 flex items-center gap-3 text-sm text-platinum/80">
                <Clock className="h-4 w-4 text-gold" />
                <span>{profile.createdAt ? formatDate(profile.createdAt.toDate()) : 'Recently'}</span>
              </div>
            </div>

            <div>
              <h2 className="text-[11px] uppercase tracking-[0.28em] text-platinum/45">Interests</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.interests.map((id) => {
                  const interest = INTERESTS.find((item) => item.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-platinum/70"
                    >
                      {interest?.icon}
                      {interest?.label || id}
                    </span>
                  );
                })}
              </div>
            </div>

            {profile.socialLinks && Object.values(profile.socialLinks).some(Boolean) && (
              <div>
                <h2 className="text-[11px] uppercase tracking-[0.28em] text-platinum/45">Professional Links</h2>
                <div className="mt-3 flex flex-wrap gap-3">
                  {profile.socialLinks.linkedin && (
                    <SocialLink href={profile.socialLinks.linkedin} icon={<Linkedin className="h-4 w-4" />} label="LinkedIn" />
                  )}
                  {profile.socialLinks.twitter && (
                    <SocialLink href={profile.socialLinks.twitter} icon={<Twitter className="h-4 w-4" />} label="Twitter" />
                  )}
                  {profile.socialLinks.website && (
                    <SocialLink href={profile.socialLinks.website} icon={<ExternalLink className="h-4 w-4" />} label="Website" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 backdrop-blur-2xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-serif text-white">Invite a Peer</h2>
            <p className="mt-2 text-sm leading-7 text-platinum/62">
              Share access with professionals who reflect the standards of the community.
            </p>
          </div>
          <button
            onClick={generateInvite}
            disabled={loadingInvites || invites.length >= 5}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm font-semibold text-gold transition hover:bg-gold/14 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {loadingInvites ? 'Generating...' : 'Generate Invite'}
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {invites.map((invite) => (
            <div key={invite.id} className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="font-mono text-sm tracking-[0.18em] text-gold/88">{invite.code}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-platinum/42">
                  <span className={invite.usedBy ? 'text-emerald-300' : 'text-platinum/42'}>{invite.usedBy ? 'Redeemed' : 'Available'}</span>
                  <span className="hidden sm:inline text-white/15">•</span>
                  <span>{invite.createdAt ? formatDate(invite.createdAt.toDate()) : 'Recently'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!invite.usedBy && (
                  <button
                    onClick={() => handleCopy(invite.code, invite.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-platinum/80 transition hover:text-gold"
                  >
                    {copiedId === invite.id ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                    {copiedId === invite.id ? 'Copied' : 'Copy'}
                  </button>
                )}
                {profile.role === 'admin' && (
                  <button
                    onClick={() => setInviteDeleteConfirm({ show: true, id: invite.id, code: invite.code })}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-300/12 bg-rose-300/8 px-3 py-2 text-sm text-rose-100 transition hover:bg-rose-300/14"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}

          {invites.length === 0 && (
            <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/10 px-6 py-12 text-center">
              <Star className="mx-auto mb-4 h-8 w-8 text-platinum/18" />
              <p className="text-sm text-platinum/42">No active invites yet.</p>
            </div>
          )}
        </div>
      </section>

      <div className="pb-8">
        <button
          onClick={() => setResignConfirm(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[1.5rem] border border-rose-300/12 bg-rose-300/8 px-5 py-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/14"
        >
          <Trash2 className="h-4 w-4" />
          Resign Membership
        </button>
      </div>

      <AnimatePresence>
        {isEditing && (
          <ModalShell onClose={() => setIsEditing(false)}>
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-3xl font-serif text-white">Edit Profile</h3>
                  <p className="mt-2 text-sm text-platinum/55">Update your public profile, interests, and biography.</p>
                </div>
                <button onClick={() => setIsEditing(false)} className="rounded-xl p-2 text-platinum/40 transition hover:bg-white/8 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5">
                <Field label="Display Name">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-lg text-white outline-none transition focus:border-gold/35"
                    placeholder="Your full name"
                  />
                </Field>

                <Field label="Interests">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {INTERESTS.map((interest) => {
                      const selected = editedInterests.includes(interest.id);
                      return (
                        <button
                          key={interest.id}
                          onClick={() => toggleInterest(interest.id)}
                          className={cn(
                            'flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition',
                            selected
                              ? 'border-gold/35 bg-gold/10 text-gold'
                              : 'border-white/10 bg-white/5 text-platinum/70 hover:border-white/18 hover:bg-white/8'
                          )}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/18">{interest.icon}</div>
                          <span className="text-sm font-medium">{interest.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Biography">
                  <div className="space-y-3">
                    <textarea
                      value={editedBio}
                      onChange={(e) => setEditedBio(e.target.value)}
                      rows={5}
                      className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4 text-base leading-8 text-platinum outline-none transition focus:border-gold/35"
                      placeholder="Your bio will appear here..."
                    />
                    <button
                      onClick={handleGenerateBio}
                      disabled={loadingBio}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm font-semibold text-gold transition hover:bg-gold/14 disabled:opacity-60"
                    >
                      {loadingBio ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" /> : <Sparkles className="h-4 w-4" />}
                      {loadingBio ? 'Generating...' : 'Generate Bio with AI'}
                    </button>
                  </div>
                </Field>

                <Field label="Professional Links">
                  <div className="space-y-3">
                    <SocialInput icon={<Linkedin className="h-4 w-4" />} value={editedSocials.linkedin} onChange={(value) => setEditedSocials((prev) => ({ ...prev, linkedin: value }))} placeholder="linkedin.com/in/username" />
                    <SocialInput icon={<Twitter className="h-4 w-4" />} value={editedSocials.twitter} onChange={(value) => setEditedSocials((prev) => ({ ...prev, twitter: value }))} placeholder="twitter.com/handle" />
                    <SocialInput icon={<ExternalLink className="h-4 w-4" />} value={editedSocials.website} onChange={(value) => setEditedSocials((prev) => ({ ...prev, website: value }))} placeholder="yourwebsite.com" />
                  </div>
                </Field>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setIsEditing(false)}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-sm font-semibold text-platinum transition hover:bg-white/10 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving || !editedName.trim() || editedInterests.length === 0}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gold px-4 py-4 text-sm font-bold text-onyx transition hover:bg-[#e4c252] disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </ModalShell>
        )}

        {inviteDeleteConfirm.show && (
          <ModalShell onClose={() => setInviteDeleteConfirm({ show: false, id: '', code: '' })}>
            <ConfirmDialog
              title="Delete Invite"
              description={`Delete invite code ${inviteDeleteConfirm.code}? This action cannot be undone.`}
              confirmLabel="Delete Invite"
              onCancel={() => setInviteDeleteConfirm({ show: false, id: '', code: '' })}
              onConfirm={() => handleDeleteInvite(inviteDeleteConfirm.id)}
              tone="danger"
            />
          </ModalShell>
        )}

        {resignConfirm && (
          <ModalShell onClose={() => setResignConfirm(false)}>
            <ConfirmDialog
              title="Resign Membership"
              description="This will permanently remove your profile and revoke your access to Elite Society."
              confirmLabel={saving ? 'Removing...' : 'Confirm Resignation'}
              onCancel={() => setResignConfirm(false)}
              onConfirm={handleDeleteAccount}
              tone="danger"
            />
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeedbackBanner({ tone, message }: { tone: FeedbackTone; message: string }) {
  const toneClasses =
    tone === 'error'
      ? 'border-rose-300/18 bg-rose-300/8 text-rose-100'
      : tone === 'success'
        ? 'border-emerald-300/18 bg-emerald-300/8 text-emerald-100'
        : 'border-gold/20 bg-gold/8 text-gold';

  return <div className={cn('rounded-2xl border px-4 py-3 text-sm leading-7', toneClasses)}>{message}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <label className="text-[11px] uppercase tracking-[0.28em] text-platinum/45">{label}</label>
      {children}
    </div>
  );
}

function SocialInput({
  icon,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-platinum/35">{icon}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-platinum outline-none transition focus:border-gold/35"
        placeholder={placeholder}
      />
    </div>
  );
}

function SocialLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const resolvedHref = href.startsWith('http') ? href : `https://${href}`;
  return (
    <a
      href={resolvedHref}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-platinum/75 transition hover:border-gold/25 hover:text-gold"
    >
      {icon}
      {label}
    </a>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-onyx/85 backdrop-blur-md" />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/12 bg-[#0a0a0a] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:p-8"
      >
        {children}
      </motion.div>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  tone,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  tone: 'danger';
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-3xl font-serif text-white">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-platinum/60">{description}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onCancel}
          className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-sm font-semibold text-platinum transition hover:bg-white/10 sm:w-auto"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={cn(
            'inline-flex flex-1 items-center justify-center rounded-2xl px-4 py-4 text-sm font-bold transition',
            tone === 'danger' && 'bg-rose-500 text-white hover:bg-rose-600'
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
