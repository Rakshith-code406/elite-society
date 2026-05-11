import { formatDistanceToNowStrict } from 'date-fns';
import { PresenceRecord, PresenceStatus } from '../types';

export const PRESENCE_ROOT = 'presence';
export const PRESENCE_IDLE_MS = 90_000;
export const PRESENCE_HEARTBEAT_MS = 45_000;
export const PRESENCE_ACTIVITY_THROTTLE_MS = 15_000;

export function buildOfflinePresence(): PresenceRecord {
  return {
    status: 'offline',
    isChatting: false,
    isVisible: false,
    lastChangedAt: null,
    lastActiveAt: null,
    lastSeenAt: null,
  };
}

export function getPresenceStatus(record?: Partial<PresenceRecord> | null): PresenceStatus {
  if (!record?.status) return 'offline';
  return record.status;
}

export function createPresenceRecord(
  status: PresenceStatus,
  overrides: Partial<PresenceRecord> = {}
): PresenceRecord {
  return {
    ...buildOfflinePresence(),
    status,
    ...overrides,
  };
}

export function aggregatePresenceNode(node: unknown): PresenceRecord {
  if (!node || typeof node !== 'object') {
    return buildOfflinePresence();
  }

  const rawNode = node as {
    sessions?: Record<string, Partial<PresenceRecord> & { connected?: boolean }>;
    lastSeenAt?: number | null;
    status?: PresenceStatus;
    isChatting?: boolean;
    isVisible?: boolean;
    lastChangedAt?: number | null;
    lastActiveAt?: number | null;
  };

  if (!rawNode.sessions) {
    return {
      ...buildOfflinePresence(),
      ...rawNode,
      status: getPresenceStatus(rawNode),
    };
  }

  const sessions = Object.values(rawNode.sessions);
  const activeSessions = sessions.filter((session) => session.connected && session.status && session.status !== 'offline');
  const busySessions = activeSessions.filter((session) => session.status === 'busy');
  const onlineSessions = activeSessions.filter((session) => session.status === 'online');

  const status: PresenceStatus =
    busySessions.length > 0 ? 'busy' : onlineSessions.length > 0 ? 'online' : 'offline';

  const allLastSeen = sessions
    .map((session) => session.lastSeenAt || null)
    .filter((value): value is number => typeof value === 'number');
  const allLastActive = sessions
    .map((session) => session.lastActiveAt || null)
    .filter((value): value is number => typeof value === 'number');
  const allLastChanged = sessions
    .map((session) => session.lastChangedAt || null)
    .filter((value): value is number => typeof value === 'number');

  return createPresenceRecord(status, {
    isChatting: busySessions.length > 0,
    isVisible: activeSessions.some((session) => !!session.isVisible),
    lastSeenAt: allLastSeen.length > 0 ? Math.max(...allLastSeen) : rawNode.lastSeenAt || null,
    lastActiveAt: allLastActive.length > 0 ? Math.max(...allLastActive) : null,
    lastChangedAt: allLastChanged.length > 0 ? Math.max(...allLastChanged) : null,
  });
}

export function getPresenceLabel(record?: Partial<PresenceRecord> | null) {
  const status = getPresenceStatus(record);
  if (status === 'busy') return 'Currently chatting';
  if (status === 'online') return 'Online now';

  if (record?.lastSeenAt) {
    return `Last seen ${formatDistanceToNowStrict(record.lastSeenAt, { addSuffix: true })}`;
  }

  return 'Offline';
}

export function getPresenceTone(status?: PresenceStatus) {
  switch (status) {
    case 'online':
      return 'text-emerald-400';
    case 'busy':
      return 'text-rose-400';
    default:
      return 'text-platinum/45';
  }
}
