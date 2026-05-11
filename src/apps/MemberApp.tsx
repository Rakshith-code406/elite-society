import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  MessageSquare, 
  ShieldCheck, 
  LogOut, 
  User as UserIcon,
  Crown,
  Menu,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';
import Avatar from '../components/Avatar';
import { usePresence } from '../context/PresenceContext';

// Views
import MemberDirectory from '../views/MemberDirectory';
import EventsBoard from '../views/EventsBoard';
import MessagesView from '../views/MessagesView';
import ProfileView from '../views/ProfileView';

interface MemberAppProps {
  profile: UserProfile;
  onLogout: () => void;
  onSwitchToAdmin?: () => void;
  onPresenceIntentChange: (intent: 'online' | 'busy') => void;
}

export default function MemberApp({ profile, onLogout, onSwitchToAdmin, onPresenceIntentChange }: MemberAppProps) {
  const [activeTab, setActiveTab] = useState<'directory' | 'events' | 'messages' | 'profile'>('directory');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { getPresence, getPresenceText } = usePresence();

  const currentPresence = getPresence(profile.userId);

  useEffect(() => {
    if (activeTab !== 'messages') setTargetUserId(null);
  }, [activeTab]);

  useEffect(() => {
    onPresenceIntentChange(activeTab === 'messages' ? 'busy' : 'online');
  }, [activeTab, onPresenceIntentChange]);

  const handleMessageUser = (userId: string) => {
    setTargetUserId(userId);
    setActiveTab('messages');
  };

  return (
    <div className="min-h-screen bg-onyx flex flex-col md:flex-row overflow-hidden h-screen">
      {/* Editorial Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-[#0C0C0C]/50 border-r border-white/5 p-8 h-full sticky top-0 backdrop-blur-3xl">
        <div className="flex items-center gap-4 mb-16 px-2">
          <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <Crown className="w-6 h-6 text-onyx" />
          </div>
          <div>
            <span className="block font-serif text-2xl tracking-tighter text-white">The Sanctuary</span>
            <span className="block text-[10px] uppercase tracking-[0.3em] font-black text-gold/60 mt-0.5">Society Member</span>
          </div>
        </div>

        <nav className="flex-1 space-y-3">
          <MemberNavItem 
            active={activeTab === 'directory'} 
            onClick={() => setActiveTab('directory')} 
            icon={<Users className="w-5 h-5" />} 
            label="Member Directory" 
          />
          <MemberNavItem 
            active={activeTab === 'events'} 
            onClick={() => setActiveTab('events')} 
            icon={<Calendar className="w-5 h-5" />} 
            label="Events Board" 
          />
          <MemberNavItem 
            active={activeTab === 'messages'} 
            onClick={() => setActiveTab('messages')} 
            icon={<MessageSquare className="w-5 h-5" />} 
            label="Communications" 
          />
          
          {profile.role === 'admin' && onSwitchToAdmin && (
            <div className="pt-8 mt-8 border-t border-white/5">
              <button 
                onClick={onSwitchToAdmin}
                className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 hover:bg-orange-500 hover:text-white transition-all group"
              >
                <ShieldCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-widest text-left leading-tight">Switch to Admin Command Center</span>
              </button>
            </div>
          )}
        </nav>

        <div className="pt-8 border-t border-white/5">
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn(
              "flex items-center gap-4 w-full p-3 rounded-2xl transition-all duration-300",
              activeTab === 'profile' ? "bg-white/5 text-gold border border-white/10" : "text-platinum/40 hover:text-white"
            )}
          >
            <Avatar
              name={profile.displayName}
              src={profile.photoURL}
              className={cn(
                "w-10 h-10 rounded-full border-2 transition-all",
                activeTab === 'profile' ? "border-gold shadow-[0_0_10px_rgba(212,175,55,0.3)]" : "border-transparent"
              )}
              textClassName="text-base"
              presenceStatus={currentPresence.status}
              showPresence
            />
            <div className="flex-1 text-left items-center overflow-hidden">
               <p className="text-sm font-bold truncate">{profile.displayName}</p>
               <p className="text-[10px] uppercase tracking-widest text-platinum/40">{getPresenceText(profile.userId)}</p>
            </div>
          </button>
          
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 w-full p-4 mt-4 text-platinum/20 hover:text-red-500 transition-colors text-[10px] font-bold uppercase tracking-widest group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Sanctuary Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-onyx relative overflow-hidden h-[calc(100vh-64px)] md:h-screen">
        {/* Dynamic Header */}
        <header className="h-20 border-b border-white/5 bg-onyx/50 backdrop-blur-2xl px-6 md:px-12 flex items-center justify-between sticky top-0 z-40">
           <div className="flex items-center gap-4">
              <div className="md:hidden w-10 h-10 rounded-xl bg-gold flex items-center justify-center ring-4 ring-gold/10">
                <Crown className="w-6 h-6 text-onyx" />
              </div>
              <div className="overflow-hidden">
                 <h2 className="text-sm font-black uppercase tracking-[0.4em] text-gold leading-none truncate">
                    {activeTab === 'directory' && "Member Archives"}
                    {activeTab === 'events' && "Future Assemblies"}
                    {activeTab === 'messages' && "Correspondences"}
                    {activeTab === 'profile' && "User Sanctum"}
                 </h2>
                 <p className="text-[9px] text-platinum/20 uppercase tracking-[0.5em] mt-2 hidden sm:block">
                    Elite Society Sanctuary Protocol v1.4
                 </p>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end px-4 border-r border-white/5">
                <span className="text-[10px] font-mono text-gold/40">CURRENT_STATUS</span>
                <span className="text-[11px] font-bold text-platinum/60 uppercase tracking-widest">{getPresenceText(profile.userId)}</span>
              </div>
              
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 text-platinum/60"
              >
                <Menu className="w-6 h-6" />
              </button>
           </div>
        </header>

        <div className={cn(
          "flex-1 custom-scrollbar-minimal pb-16 md:pb-0",
          activeTab === 'messages' ? "overflow-hidden" : "overflow-y-auto"
        )}>
           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, scale: 0.98, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 1.02, y: -10 }}
               transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
               className="p-6 md:p-12 max-w-6xl mx-auto"
             >
                {activeTab === 'directory' && <MemberDirectory currentUser={profile} onMessageUser={handleMessageUser} />}
                {activeTab === 'events' && <EventsBoard currentUser={profile} />}
                {activeTab === 'messages' && <MessagesView currentUser={profile} initialTargetUserId={targetUserId} />}
                {activeTab === 'profile' && <ProfileView profile={profile} onLogout={onLogout} />}
             </motion.div>
           </AnimatePresence>
        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#080808]/90 backdrop-blur-2xl border-t border-white/5 flex items-center justify-around px-4 z-[60]">
        <BottomNavItem 
          active={activeTab === 'directory'} 
          onClick={() => setActiveTab('directory')} 
          icon={<Users className="w-5 h-5" />} 
          label="Archives" 
        />
        <BottomNavItem 
          active={activeTab === 'events'} 
          onClick={() => setActiveTab('events')} 
          icon={<Calendar className="w-5 h-5" />} 
          label="Assemblies" 
        />
        <BottomNavItem 
          active={activeTab === 'messages'} 
          onClick={() => setActiveTab('messages')} 
          icon={<MessageSquare className="w-5 h-5" />} 
          label="Comm" 
        />
        <BottomNavItem 
          active={activeTab === 'profile'} 
          onClick={() => setActiveTab('profile')} 
          icon={
            <Avatar
              name={profile.displayName}
              src={profile.photoURL}
              className="h-5 w-5 rounded-full border border-white/20"
              textClassName="text-[9px]"
              presenceStatus={currentPresence.status}
              showPresence
              presenceClassName="h-2 w-2 border"
            />
          } 
          label="Sanctum" 
        />
      </nav>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] md:hidden"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-[80%] bg-[#080808] z-[101] p-8 border-l border-white/10 md:hidden flex flex-col"
            >
              <div className="flex justify-between items-center mb-12">
                <span className="font-serif text-xl gold-text">Navigation</span>
                <button onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
              </div>

              <nav className="flex-1 space-y-6">
                <MobileLink active={activeTab === 'directory'} onClick={() => { setActiveTab('directory'); setIsMobileMenuOpen(false); }} label="Archives" icon={<Users />} />
                <MobileLink active={activeTab === 'events'} onClick={() => { setActiveTab('events'); setIsMobileMenuOpen(false); }} label="Assemblies" icon={<Calendar />} />
                <MobileLink active={activeTab === 'messages'} onClick={() => { setActiveTab('messages'); setIsMobileMenuOpen(false); }} label="Conversations" icon={<MessageSquare />} />
                <MobileLink active={activeTab === 'profile'} onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }} label="My Sanctum" icon={<UserIcon />} />
                
                {profile.role === 'admin' && onSwitchToAdmin && (
                  <button 
                    onClick={onSwitchToAdmin}
                    className="w-full mt-12 p-6 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 font-bold uppercase tracking-[0.2em] text-[10px]"
                  >
                    Admin Command Center
                  </button>
                )}
              </nav>

              <button 
                onClick={onLogout}
                className="mt-auto p-4 flex items-center gap-3 text-platinum/20 font-bold uppercase tracking-widest text-[10px]"
              >
                <LogOut className="w-4 h-4" /> Relinquish Access
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemberNavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 w-full px-5 py-4 rounded-2xl transition-all duration-500 outline-none group relative overflow-hidden",
        active 
          ? "bg-gold/10 text-gold border border-gold/20 shadow-[0_0_20px_rgba(212,175,55,0.1)]" 
          : "text-platinum/40 hover:bg-white/[0.03] hover:text-platinum/80"
      )}
    >
      <div className={cn("transition-transform duration-500", active && "scale-110")}>
        {icon}
      </div>
      <span className="text-xs font-bold uppercase tracking-[0.2em]">{label}</span>
      
      {active && (
        <motion.div 
          layoutId="active-marker"
          className="ml-auto w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_10px_#D4AF37]" 
        />
      )}
      
      {!active && <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.02] transition-opacity" />}
    </button>
  );
}

function MobileLink({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-6 text-2xl font-serif transition-colors w-full text-left", active ? "text-gold" : "text-platinum/20")}>
      <span className={cn(active ? "text-gold" : "text-platinum/10")}>{icon}</span>
      {label}
    </button>
  );
}

function BottomNavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 transition-all duration-300 relative",
        active ? "text-gold" : "text-platinum/40"
      )}
    >
      <div className={cn("transition-transform duration-300", active && "scale-110 -translate-y-0.5")}>
        {icon}
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      {active && (
        <motion.div 
          layoutId="bottom-nav-indicator"
          className="absolute -bottom-1 w-1 h-1 rounded-full bg-gold shadow-[0_0_10px_#D4AF37]" 
        />
      )}
    </button>
  );
}
