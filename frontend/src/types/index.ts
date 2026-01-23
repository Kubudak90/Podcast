export interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
}

export interface Room {
  id: string;
  slug: string;
  title: string;
  hostId: string;
  status: 'waiting' | 'live' | 'ended';
  maxSpeakers: number;
  isPublic: boolean;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
}

export interface Participant {
  id: string;
  odaId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  role: 'host' | 'speaker' | 'listener';
  isMuted: boolean;
  isSpeaking: boolean;
  joinedAt: string;
}

export interface Recording {
  id: string;
  roomId: string;
  fileUrl: string;
  durationSeconds: number;
  fileSizeBytes: number;
  format: string;
  createdAt: string;
}

export interface RoomState {
  roomId: string;
  slug: string;
  title: string;
  status: 'waiting' | 'live' | 'ended';
  hostId: string;
  isRecording: boolean;
  participants: Map<string, Participant>;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiError {
  message: string;
  code?: string;
}

export interface LiveKitTokenResponse {
  token: string;
  url: string;
}

export interface RoomHistoryItem {
  id: string;
  slug: string;
  title: string;
  status: 'waiting' | 'live' | 'ended';
  isPublic: boolean;
  host: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  participantCount: number;
  recordingCount: number;
  role: 'host' | 'speaker' | 'listener';
  joinedAt: string;
  leftAt?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface PublicRoom {
  id: string;
  slug: string;
  title: string;
  status: 'waiting' | 'live';
  isPublic: boolean;
  hasPassword: boolean;
  host: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  participantCount: number;
  maxSpeakers: number;
  createdAt: string;
  startedAt?: string;
}

export interface PublicRoomsResponse {
  rooms: PublicRoom[];
  total: number;
  limit: number;
  offset: number;
}
