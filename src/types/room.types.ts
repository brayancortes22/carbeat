import { QueueItem, Track } from './track.types';

export type UserRole = 'host' | 'dj' | 'spectator';

export type RoomEventType =
  | 'ROOM_JOIN'
  | 'ROOM_JOINED'
  | 'SYNC_CATALOG'
  | 'QUEUE_TRACK'
  | 'VOTE_TRACK'
  | 'PLAYBACK_STATE'
  | 'HOST_COMMAND'
  | 'NEW_TRACK_OFFER';

export interface RoomMessage<T = unknown> {
  type: RoomEventType;
  roomId: string;
  senderId: string;
  senderName?: string;
  timestamp: number;
  payload: T;
}

export interface Participant {
  id: string;
  name: string;
  role: UserRole;
  joinedAt: number;
}

export interface RoomState {
  roomId: string;
  roomName: string;
  isHostOnline: boolean;
  participants: Participant[];
  currentTrack: Track | null;
  queue: QueueItem[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}
