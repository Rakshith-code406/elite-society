import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp as rtdbServerTimestamp,
  set,
  update,
} from 'firebase/database';
import { User } from 'firebase/auth';
import { PresenceRecord, PresenceStatus, UserProfile } from '../types';
import {
  aggregatePresenceNode,
  buildOfflinePresence,
  createPresenceRecord,
  getPresenceLabel,
  PRESENCE_ACTIVITY_THROTTLE_MS,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_IDLE_MS,
  PRESENCE_ROOT,
} from '../lib/presence';
import { rtdb } from '../lib/firebase';

type PresenceIntent = 'online' | 'busy';

interface PresenceContextValue {
  presenceMap: Record<string, PresenceRecord>;
  getPresence: (userId?: string | null) => PresenceRecord;
  getPresenceText: (userId?: string | null) => string;
  getPresenceStatus: (userId?: string | null) => PresenceStatus;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({
  user,
  profile,
  intent,
  children,
}: {
  user: User;
  profile: UserProfile;
  intent: PresenceIntent;
  children: React.ReactNode;
}) {
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceRecord>>({});
  const [selfPresence, setSelfPresence] = useState<PresenceRecord>(
    createPresenceRecord(intent === 'busy' ? 'busy' : 'online', {
      isChatting: intent === 'busy',
      isVisible: true,
      lastChangedAt: Date.now(),
      lastActiveAt: Date.now(),
      lastSeenAt: null,
    })
  );

  usePresenceSync({
    userId: user.uid,
    intent,
    onLocalPresenceChange: setSelfPresence,
  });

  useEffect(() => {
    const presenceRef = ref(rtdb, PRESENCE_ROOT);
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const raw = snapshot.val() || {};
      const nextMap: Record<string, PresenceRecord> = {};

      Object.entries(raw).forEach(([key, value]) => {
        nextMap[key] = aggregatePresenceNode(value);
      });

      setPresenceMap(nextMap);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo<PresenceContextValue>(() => {
    const resolvePresence = (userId?: string | null): PresenceRecord => {
      if (!userId) return buildOfflinePresence();

      if (userId === profile.userId) {
        return selfPresence;
      }

      return presenceMap[userId] || buildOfflinePresence();
    };

    return {
      presenceMap,
      getPresence: resolvePresence,
      getPresenceStatus: (userId?: string | null) => resolvePresence(userId).status,
      getPresenceText: (userId?: string | null) => getPresenceLabel(resolvePresence(userId)),
    };
  }, [presenceMap, profile.userId, selfPresence]);

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}

function usePresenceSync({
  userId,
  intent,
  onLocalPresenceChange,
}: {
  userId: string;
  intent: PresenceIntent;
  onLocalPresenceChange: (presence: PresenceRecord) => void;
}) {
  const lastInteractionRef = useRef(Date.now());
  const lastWriteRef = useRef(0);
  const latestStatusRef = useRef<PresenceStatus>('offline');
  const heartbeatRef = useRef<number | null>(null);
  const idleRef = useRef<number | null>(null);
  const connectedRefValue = useRef(false);
  const browserOnlineRef = useRef(typeof navigator === 'undefined' ? true : navigator.onLine);
  const sessionIdRef = useRef(`session_${Math.random().toString(36).slice(2)}_${Date.now()}`);

  useEffect(() => {
    const sessionId = sessionIdRef.current;
    const userPresenceRef = ref(rtdb, `${PRESENCE_ROOT}/${userId}`);
    const sessionPresenceRef = ref(rtdb, `${PRESENCE_ROOT}/${userId}/sessions/${sessionId}`);
    const connectedInfoRef = ref(rtdb, '.info/connected');

    const computeStatus = (): PresenceStatus => {
      const isIdle = Date.now() - lastInteractionRef.current > PRESENCE_IDLE_MS;
      if (!browserOnlineRef.current || document.hidden || isIdle) return 'offline';
      return intent === 'busy' ? 'busy' : 'online';
    };

    const publishLocalPresence = (status: PresenceStatus) => {
      const now = Date.now();
      const localPresence = createPresenceRecord(status, {
        isChatting: status === 'busy',
        isVisible: !document.hidden,
        lastChangedAt: now,
        lastActiveAt: now,
        lastSeenAt: status === 'offline' ? now : null,
      });
      onLocalPresenceChange(localPresence);
    };

    const syncPresence = async (force = false) => {
      const status = computeStatus();
      const now = Date.now();

      publishLocalPresence(status);

      if (!connectedRefValue.current) {
        latestStatusRef.current = status;
        return;
      }

      if (!force && status === latestStatusRef.current && now - lastWriteRef.current < PRESENCE_ACTIVITY_THROTTLE_MS) {
        return;
      }

      const payload: Record<string, unknown> = {
        status,
        isChatting: status === 'busy',
        isVisible: !document.hidden,
        connected: status !== 'offline',
        lastActiveAt: rtdbServerTimestamp(),
        lastSeenAt: status === 'offline' ? rtdbServerTimestamp() : null,
      };

      if (status !== latestStatusRef.current || force) {
        payload.lastChangedAt = rtdbServerTimestamp();
      }

      latestStatusRef.current = status;
      lastWriteRef.current = now;
      await update(sessionPresenceRef, payload);
      await update(userPresenceRef, {
        lastHeartbeatAt: rtdbServerTimestamp(),
      });
    };

    const resetIdleTimer = () => {
      if (idleRef.current) window.clearTimeout(idleRef.current);
      idleRef.current = window.setTimeout(() => {
        void syncPresence(true);
      }, PRESENCE_IDLE_MS + 250);
    };

    const markActivity = () => {
      lastInteractionRef.current = Date.now();
      resetIdleTimer();
      void syncPresence();
    };

    const connectedUnsubscribe = onValue(connectedInfoRef, async (snapshot) => {
      const isConnected = !!snapshot.val();
      connectedRefValue.current = isConnected;

      if (!isConnected) {
        return;
      }

      await onDisconnect(sessionPresenceRef).update({
        status: 'offline',
        connected: false,
        isChatting: false,
        isVisible: false,
        lastChangedAt: rtdbServerTimestamp(),
        lastSeenAt: rtdbServerTimestamp(),
      });

      await set(sessionPresenceRef, {
        status: intent === 'busy' ? 'busy' : 'online',
        connected: true,
        isChatting: intent === 'busy',
        isVisible: !document.hidden,
        lastChangedAt: rtdbServerTimestamp(),
        lastActiveAt: rtdbServerTimestamp(),
        lastSeenAt: null,
      });

      latestStatusRef.current = intent === 'busy' ? 'busy' : 'online';
      lastWriteRef.current = Date.now();
      lastInteractionRef.current = Date.now();
      resetIdleTimer();
      publishLocalPresence(latestStatusRef.current);
    });

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        lastInteractionRef.current = Date.now();
      }
      resetIdleTimer();
      void syncPresence(true);
    };

    const handleBrowserOnline = () => {
      browserOnlineRef.current = true;
      lastInteractionRef.current = Date.now();
      resetIdleTimer();
      void syncPresence(true);
    };

    const handleBrowserOffline = () => {
      browserOnlineRef.current = false;
      publishLocalPresence('offline');
      if (connectedRefValue.current) {
        void update(sessionPresenceRef, {
          status: 'offline',
          connected: false,
          isChatting: false,
          isVisible: false,
          lastChangedAt: rtdbServerTimestamp(),
          lastSeenAt: rtdbServerTimestamp(),
        });
      }
    };

    const handlePageHide = () => {
      publishLocalPresence('offline');
      if (connectedRefValue.current) {
        void update(sessionPresenceRef, {
          status: 'offline',
          connected: false,
          isChatting: false,
          isVisible: false,
          lastChangedAt: rtdbServerTimestamp(),
          lastSeenAt: rtdbServerTimestamp(),
        });
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointermove',
      'pointerdown',
      'keydown',
      'scroll',
      'touchstart',
      'focus',
    ];

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, markActivity, { passive: true })
    );
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    heartbeatRef.current = window.setInterval(() => {
      if (!document.hidden) {
        void syncPresence(true);
      }
    }, PRESENCE_HEARTBEAT_MS);

    publishLocalPresence(computeStatus());
    void syncPresence(true);

    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      if (idleRef.current) window.clearTimeout(idleRef.current);
      connectedUnsubscribe();
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);

      publishLocalPresence('offline');
      if (connectedRefValue.current) {
        void update(sessionPresenceRef, {
          status: 'offline',
          connected: false,
          isChatting: false,
          isVisible: false,
          lastChangedAt: rtdbServerTimestamp(),
          lastSeenAt: rtdbServerTimestamp(),
        });
      }
    };
  }, [intent, onLocalPresenceChange, userId]);
}
