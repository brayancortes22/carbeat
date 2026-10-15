import { Track } from '../../types/track.types';

// Canciones de muestra libres de derechos / dominio público para pruebas inmediatas
export const MOCK_CAR_TRACKS: Track[] = [
  {
    id: 'mock-track-1',
    title: 'Neon Highway Drive',
    artist: 'CyberCruise',
    album: 'Night Roads Vol. 1',
    duration: 184,
    source: 'local_car',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/612/612089_11861866-lq.mp3',
  },
  {
    id: 'mock-track-2',
    title: 'Sunset Bass Horizon',
    artist: 'VibeStation',
    album: 'Cabina Estéreo',
    duration: 215,
    source: 'local_car',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/612/612092_11861866-lq.mp3',
  },
  {
    id: 'mock-track-3',
    title: 'Cumbia del Desierto (Remix)',
    artist: 'Sonido Tropikal',
    album: 'Grandes Éxitos de Ruta',
    duration: 198,
    source: 'passenger_dj',
    addedBy: 'Tío Sebas',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/612/612095_11861866-lq.mp3',
  },
  {
    id: 'mock-track-4',
    title: 'Trocha Nocturna',
    artist: 'Los Caminantes 4x4',
    album: 'Vía Libre',
    duration: 160,
    source: 'local_car',
    coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/612/612089_11861866-lq.mp3',
  },
];
