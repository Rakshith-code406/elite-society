import { User } from "firebase/auth";
import { Timestamp } from "firebase/firestore";

export type UserStatus = 'applying' | 'pending' | 'approved' | 'waitlisted' | 'rejected' | 'new';
export type UserRole = 'member' | 'admin';

export type VerificationStatus = 'unverified' | 'pending' | 'verified';
export type PresenceStatus = 'online' | 'offline' | 'busy';

export interface PresenceRecord {
  status: PresenceStatus;
  isChatting: boolean;
  isVisible: boolean;
  lastChangedAt: number | null;
  lastActiveAt: number | null;
  lastSeenAt: number | null;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  bio: string;
  photoURL: string;
  role: UserRole;
  status: UserStatus;
  verificationStatus?: VerificationStatus;
  presenceStatus?: PresenceStatus;
  interests: string[];
  onboardingAnswers?: Record<string, any>;
  referredBy?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: Timestamp;
  location: string;
  type: 'virtual' | 'in-person';
  hostId: string;
  attendeeCount: number;
  imageUrl: string;
  locationLink?: string;
  createdAt: Timestamp;
}

export interface EventRegistration {
  id: string; // userId
  eventId: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  registeredAt: Timestamp;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: Timestamp;
  otherUser?: UserProfile; // Joined data
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
}

export interface Invite {
  id: string;
  code: string;
  createdBy: string;
  usedBy?: string;
  createdAt: Timestamp;
}
