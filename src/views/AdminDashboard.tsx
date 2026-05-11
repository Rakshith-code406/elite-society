import { useEffect, useState } from 'react';
import { collection, query, where, updateDoc, doc, onSnapshot, orderBy, serverTimestamp, deleteDoc, setDoc, collectionGroup } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { UserProfile, Invite, Event } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, Clock, Shield, User as UserIcon, Crown, ShieldAlert, AlertTriangle, Search, Ticket, Trash2, Plus, Check, Copy, CheckCircle2, Calendar, MapPin, Globe, Image as ImageIcon, Upload } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Avatar from '../components/Avatar';
import { usePresence } from '../context/PresenceContext';
import { getPresenceTone } from '../lib/presence';

export default function AdminDashboard() {
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<UserProfile[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'invites' | 'events'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [generating, setGenerating] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    userId: string;
    userName: string;
    currentRole: string;
  }>({ show: false, userId: '', userName: '', currentRole: '' });

  // Event Form State
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    locationLink: '',
    type: 'in-person' as 'virtual' | 'in-person',
    imageUrl: ''
  });

  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [tempDate, setTempDate] = useState('');
  const [tempTime, setTempTime] = useState('');

  const [inviteDeleteConfirm, setInviteDeleteConfirm] = useState<{
    show: boolean;
    id: string;
    code: string;
  }>({ show: false, id: '', code: '' });

  const [eventDeleteConfirm, setEventDeleteConfirm] = useState<{
    show: boolean;
    id: string;
    title: string;
  }>({ show: false, id: '', title: '' });

  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});

  const [eventAttendeesModal, setEventAttendeesModal] = useState<{
    show: boolean;
    eventId: string;
    eventTitle: string;
  } | null>(null);
  const [eventAttendees, setEventAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const { getPresence, getPresenceText } = usePresence();

  useEffect(() => {
    if (eventAttendeesModal?.show && eventAttendeesModal.eventId) {
      setLoadingAttendees(true);
      const q = query(collection(db, 'events', eventAttendeesModal.eventId, 'attendees'), orderBy('registeredAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
         setEventAttendees(snap.docs.map(doc => doc.data()));
         setLoadingAttendees(false);
      });
      return unsub;
    } else {
      setEventAttendees([]);
    }
  }, [eventAttendeesModal]);

  useEffect(() => {
    const q = query(collectionGroup(db, 'attendees'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach((attendeeDoc) => {
        const data = attendeeDoc.data() as { eventId?: string };
        if (!data.eventId) return;
        counts[data.eventId] = (counts[data.eventId] || 0) + 1;
      });
      setAttendeeCounts(counts);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'events/*/attendees'));

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Listen for events
    const qEvents = query(collection(db, 'events'), orderBy('date', 'desc'));
    const unsubscribeEvents = onSnapshot(qEvents, (snap) => {
      setAllEvents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'events'));

    // Listen for pending users
    const qPending = query(
      collection(db, 'users'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribePending = onSnapshot(qPending, (snap) => {
      setPendingUsers(snap.docs.map(doc => ({ userId: doc.id, ...doc.data() } as UserProfile)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users/pending'));

    // Listen for approved users for role management
    const qApproved = query(
      collection(db, 'users'),
      where('status', '==', 'approved'),
      orderBy('displayName', 'asc')
    );

    const unsubscribeApproved = onSnapshot(qApproved, (snap) => {
      setApprovedUsers(snap.docs.map(doc => ({ userId: doc.id, ...doc.data() } as UserProfile)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users/approved'));

    // Listen for verification requests
    const qVerification = query(
      collection(db, 'users'),
      where('verificationStatus', '==', 'pending'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribeVerification = onSnapshot(qVerification, (snap) => {
      setVerificationRequests(snap.docs.map(doc => ({ userId: doc.id, ...doc.data() } as UserProfile)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users/verification'));

    // Listen for all invites
    const qInvites = query(
      collection(db, 'invites'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeInvites = onSnapshot(qInvites, (snap) => {
      setInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invite)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'invites'));

    return () => {
      unsubscribePending();
      unsubscribeApproved();
      unsubscribeVerification();
      unsubscribeInvites();
    };
  }, []);

  const updateStatus = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const updateVerification = async (userId: string, status: 'verified' | 'unverified') => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        verificationStatus: status,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleToggleRole = async () => {
    const { userId, currentRole } = confirmModal;
    const nextRole = currentRole === 'admin' ? 'member' : 'admin';
    
    setConfirmModal(prev => ({ ...prev, show: false }));
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: nextRole,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const deleteInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'invites', inviteId));
      setInviteDeleteConfirm({ show: false, id: '', code: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `invites/${inviteId}`);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEvent(true);
    try {
      let finalImageUrl = eventForm.imageUrl;

      if (selectedFile) {
        // Convert image to base64 Data URL to bypass Firebase Storage CORS issues
        finalImageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read image file."));
          reader.readAsDataURL(selectedFile);
        });
      }

      const eventData = {
        ...eventForm,
        imageUrl: finalImageUrl,
        date: new Date(eventForm.date), // Convert string to Date for Firestore Timestamp conversion
        hostId: auth.currentUser?.uid || 'system',
        attendeeCount: 0,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'events'), eventData);
      setEventForm({
        title: '',
        description: '',
        date: '',
        location: '',
        locationLink: '',
        type: 'in-person',
        imageUrl: ''
      });
      setSelectedFile(null);
      alert("Society Assembly created successfully.");
    } catch (err: any) {
      console.error("Failed to create event:", err);
      alert("Failed to create event: " + (err.message || String(err)));
    } finally {
      setSavingEvent(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, 'events', eventId));
      setEventDeleteConfirm({ show: false, id: '', title: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `events/${eventId}`);
    }
  };

  const generateAdminInvite = async () => {
    setGenerating(true);
    try {
      const code = `ELITE-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${new Date().getFullYear()}`;
      await setDoc(doc(db, 'invites', code), {
        code,
        createdBy: auth.currentUser?.uid || 'system',
        createdAt: serverTimestamp()
      });
      setNewInviteCode(code);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'invites');
    } finally {
      setGenerating(false);
    }
  };

  const filteredApprovedUsers = approvedUsers.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-16">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
         <div>
            <h1 className="text-3xl md:text-5xl font-serif mb-2 tracking-tight">System Controls</h1>
            <p className="text-sm md:text-base text-platinum/40 font-light italic">Orchestrating the leadership and curation of the Inner Circle.</p>
         </div>
         
         <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 backdrop-blur-xl overflow-x-auto no-scrollbar max-w-full">
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "px-4 md:px-8 py-2.5 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all duration-300 flex-shrink-0",
                activeTab === 'users' ? "bg-gold text-onyx shadow-[0_0_20px_rgba(212,175,55,0.3)]" : "text-platinum/40 hover:text-platinum"
              )}
            >
              Curation
            </button>
            <button 
              onClick={() => setActiveTab('invites')}
              className={cn(
                "px-4 md:px-8 py-2.5 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all duration-300 flex-shrink-0",
                activeTab === 'invites' ? "bg-gold text-onyx shadow-[0_0_20px_rgba(212,175,55,0.3)]" : "text-platinum/40 hover:text-platinum"
              )}
            >
              Referrals
            </button>
            <button 
              onClick={() => setActiveTab('events')}
              className={cn(
                "px-4 md:px-8 py-2.5 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all duration-300 flex-shrink-0",
                activeTab === 'events' ? "bg-gold text-onyx shadow-[0_0_20px_rgba(212,175,55,0.3)]" : "text-platinum/40 hover:text-platinum"
              )}
            >
              Assemblies
            </button>
         </div>
      </header>

      {activeTab === 'users' && (
        <div className="space-y-12">
          {/* Quick Stats / Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white/5 border border-white/5 rounded-3xl">
              <p className="text-[10px] uppercase tracking-[0.2em] text-platinum/40 font-bold mb-1">Active Members</p>
              <p className="text-3xl font-serif text-gold">{approvedUsers.length}</p>
            </div>
            <div className="p-6 bg-white/5 border border-white/5 rounded-3xl">
              <p className="text-[10px] uppercase tracking-[0.2em] text-platinum/40 font-bold mb-1">Pending Review</p>
              <p className="text-3xl font-serif text-platinum">{pendingUsers.length}</p>
            </div>
            <div className="p-6 bg-white/5 border border-white/5 rounded-3xl">
              <p className="text-[10px] uppercase tracking-[0.2em] text-platinum/40 font-bold mb-1">Admins</p>
              <p className="text-3xl font-serif text-gold">{approvedUsers.filter(u => u.role === 'admin').length}</p>
            </div>
          </div>

          <div className="bg-gold/10 border border-gold/20 p-4 rounded-2xl flex items-center gap-3">
             <Shield className="w-5 h-5 text-gold" />
             <p className="text-xs text-gold/80 font-medium">To appoint new leadership, find a member in the list below and select "Promote" to grant them Admin privileges.</p>
          </div>
          {/* Verification Requests Section */}
          {verificationRequests.length > 0 && (
            <section className="bg-gold/5 border border-gold/20 rounded-3xl overflow-hidden shadow-2xl">
              <header className="p-6 border-b border-gold/10 flex items-center justify-between bg-gold/[0.02]">
                 <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gold" />
                    <h2 className="text-xl font-serif text-gold">Identity Verifications</h2>
                 </div>
                 <span className="px-3 py-1 rounded-full bg-gold/10 text-gold text-[10px] uppercase tracking-widest font-bold">
                   {verificationRequests.length} Pending Requests
                 </span>
              </header>

              <div className="divide-y divide-gold/10">
                {verificationRequests.map(u => (
                  <motion.div key={u.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 flex items-center gap-6 hover:bg-gold/[0.01] transition-colors">
                    <Avatar
                      name={u.displayName}
                      src={u.photoURL}
                      className="h-16 w-16 flex-shrink-0 rounded-2xl border border-white/5 bg-white/5"
                      textClassName="text-2xl"
                      presenceStatus={getPresence(u.userId).status}
                      showPresence
                    />
                    <div className="flex-1">
                      <h3 className="text-lg font-serif">{u.displayName}</h3>
                      <p className="text-[10px] text-platinum/40 uppercase tracking-widest leading-none">
                        Requested on {u.updatedAt ? formatDate(u.updatedAt.toDate()) : 'Recently'}
                      </p>
                      <p className={cn("mt-2 text-[10px] uppercase tracking-widest", getPresenceTone(getPresence(u.userId).status))}>
                        {getPresenceText(u.userId)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => updateVerification(u.userId, 'unverified')}
                         className="p-3 rounded-xl bg-red-400/10 text-red-400 hover:bg-red-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
                         title="Deny Verification"
                       >
                         <XCircle className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => updateVerification(u.userId, 'verified')}
                         className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gold text-onyx hover:bg-gold/80 transition-all text-xs font-bold uppercase tracking-widest shadow-lg"
                       >
                         <CheckCircle className="w-4 h-4" /> Verify Member
                       </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Pending Applications Section */}
          <section className="bg-black/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <header className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
               <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gold" />
                  <h2 className="text-xl font-serif">Pending Applications</h2>
               </div>
               <span className="px-3 py-1 rounded-full bg-gold/10 text-gold text-[10px] uppercase tracking-widest font-bold">
                 {pendingUsers.length} Needs Review
               </span>
            </header>

            <div className="divide-y divide-white/5">
               {pendingUsers.map(u => (
                 <motion.div key={u.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 flex flex-col md:flex-row gap-8 items-start hover:bg-white/[0.01] transition-colors">
                    <Avatar
                      name={u.displayName}
                      src={u.photoURL}
                      className="h-24 w-24 flex-shrink-0 rounded-2xl border border-white/5 bg-white/5"
                      textClassName="text-4xl"
                      presenceStatus={getPresence(u.userId).status}
                      showPresence
                      presenceClassName="h-4 w-4 border-2"
                    />
                    
                    <div className="flex-1 space-y-4">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                             <h3 className="text-2xl font-serif mb-1">{u.displayName}</h3>
                             <p className="text-[10px] text-platinum/40 uppercase tracking-widest leading-none">
                                Applied on {u.createdAt ? formatDate(u.createdAt.toDate()) : 'Recently'}
                             </p>
                             <p className={cn("mt-2 text-[10px] uppercase tracking-widest", getPresenceTone(getPresence(u.userId).status))}>
                                {getPresenceText(u.userId)}
                             </p>
                          </div>
                          <div className="flex gap-2">
                             <button 
                               onClick={() => updateStatus(u.userId, 'rejected')}
                               className="flex items-center gap-2 px-6 py-2 rounded-xl bg-red-400/10 text-red-100 hover:bg-red-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
                             >
                               <XCircle className="w-4 h-4" /> Reject
                             </button>
                             <button 
                               onClick={() => updateStatus(u.userId, 'approved')}
                               className="flex items-center gap-2 px-6 py-2 rounded-xl bg-green-400/10 text-green-100 hover:bg-green-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
                             >
                               <CheckCircle className="w-4 h-4" /> Approve
                             </button>
                          </div>
                       </div>

                       <div className="p-4 bg-white/5 rounded-xl border border-white/5 italic text-platinum/60 font-light leading-relaxed">
                          "{u.bio || 'A member bio has not been added yet.'}"
                       </div>
                    </div>
                 </motion.div>
               ))}

               {!loading && pendingUsers.length === 0 && (
                 <div className="p-20 text-center text-platinum/20 flex flex-col items-center">
                    <Shield className="w-12 h-12 mb-4 opacity-40" />
                    <p className="italic">All current applications have been processed.</p>
                 </div>
               )}
            </div>
          </section>

          {/* Member & Role Management Section */}
          <section className="bg-black/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <header className="p-6 border-b border-white/5 bg-white/[0.02] space-y-4">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <Crown className="w-5 h-5 text-gold" />
                     <h2 className="text-xl font-serif">Member Roles & Curation</h2>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-platinum/10 text-platinum/60 text-[10px] uppercase tracking-widest font-bold">
                    {approvedUsers.length} Active Members
                  </span>
               </div>
               
               <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-platinum/20 group-focus-within:text-gold transition-colors" />
                  <input 
                    type="text"
                    placeholder="Search by member name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-gold/50 transition-all placeholder:text-platinum/20"
                  />
               </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-white/5">
               {filteredApprovedUsers.map(u => (
                 <div key={u.userId} className="p-6 flex items-center gap-4 hover:bg-white/[0.01] transition-colors">
                    <Avatar
                      name={u.displayName}
                      src={u.photoURL}
                      className="h-12 w-12 flex-shrink-0 rounded-xl border border-white/5 bg-white/5"
                      textClassName="text-lg"
                      presenceStatus={getPresence(u.userId).status}
                      showPresence
                      presenceClassName="h-3 w-3 border"
                    />
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-1.5">
                          <h4 className="font-serif text-white truncate">{u.displayName}</h4>
                          {u.verificationStatus === 'verified' && (
                             <Check className="w-3 h-3 text-gold" />
                          )}
                       </div>
                       <p className={cn("mt-1 text-[9px] uppercase tracking-widest", getPresenceTone(getPresence(u.userId).status))}>
                         {getPresenceText(u.userId)}
                       </p>
                       <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded flex items-center gap-1",
                            u.role === 'admin' ? "bg-gold/20 text-gold shadow-[0_0_10px_rgba(212,175,55,0.1)]" : "bg-white/10 text-platinum/40"
                          )}>
                            {u.role === 'admin' && <Crown className="w-2.5 h-2.5" />}
                            {u.role}
                          </span>
                       </div>
                    </div>
                    <button 
                      onClick={() => setConfirmModal({ show: true, userId: u.userId, userName: u.displayName, currentRole: u.role })}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest group",
                        u.role === 'admin' 
                          ? "border-red-400/20 text-red-400 hover:bg-red-400 hover:text-white" 
                          : "border-gold/20 text-gold hover:bg-gold hover:text-onyx"
                      )}
                    >
                      {u.role === 'admin' ? (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Demote</span>
                        </>
                      ) : (
                        <>
                          <Crown className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Promote</span>
                        </>
                      )}
                    </button>
                 </div>
               ))}
            </div>

            {loading && (
              <div className="p-20 flex justify-center">
                 <div className="w-8 h-8 border-2 border-gold rounded-full border-t-transparent animate-spin" />
              </div>
            )}

            {!loading && searchTerm && filteredApprovedUsers.length === 0 && (
              <div className="p-12 text-center text-platinum/40 italic text-sm">
                No members found matching "{searchTerm}"
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'invites' && (
        <section className="bg-black/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
           <header className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                 <Ticket className="w-5 h-5 text-gold" />
                 <h2 className="text-xl font-serif">Referral Ledger</h2>
              </div>
              <div className="flex items-center gap-4">
                 <span className="hidden sm:inline px-3 py-1 rounded-full bg-platinum/10 text-platinum/60 text-[10px] uppercase tracking-widest font-bold">
                   {invites.length} Total Codes
                 </span>
                 <button 
                   onClick={generateAdminInvite}
                   disabled={generating}
                   className="flex items-center gap-2 bg-gold text-onyx px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gold/90 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                 >
                   {generating ? <div className="w-3 h-3 border-2 border-onyx border-t-transparent rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                   Generate Code
                 </button>
              </div>
           </header>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-white/5">
              {invites.map(invite => (
                <div key={invite.id} className={cn(
                  "p-6 flex flex-col gap-4 hover:bg-white/[0.01] transition-colors",
                  invite.usedBy && "bg-green-500/[0.02]"
                )}>
                   <div className="flex items-center justify-between">
                      <code className="text-xs font-mono text-gold/80 bg-gold/5 px-2 py-1 rounded border border-gold/10">
                        {invite.code}
                      </code>
                      <button 
                         onClick={() => {
                           navigator.clipboard.writeText(invite.code);
                         }}
                         className="p-1.5 text-platinum/20 hover:text-gold transition-colors"
                         title="Copy Code"
                       >
                          <Copy className="w-3.5 h-3.5" />
                       </button>
                   </div>
                   
                   <div className="space-y-4">
                       <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
                          <span className="text-platinum/30">Created By</span>
                          <span className="text-gold/60 font-bold">
                            {(() => {
                              const creator = approvedUsers.find(u => u.userId === invite.createdBy);
                              return creator ? creator.displayName : 'System Admin';
                            })()}
                          </span>
                       </div>
                       
                       <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
                          <span className="text-platinum/30">Status</span>
                          {invite.usedBy ? (
                            <div className="flex flex-col items-end gap-1">
                               <span className="text-green-400 font-bold">Redeemed</span>
                               <span className="text-[9px] text-platinum/40 normal-case italic">
                                 by {(() => {
                                   const redeemer = [...approvedUsers, ...pendingUsers].find(u => u.userId === invite.usedBy);
                                   return redeemer ? redeemer.displayName : 'Unknown Member';
                                 })()}
                               </span>
                            </div>
                          ) : (
                            <span className="text-platinum/30 italic">Available</span>
                          )}
                       </div>

                       <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                          <div className="text-[9px] text-platinum/20">
                            {invite.createdAt ? formatDate(invite.createdAt.toDate()) : 'Recently'}
                          </div>
                          <button 
                            onClick={() => setInviteDeleteConfirm({ show: true, id: invite.id, code: invite.code })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-all flex-shrink-0"
                          >
                             <Trash2 className="w-3.5 h-3.5" /> Delete Code
                          </button>
                       </div>
                    </div>
                </div>
              ))}

              {invites.length === 0 && (
                <div className="p-20 text-center text-platinum/20 col-span-full">
                  <p className="italic">No invite codes have been generated yet.</p>
                </div>
              )}
           </div>
        </section>
      )}

      {activeTab === 'events' && (
        <div className="space-y-12">
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div className="p-8 bg-black/40 border border-white/5 rounded-3xl shadow-2xl">
                <header className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center border border-gold/20">
                    <Calendar className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif">Host Assembly</h2>
                    <p className="text-[10px] uppercase tracking-widest text-platinum/40 font-bold italic">Curate a Society Gathering</p>
                  </div>
                </header>

                <form onSubmit={handleCreateEvent} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-widest text-platinum/40 font-bold ml-1">Event Title</label>
                    <input 
                      required
                      type="text"
                      value={eventForm.title}
                      onChange={e => setEventForm({...eventForm, title: e.target.value})}
                      placeholder="e.g., Midnight Gala at the Archives"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-gold/40 transition-all placeholder:text-platinum/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-widest text-platinum/40 font-bold ml-1">Narrative Description</label>
                    <textarea 
                      required
                      value={eventForm.description}
                      onChange={e => setEventForm({...eventForm, description: e.target.value})}
                      placeholder="Describe the atmosphere and intent..."
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-gold/40 transition-all placeholder:text-platinum/10 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-widest text-platinum/40 font-bold ml-1">Assembly Date</label>
                      <div 
                        onClick={() => {
                          setTempDate(eventForm.date ? eventForm.date.split('T')[0] : '');
                          setTempTime(eventForm.date && eventForm.date.includes('T') ? eventForm.date.split('T')[1] : '');
                          setDateModalOpen(true);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 cursor-pointer hover:bg-white/10 transition-all flex items-center relative overflow-hidden group"
                      >
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-platinum/20 group-hover:text-gold transition-colors" />
                        <span className={cn("text-sm transition-colors", eventForm.date ? "text-white" : "text-platinum/40")}>
                          {eventForm.date ? new Date(eventForm.date).toLocaleString() : "Select Date & Time..."}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-widest text-platinum/40 font-bold ml-1">Venue Style</label>
                      <div className="grid grid-cols-2 p-1 bg-white/5 rounded-2xl border border-white/10">
                        <button
                          type="button"
                          onClick={() => setEventForm({...eventForm, type: 'in-person'})}
                          className={cn(
                            "flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                            eventForm.type === 'in-person' ? "bg-gold text-onyx shadow-lg" : "text-platinum/40"
                          )}
                        >
                          <MapPin className="w-3 h-3" /> In-Person
                        </button>
                        <button
                          type="button"
                          onClick={() => setEventForm({...eventForm, type: 'virtual'})}
                          className={cn(
                            "flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                            eventForm.type === 'virtual' ? "bg-gold text-onyx shadow-lg" : "text-platinum/40"
                          )}
                        >
                          <Globe className="w-3 h-3" /> Virtual
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-widest text-platinum/40 font-bold ml-1">Location Details</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-platinum/20" />
                        <input 
                          required
                          type="text"
                          value={eventForm.location}
                          onChange={e => setEventForm({...eventForm, location: e.target.value})}
                          placeholder={eventForm.type === 'virtual' ? "Meeting Link Or Platform" : "Physical Address or Name"}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-gold/40 transition-all placeholder:text-platinum/10 text-sm"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-widest text-platinum/40 font-bold ml-1">Location URL (Maps/Virtual Link)</label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-platinum/20" />
                        <input 
                          type="url"
                          value={eventForm.locationLink}
                          onChange={e => setEventForm({...eventForm, locationLink: e.target.value})}
                          placeholder="e.g., https://maps.google.com/..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-gold/40 transition-all placeholder:text-platinum/10 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-widest text-platinum/40 font-bold ml-1">Visual Backdrop</label>
                    <div className="flex flex-col gap-4">
                      {/* Image Preview / Selection UI */}
                      <div className="relative group aspect-video rounded-3xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center border-dashed hover:border-gold/30 transition-all">
                        {selectedFile || eventForm.imageUrl ? (
                          <img 
                            src={selectedFile ? URL.createObjectURL(selectedFile) : eventForm.imageUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-platinum/20">
                            <ImageIcon className="w-10 h-10" />
                            <p className="text-[10px] uppercase tracking-widest font-bold">No Image Selected</p>
                          </div>
                        )}
                        
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setSelectedFile(file);
                            }}
                          />
                          <div className="flex flex-col items-center gap-2 text-white">
                            <Upload className="w-8 h-8" />
                            <span className="text-[10px] uppercase tracking-widest font-bold">Upload New Visual</span>
                          </div>
                        </label>
                      </div>

                      {/* Manual URL Input Bypass */}
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-platinum/20" />
                        <input 
                          type="url"
                          value={eventForm.imageUrl}
                          onChange={e => {
                            setEventForm({...eventForm, imageUrl: e.target.value});
                            setSelectedFile(null); // Clear file if URL is provided manually
                          }}
                          placeholder="Or provide a direct image URL..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-gold/40 transition-all placeholder:text-platinum/10 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={savingEvent}
                    className="w-full bg-gold text-onyx py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-gold/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {savingEvent ? "Orchestrating Assembly..." : "Announce Assembly"}
                  </button>
                </form>
              </div>
            </div>

            <div className="space-y-8">
              <section className="bg-black/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full">
                <header className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gold" />
                    <h2 className="text-xl font-serif">Assembly Ledger</h2>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-platinum/10 text-platinum/60 text-[10px] uppercase tracking-widest font-bold">
                    {allEvents.length} Scheduled
                  </span>
                </header>

                <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[800px] custom-scrollbar-minimal">
                  {allEvents.map(event => (
                    <div key={event.id} className="p-6 hover:bg-white/[0.02] transition-colors group">
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                          {event.imageUrl ? (
                            <img src={event.imageUrl} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-20"><Calendar /></div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-serif text-lg text-white truncate">{event.title}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[9px] uppercase tracking-widest font-bold text-gold/60 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {event.location}
                            </span>
                            <span className="text-white/10">•</span>
                            <span className="text-[9px] uppercase tracking-widest font-bold text-platinum/40">
                              {new Date(event.date.toDate()).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="mt-3 text-[11px] text-platinum/40 line-clamp-2 leading-relaxed">
                            {event.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setEventAttendeesModal({ show: true, eventId: event.id, eventTitle: event.title })}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all text-platinum flex items-center gap-2"
                          >
                            <UserIcon className="w-3 h-3" /> Attendees ({attendeeCounts[event.id] || 0})
                          </button>
                          <button 
                            onClick={() => setEventDeleteConfirm({ show: true, id: event.id, title: event.title })}
                            className="p-2 text-platinum/10 hover:text-red-500 transition-colors bg-white/5 rounded-xl hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {allEvents.length === 0 && (
                    <div className="p-20 text-center text-platinum/20 italic">
                      No assemblies are currently on record.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}

      {/* Role Confirmation Modal */}
      <AnimatePresence>
        {newInviteCode && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-onyx/90 backdrop-blur-xl"
               onClick={() => setNewInviteCode(null)}
             />
             <motion.div 
               initial={{ opacity: 0.5, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0.5, scale: 0.9, y: 20 }}
               className="relative w-full max-w-sm bg-black border border-gold/30 rounded-[2.5rem] p-10 text-center shadow-[0_0_50px_rgba(212,175,55,0.15)]"
             >
                <div className="w-20 h-20 bg-gold/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-gold/20">
                   <Ticket className="w-10 h-10 text-gold" />
                </div>
                <h3 className="text-2xl font-serif mb-2">Invite Forged</h3>
                <p className="text-platinum/40 text-xs uppercase tracking-widest font-bold mb-8 italic">New referral credentials active</p>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 group cursor-pointer active:scale-95 transition-all"
                  onClick={() => {
                    navigator.clipboard.writeText(newInviteCode);
                  }}
                >
                   <div className="text-gold font-mono text-2xl tracking-[0.2em] mb-2">{newInviteCode}</div>
                   <div className="flex items-center justify-center gap-2 text-platinum/20 text-[10px] uppercase tracking-widest font-bold group-hover:text-gold transition-colors">
                      <Copy className="w-3 h-3" /> Click to Copy
                   </div>
                </div>

                <button 
                  onClick={() => setNewInviteCode(null)}
                  className="w-full bg-white text-onyx py-4 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-white/90 transition-all shadow-xl"
                >
                  Return to Ledger
                </button>
             </motion.div>
          </div>
        )}

        {confirmModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-onyx/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#1A1A1A] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gold to-platinum" />
              
              <div className="flex items-center gap-4 mb-6">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  confirmModal.currentRole === 'admin' ? "bg-red-400/10 text-red-400" : "bg-gold/10 text-gold"
                )}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-serif">Confirm Role Change</h3>
                  <p className="text-xs text-platinum/40 uppercase tracking-widest font-bold">Security Action Required</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <p className="text-platinum/60 font-light leading-relaxed">
                  You are about to {confirmModal.currentRole === 'admin' ? 'demote' : 'promote'} <span className="text-white font-medium">{confirmModal.userName}</span> to the role of <span className="gold-text font-bold uppercase">{confirmModal.currentRole === 'admin' ? 'Member' : 'Admin'}</span>.
                </p>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-[11px] text-platinum/40 leading-relaxed italic">
                  Admins have full access to membership approvals, event management, and platform oversight. Proceed with discretion.
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 px-6 py-4 rounded-xl border border-white/10 text-platinum/40 hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleToggleRole}
                  className={cn(
                    "flex-1 px-6 py-4 rounded-xl text-onyx font-bold text-xs uppercase tracking-widest shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0",
                    confirmModal.currentRole === 'admin' ? "bg-red-400 shadow-red-400/20" : "bg-gold shadow-gold/20"
                  )}
                >
                  Confirm Change
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {inviteDeleteConfirm.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInviteDeleteConfirm({ show: false, id: '', code: '' })}
              className="absolute inset-0 bg-onyx/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#1A1A1A] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-800" />
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-serif">Revoke Invite</h3>
                  <p className="text-xs text-platinum/40 uppercase tracking-widest font-bold">Rescind Access Credentials</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <p className="text-platinum/60 font-light leading-relaxed">
                  Are you sure you want to delete the invite code <span className="text-gold font-mono">{inviteDeleteConfirm.code}</span>? This action is irreversible and the code will no longer be valid for entry.
                </p>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setInviteDeleteConfirm({ show: false, id: '', code: '' })}
                  className="flex-1 px-6 py-4 rounded-xl border border-white/10 text-platinum/40 hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => deleteInvite(inviteDeleteConfirm.id)}
                  className="flex-1 px-6 py-4 rounded-xl bg-red-500 text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 transition-all hover:bg-red-600"
                >
                  Delete Code
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {eventDeleteConfirm.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEventDeleteConfirm({ show: false, id: '', title: '' })}
              className="absolute inset-0 bg-onyx/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#1A1A1A] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-900" />
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-serif">Cancel Assembly</h3>
                  <p className="text-xs text-platinum/40 uppercase tracking-widest font-bold">Relinquish Event Credentials</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <p className="text-platinum/60 font-light leading-relaxed">
                  Are you certain you wish to dissolve the assembly <span className="text-gold font-serif italic">"{eventDeleteConfirm.title}"</span>? All associated records will be purged from the ledger.
                </p>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setEventDeleteConfirm({ show: false, id: '', title: '' })}
                  className="flex-1 px-6 py-4 rounded-xl border border-white/10 text-platinum/40 hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-widest"
                >
                  Retain
                </button>
                <button 
                  onClick={() => deleteEvent(eventDeleteConfirm.id)}
                  className="flex-1 px-6 py-4 rounded-xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-red-600/20 transition-all hover:bg-red-700"
                >
                  Dissolve Event
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {eventAttendeesModal?.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEventAttendeesModal(null)}
              className="absolute inset-0 bg-onyx/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#1A1A1A] p-5 shadow-2xl sm:p-6 lg:p-8"
            >
              <div className="sticky top-0 z-10 mb-4 flex items-start justify-between gap-4 border-b border-white/5 bg-[#1A1A1A] pb-4">
                <div className="min-w-0">
                  <h3 className="truncate pr-2 text-xl font-serif text-gold sm:text-2xl">{eventAttendeesModal.eventTitle}</h3>
                  <p className="text-xs text-platinum/40 uppercase tracking-widest font-bold mt-1">Confirmed Attendees</p>
                  <p className="mt-2 text-[11px] uppercase tracking-widest text-platinum/30">{eventAttendees.length} confirmed reservations</p>
                </div>
                <button 
                  onClick={() => setEventAttendeesModal(null)}
                  className="rounded-full bg-white/5 p-2 transition-colors hover:bg-white/10"
                >
                  <XCircle className="w-5 h-5 text-platinum" />
                </button>
              </div>

              <div className="custom-scrollbar-minimal min-h-[220px] flex-1 overflow-y-auto pr-1 sm:pr-2">
                {loadingAttendees ? (
                  <div className="flex justify-center items-center h-full min-h-[100px]">
                    <div className="w-6 h-6 border-2 border-gold rounded-full border-t-transparent animate-spin" />
                  </div>
                ) : eventAttendees.length === 0 ? (
                  <div className="text-center text-platinum/40 italic py-10">
                    No members have RSVP'd to this assembly yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {eventAttendees.map((attendee) => (
                      <div key={attendee.userId} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-4">
                        <Avatar
                          name={attendee.displayName}
                          src={attendee.photoURL}
                          className="h-10 w-10 flex-shrink-0 rounded-xl bg-white/10"
                          textClassName="text-sm"
                          presenceStatus={getPresence(attendee.userId).status}
                          showPresence
                          presenceClassName="h-2.5 w-2.5 border"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-serif text-white truncate">{attendee.displayName}</h4>
                          <p className="text-[9px] text-platinum/40 uppercase tracking-widest mt-1">
                            Reserved {attendee.registeredAt ? formatDate(attendee.registeredAt.toDate()) : 'Recently'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {dateModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDateModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#1A1A1A] border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col gap-6"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4 border border-gold/20">
                  <Calendar className="w-6 h-6 text-gold" />
                </div>
                <h3 className="text-2xl font-serif mb-1">Schedule Assembly</h3>
                <p className="text-[10px] text-platinum/40 uppercase tracking-widest font-bold">Select Date & Time</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-platinum/40 font-bold ml-1">Date</label>
                  <input 
                    type="date"
                    value={tempDate}
                    onChange={e => setTempDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-gold/40 transition-all text-sm"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-platinum/40 font-bold ml-1">Time</label>
                  <input 
                    type="time"
                    value={tempTime}
                    onChange={e => setTempTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-gold/40 transition-all text-sm"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>

              <button 
                onClick={() => {
                  if (tempDate && tempTime) {
                    setEventForm({...eventForm, date: `${tempDate}T${tempTime}`});
                    setDateModalOpen(false);
                  } else {
                    alert("Please select both date and time.");
                  }
                }}
                className="w-full bg-gold text-onyx py-4 rounded-xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-gold/20 hover:bg-gold/90 transition-all mt-4 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
