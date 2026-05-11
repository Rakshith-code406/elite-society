import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Crown,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';
import AdminDashboard from '../views/AdminDashboard';
import ProfileView from '../views/ProfileView';
import Avatar from '../components/Avatar';
import { usePresence } from '../context/PresenceContext';

interface AdminAppProps {
  profile: UserProfile;
  onLogout: () => void;
  onSwitchToMember: () => void;
  onPresenceIntentChange: (intent: 'online' | 'busy') => void;
}

export default function AdminApp({ profile, onLogout, onSwitchToMember, onPresenceIntentChange }: AdminAppProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { getPresence, getPresenceText } = usePresence();

  useEffect(() => {
    onPresenceIntentChange('online');
  }, [onPresenceIntentChange]);

  const currentPresence = getPresence(profile.userId);

  return (
    <div className="flex min-h-screen overflow-hidden bg-[#0A0A0A] font-sans text-slate-200">
      <aside
        className={cn(
          'z-50 flex flex-col border-r border-white/5 bg-[#111] transition-all duration-300',
          isSidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/5 bg-black/20 p-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 shadow-lg shadow-orange-600/20">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          {isSidebarOpen && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="text-sm font-black uppercase tracking-tighter text-white">Command Center</h1>
              <p className="font-mono text-[10px] font-bold uppercase text-orange-500">Root Admin v2.0</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <AdminNavItem
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard className="h-5 w-5" />}
            label="Operations"
            collapsed={!isSidebarOpen}
          />
          <AdminNavItem
            active={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
            icon={<UserIcon className="h-5 w-5" />}
            label="My Profile"
            collapsed={!isSidebarOpen}
          />

          <div className="my-6 border-t border-white/5 pt-6">
            <AdminNavItem
              active={false}
              onClick={onSwitchToMember}
              icon={<Crown className="h-5 w-5" />}
              label="Switch to Sanctuary"
              collapsed={!isSidebarOpen}
              variant="special"
            />
          </div>
        </nav>

        <div className="space-y-2 border-t border-white/5 p-4">
          <button
            onClick={onLogout}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg p-3 text-slate-500 transition-all hover:bg-red-500/10 hover:text-red-500',
              !isSidebarOpen && 'justify-center'
            )}
          >
            <LogOut className="h-5 w-5" />
            {isSidebarOpen && <span className="text-sm font-bold uppercase tracking-widest">Terminate Session</span>}
          </button>
        </div>
      </aside>

      <main className="relative flex h-[calc(100vh-64px)] min-w-0 flex-1 flex-col bg-[#0F0F0F] md:h-screen">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/5 bg-[#111]/50 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden h-4 w-px bg-white/10 sm:block" />
            <div className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 sm:flex">
              <span className="text-orange-500/50">ES_SYSTEM</span>
              <span className="text-white/20">/</span>
              <span>{activeTab}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                {getPresenceText(profile.userId)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right xs:block">
                <p className="text-xs font-bold leading-none text-white">{profile.displayName}</p>
                <p className="mt-1 font-mono text-[9px] uppercase text-orange-500">Verified Authority</p>
              </div>
              <Avatar
                name={profile.displayName}
                src={profile.photoURL}
                className="h-8 w-8 rounded-lg border border-white/20"
                textClassName="text-xs"
                presenceStatus={currentPresence.status}
                showPresence
                presenceClassName="h-2.5 w-2.5 border"
              />
            </div>
          </div>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto pb-16 md:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-auto max-w-7xl p-8"
            >
              {activeTab === 'dashboard' && <AdminDashboard />}
              {activeTab === 'profile' && <ProfileView profile={profile} onLogout={onLogout} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="flex h-8 items-center justify-between border-t border-white/5 bg-[#0A0A0A] px-4 font-mono text-[10px] uppercase tracking-tighter text-slate-600">
          <div className="flex gap-4">
            <span>DB_STATUS: <span className="text-green-500/60">CONNECTED</span></span>
            <span>NETWORK: <span className="text-green-500/60">ENCRYPTED</span></span>
          </div>
          <div className="flex gap-4">
            <span>STATUS: <span className="text-white/30">{getPresenceText(profile.userId).toUpperCase()}</span></span>
            <span>SESSION_ID: <span className="text-white/10">{Math.random().toString(36).substring(7).toUpperCase()}</span></span>
            <span>(C) ELITE_SOCIETY_ADMIN_V2</span>
          </div>
        </footer>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-[60] flex h-16 items-center justify-around border-t border-white/5 bg-[#0C0C0C]/90 px-4 backdrop-blur-2xl md:hidden">
        <BottomNavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard className="h-5 w-5" />} label="Ops" />
        <BottomNavItem active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon className="h-5 w-5" />} label="Profile" />
        <BottomNavItem active={false} onClick={onSwitchToMember} icon={<Crown className="h-5 w-5" />} label="Sanctuary" />
      </nav>
    </div>
  );
}

function AdminNavItem({
  active,
  onClick,
  icon,
  label,
  collapsed,
  variant = 'default',
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  variant?: 'default' | 'special';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-xl p-3 outline-none transition-all duration-200',
        active ? 'border border-orange-500/20 bg-orange-500/10 text-orange-500' : 'text-slate-500 hover:bg-white/5 hover:text-white',
        variant === 'special' && !active && 'border border-transparent text-gold/60 hover:border-gold/20 hover:bg-gold/10 hover:text-gold'
      )}
    >
      <div className={cn('transition-transform group-hover:scale-110', active && 'scale-110')}>{icon}</div>
      {!collapsed && <span className="truncate text-xs font-bold uppercase tracking-widest">{label}</span>}
      {active && !collapsed && <div className="ml-auto h-4 w-1 rounded-full bg-orange-500" />}

      {collapsed && (
        <div className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded border border-white/10 bg-black px-2 py-1 font-mono text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 z-[100]">
          {label}
        </div>
      )}
    </button>
  );
}

function BottomNavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn('relative flex flex-col items-center justify-center gap-1 transition-all duration-300', active ? 'text-orange-500' : 'text-slate-500')}
    >
      <div className={cn('transition-transform duration-300', active && 'scale-110 -translate-y-0.5')}>{icon}</div>
      <span className="text-[9px] font-bold uppercase tracking-widest leading-none">{label}</span>
      {active && (
        <motion.div
          layoutId="admin-bottom-nav-indicator"
          className="absolute -bottom-1 h-1 w-1 rounded-full bg-orange-500 shadow-[0_0_10px_#EA580C]"
        />
      )}
    </button>
  );
}
