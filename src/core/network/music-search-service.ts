import { Track } from '../../types/track.types';
import { OmniMusicGateway, MusicSourceType } from '../providers/omni-music-gateway';

export const ROTATING_TRENDING_POOL: Track[] = [
  // Reggaeton & Urbano
  {
    id: 'yt_lx__gZ_s9cM',
    title: 'LA CANCIÓN',
    artist: 'J Balvin & Bad Bunny',
    album: 'OASIS',
    duration: 242,
    source: 'passenger_dj',
    addedBy: 'Top Urbano',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4a/04/b8/4a04b868-b7eb-d731-bf38-518204646765/19UMGIM56262.rgb.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'lx__gZ_s9cM',
  },
  {
    id: 'yt_ca48oMV5GwU',
    title: 'PROVENZA',
    artist: 'KAROL G',
    album: 'MAÑANA SERÁ BONITO',
    duration: 210,
    source: 'passenger_dj',
    addedBy: 'Top Urbano',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/08/94/f2/0894f275-c09a-ea05-64bc-b1662ba47d10/22UMGIM39257.rgb.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'ca48oMV5GwU',
  },
  {
    id: 'yt_u38hJ23q-2k',
    title: 'Feliz Cumpleaños Ferxxo',
    artist: 'Feid',
    album: 'FELIZ CUMPLEAÑOS FERXXO',
    duration: 156,
    source: 'passenger_dj',
    addedBy: 'Top Urbano',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/35/d0/23/35d02336-e630-f5a6-574a-e4b2d3d3b7fa/22UMGIM81958.rgb.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'u38hJ23q-2k',
  },
  {
    id: 'yt_CCF1_j4257g',
    title: 'Danza Kuduro',
    artist: 'Don Omar & Lucenzo',
    album: 'Meet The Orphans',
    duration: 204,
    source: 'passenger_dj',
    addedBy: 'Clásicos del Perreo',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/7c/4f/f5/7c4ff558-867d-d1ef-42ae-8488e001dfa1/10UMGIM22378.rgb.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'CCF1_j4257g',
  },
  // Vallenato
  {
    id: 'yt_o7_WqT4bZ34',
    title: 'Mi Primera Cana',
    artist: 'Diomedes Díaz & Juancho Rois',
    album: 'Título de Amor',
    duration: 270,
    source: 'passenger_dj',
    addedBy: 'Vallenato',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/8e/58/bc/8e58bc75-ff1a-6df6-beff-12a8689feec3/886444855567.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'o7_WqT4bZ34',
  },
  {
    id: 'yt_f_6Afe0t1Xg',
    title: 'Olvídala',
    artist: 'Binomio de Oro de América',
    album: 'Más Cerca de Ti',
    duration: 285,
    source: 'passenger_dj',
    addedBy: 'Vallenato Romántico',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/a4/90/e1/a490e1f3-e4d6-1934-e86d-f421f1585800/0.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'f_6Afe0t1Xg',
  },
  {
    id: 'yt_5_rP6kM234E',
    title: 'Materialista',
    artist: 'Silvestre Dangond & Nicky Jam',
    album: 'Sigo Invicto',
    duration: 215,
    source: 'passenger_dj',
    addedBy: 'Nueva Ola Vallenata',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music6/v4/5a/c3/09/5ac30922-8356-96fc-1797-158a44d852a4/886445582370.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: '5_rP6kM234E',
  },
  // Rock en Español / Rock Clásico
  {
    id: 'yt_rY0WxgSXdEE',
    title: 'Another One Bites the Dust',
    artist: 'Queen',
    album: 'The Game',
    duration: 215,
    source: 'passenger_dj',
    addedBy: 'Rock Clásico',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/91/44/da/9144da68-c389-4819-97a6-1082a831784b/050087522032.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'rY0WxgSXdEE',
  },
  {
    id: 'yt_F0iWc9Lb-Qk',
    title: 'De Música Ligera',
    artist: 'Soda Stereo',
    album: 'Canción Animal',
    duration: 212,
    source: 'passenger_dj',
    addedBy: 'Rock en Español',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/13/2e/82/132e825a-6948-4e89-13e0-394f48ff113c/886444855734.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'F0iWc9Lb-Qk',
  },
  {
    id: 'yt_12sSg-5x6dY',
    title: 'Lamento Boliviano',
    artist: 'Los Enanitos Verdes',
    album: 'Big Yangu',
    duration: 224,
    source: 'passenger_dj',
    addedBy: 'Rock en Español',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/cf/e6/78/cfe67821-255e-045d-7521-4fa3e4cb4c55/886445353598.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: '12sSg-5x6dY',
  },
  // Salsa & Tropical
  {
    id: 'yt_98F_c4v0q08',
    title: 'La Rebelión',
    artist: 'Joe Arroyo',
    album: 'Musa Original',
    duration: 285,
    source: 'passenger_dj',
    addedBy: 'Salsa Brava',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/6c/9b/37/6c9b3780-ecb8-ea30-8041-382903fa728c/00076732600257.rgb.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: '98F_c4v0q08',
  },
  {
    id: 'yt_f3B9rM39r2A',
    title: 'Una Aventura',
    artist: 'Grupo Niche',
    album: 'Cielo de Tambores',
    duration: 330,
    source: 'passenger_dj',
    addedBy: 'Salsa Clásica',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/33/c4/62/33c462ea-6302-df49-21df-66fe7a0c1f51/888880456108.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'f3B9rM39r2A',
  },
  {
    id: 'yt_V1bFr2SWP1I',
    title: 'Vivir Mi Vida',
    artist: 'Marc Anthony',
    album: '3.0',
    duration: 250,
    source: 'passenger_dj',
    addedBy: 'Salsa & Fiesta',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/71/62/31/716231be-389f-2f92-5d46-ec8c8194458f/886443997237.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'V1bFr2SWP1I',
  },
  // Popular, Despecho & Cantina
  {
    id: 'yt_Y8j0s3r318k',
    title: 'Aventurero',
    artist: 'Yeison Jiménez',
    album: 'Con el Corazón',
    duration: 218,
    source: 'passenger_dj',
    addedBy: 'Música Popular',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/21/f4/04/21f40440-410a-3d07-285b-e44dbbaee6f4/192641324835.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'Y8j0s3r318k',
  },
  {
    id: 'yt_138x92nd823',
    title: 'Nadie Es Eterno',
    artist: 'Darío Gómez',
    album: 'El Rey del Despecho',
    duration: 230,
    source: 'passenger_dj',
    addedBy: 'Despecho Cantina',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/55/a1/3b/55a13b63-a602-5536-1e0e-ce90d794cb14/0.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: '138x92nd823',
  },
  // Cumbia & Fiesta Decembrina / Tropical
  {
    id: 'yt_j39d023812a',
    title: '17 Años',
    artist: 'Los Ángeles Azules',
    album: 'Cómo Te Voy a Olvidar',
    duration: 220,
    source: 'passenger_dj',
    addedBy: 'Cumbia Mexicana',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/c7/28/08/c72808c7-43f1-f09d-cb99-9c5cbe830720/00602537380907.rgb.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: 'j39d023812a',
  },
  {
    id: 'yt_02938491823',
    title: 'El Hijo Ausente',
    artist: 'Pastor López',
    album: 'El Rey de la Cumbia',
    duration: 240,
    source: 'passenger_dj',
    addedBy: 'Tropical Parrandero',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/85/ca/93/85ca93ca-ee6a-2d4e-b5f7-41837c35fa29/7702582000000.jpg/600x600bb.jpg',
    audioUrl: '',
    videoId: '02938491823',
  },
];

// Alias de retrocompatibilidad
export const TOP_TRENDING_TRACKS = ROTATING_TRENDING_POOL.slice(0, 6);

/**
 * Devuelve un set rotativo y fresco de canciones multigénero
 */
export function getFreshTrendingTracks(limit = 7): Track[] {
  const shuffled = [...ROTATING_TRENDING_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

export class MusicSearchService {
  public static async searchOnline(
    query: string,
    djName: string,
    source: MusicSourceType = 'all'
  ): Promise<Track[]> {
    return OmniMusicGateway.search(query, djName, source);
  }
}
