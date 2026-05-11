import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: any) {
  if (!date) return 'Recently';
  
  // Handle Firestore Timestamp
  const d = typeof date.toDate === 'function' ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
  
  if (!(d instanceof Date) || isNaN(d.getTime())) return 'Recently';

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatTime(date: any) {
  if (!date) return 'TBD';
  const d = typeof date.toDate === 'function' ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
  if (!(d instanceof Date) || isNaN(d.getTime())) return 'TBD';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(date: any) {
  if (!date) return 'Recently';
  const d = typeof date.toDate === 'function' ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
  if (!(d instanceof Date) || isNaN(d.getTime())) return 'Recently';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getDisplayInitial(name?: string | null) {
  const normalized = name?.trim();
  if (!normalized) return 'E';
  return normalized.charAt(0).toUpperCase();
}
