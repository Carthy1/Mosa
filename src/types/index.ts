export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  friends: string[];
  streak?: number;
  createdAt: number;
}

export type SnapMediaType = 'text' | 'image' | 'video';

export type SnapViewStatus = 'delivered' | 'viewed' | 'opened';

export interface ReplyTo {
  messageId: string;
  senderName: string;
  senderId?: string;
  content: string;
  type: SnapMediaType;
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  type: SnapMediaType;
  content: string; // text body or mediaUrl
  viewStatus: SnapViewStatus;
  duration?: number; // In seconds (default 10s for snaps)
  createdAt: number;
  viewedAt?: number;
  replyTo?: ReplyTo;
  isSaved?: boolean;
  savedBy?: string[];
  savedByName?: string;
  savedAt?: number;
}

export interface Chat {
  id: string;
  participants: string[];
  participantProfiles?: Record<string, Partial<UserProfile>>;
  participantDetails?: Record<string, Partial<UserProfile>>;
  lastMessage?: {
    content: string;
    type: SnapMediaType;
    senderId: string;
    createdAt: number;
    viewStatus?: SnapViewStatus;
    viewedAt?: number;
    isReply?: boolean;
    replyToSenderId?: string;
    replyToSenderName?: string;
    isSaved?: boolean;
    savedByName?: string;
  };
  typing?: Record<string, boolean>; // { [uid]: boolean }
  updatedAt: number;
}

export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  mediaUrl: string;
  type: 'image' | 'video';
  caption?: string;
  createdAt: number;
  expiresAt: number; // Exactly 24 hours after createdAt
  viewedBy?: string[];
}

export type ARFilterId = 'none' | 'cyberpunk' | 'bunny' | 'glasses' | 'halo' | 'fire' | 'noir';

export interface ARFilterConfig {
  id: ARFilterId;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export interface QAAuditState {
  webglSupported: boolean;
  cameraStatus: 'prompt' | 'granted' | 'denied' | 'unsupported';
  activeStreamsCount: number;
  webglMemoryCleaned: boolean;
  bandwidthDirectUploadVerified: boolean;
  payloadLimitEnforced: boolean;
  ttlSimulationPassed: boolean;
}
