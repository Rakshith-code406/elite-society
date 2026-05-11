import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Database, getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

function isPlaceholderValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized.includes('your_') ||
    normalized.includes('my_') ||
    normalized.includes('example') ||
    normalized === 'changeme'
  );
}

function getValidRealtimeDatabaseUrl() {
  const candidates = [
    (firebaseConfig as { databaseURL?: string }).databaseURL,
    import.meta.env.VITE_FIREBASE_DATABASE_URL,
    firebaseConfig.projectId ? `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com` : undefined,
  ];

  for (const candidate of candidates) {
    if (!candidate || isPlaceholderValue(candidate)) {
      continue;
    }

    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.toString();
      }
    } catch {
      // Ignore malformed URLs and keep looking for a usable value.
    }
  }

  return null;
}

const realtimeDatabaseUrl = getValidRealtimeDatabaseUrl();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const rtdb: Database | null = realtimeDatabaseUrl ? getDatabase(app, realtimeDatabaseUrl) : null;

if (!realtimeDatabaseUrl && import.meta.env.DEV) {
  console.warn('Realtime Database is not configured. Presence features are disabled.');
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}
