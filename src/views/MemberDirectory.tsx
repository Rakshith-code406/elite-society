import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { Search, Filter, MessageSquare, MapPin, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import Avatar from '../components/Avatar';
import { usePresence } from '../context/PresenceContext';
import { getPresenceTone } from '../lib/presence';

export default function MemberDirectory({ currentUser, onMessageUser }: { currentUser: UserProfile, onMessageUser: (userId: string) => void }) {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const { getPresence, getPresenceText } = usePresence();

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('status', '==', 'approved'),
      orderBy('displayName', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ userId: doc.id, ...doc.data() } as UserProfile));
      setMembers(list.filter(m => m.userId !== currentUser.userId));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser.userId]);

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (m.bio || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || m.interests.includes(filter);
    return matchesSearch && matchesFilter;
  });

  const allInterests = Array.from(new Set(members.flatMap(m => m.interests)));

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <h1 className="text-3xl md:text-5xl font-serif mb-2">Member Directory</h1>
           <p className="text-sm md:text-base text-platinum/40 font-light italic">Connecting the society's most remarkable minds.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative group flex-1 md:w-64">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-platinum/20 group-focus-within:text-gold transition-colors" />
             <input 
               type="text" 
               placeholder="Search members..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-white/5 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-gold/30 transition-all font-light"
             />
          </div>
          <div className="relative md:w-48">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-platinum/20" />
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-gold/30 transition-all font-light appearance-none"
            >
              <option value="all">All Interests</option>
              {allInterests.map(i => (
                <option key={i} value={i} className="bg-onyx">{i.charAt(0).toUpperCase() + i.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-64 bg-white/5 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
          {filteredMembers.map((member) => (
            <MemberCard
              key={member.userId}
              member={member}
              onMessage={() => onMessageUser(member.userId)}
              presenceText={getPresenceText(member.userId)}
              presenceStatus={getPresence(member.userId).status}
            />
          ))}
        </div>
      )}

      {!loading && filteredMembers.length === 0 && (
        <div className="py-20 text-center">
           <MapPin className="w-12 h-12 text-platinum/20 mx-auto mb-4" />
           <p className="text-platinum/40 italic">No society members found matching your curation.</p>
        </div>
      )}
    </div>
  );
}

function MemberCard({
  member,
  onMessage,
  presenceText,
  presenceStatus,
}: {
  member: UserProfile;
  onMessage: () => void;
  presenceText: string;
  presenceStatus: UserProfile['presenceStatus'];
}) {
  return (
    <motion.div
      whileHover={{ 
        y: -8, 
        scale: 1.02,
        boxShadow: "0 20px 40px -15px rgba(0,0,0,0.5), 0 0 20px rgba(212,175,55,0.1)"
      }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className="group relative bg-white/5 border border-white/5 rounded-2xl p-6 transition-all hover:bg-white/[0.08] hover:border-gold/30 overflow-hidden shadow-xl"
    >
      <div className="absolute top-0 left-0 w-2 h-full bg-gold/10 group-hover:bg-gold/60 transition-colors duration-500" />
      
      <div className="flex items-start justify-between mb-4">
        <div className="relative">
          <Avatar
            name={member.displayName}
            src={member.photoURL}
            className="h-20 w-20 rounded-2xl bg-white/10"
            textClassName="text-3xl"
            presenceStatus={presenceStatus || 'offline'}
            showPresence
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
        </div>
        <button 
          onClick={onMessage}
          className="p-2 rounded-full border border-white/5 text-platinum/40 hover:text-gold hover:border-gold/40 transition-all font-sans"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-serif text-white group-hover:text-gold transition-colors">{member.displayName}</h3>
            {member.verificationStatus === 'verified' && (
              <div className="w-5 h-5 bg-gold rounded-full flex items-center justify-center text-onyx shadow-[0_0_10px_rgba(212,175,55,0.3)] flex-shrink-0" title="Verified Member">
                 <Check className="w-3 h-3 stroke-[3]" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gold/60 font-semibold">Member</p>
            <span className="w-1 h-1 rounded-full bg-platinum/20" />
            <span className={cn("text-[9px] uppercase tracking-widest font-bold", getPresenceTone(presenceStatus || 'offline'))}>
              {presenceText}
            </span>
          </div>
          <p className="text-xs text-platinum/60 leading-relaxed italic font-light line-clamp-3">
             "{member.bio || 'A polished member bio will appear here soon.'}"
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {member.interests.slice(0, 3).map(interest => (
            <span key={interest} className="text-[9px] uppercase tracking-widest px-2 py-1 rounded bg-white/5 border border-white/5 text-platinum/40">
              {interest}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
