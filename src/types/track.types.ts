export type TrackSource = 'local_car' | 'passenger_dj' | 'stream';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // en segundos
  coverUrl?: string;
  source: TrackSource;
  addedBy?: string; // Nombre del DJ que la aportó
  audioUrl: string; // URL local (blob, http o file)
  videoId?: string; // ID de video de YouTube para reproducción completa
}

export interface QueueItem {
  queueId: string;
  track: Track;
  votes: number;
  requestedBy: string;
  requestedAt: number;
}
