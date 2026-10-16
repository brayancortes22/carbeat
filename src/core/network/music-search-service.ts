import { Track } from '../../types/track.types';

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100: string;
  previewUrl: string;
  trackTimeMillis: number;
}

export const TOP_TRENDING_TRACKS: Track[] = [
  {
    id: 'trending-1',
    title: 'LA CANCIÓN',
    artist: 'J Balvin & Bad Bunny',
    album: 'OASIS',
    duration: 242,
    source: 'passenger_dj',
    addedBy: 'Top Musical',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4a/04/b8/4a04b868-b7eb-d731-bf38-518204646765/19UMGIM56262.rgb.jpg/600x600bb.jpg',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/bf/7a/74/bf7a7407-3532-67ee-cb6f-b258673a5a41/mzaf_17409249767794354279.plus.aac.p.m4a',
  },
  {
    id: 'trending-2',
    title: 'PROVENZA',
    artist: 'KAROL G',
    album: 'MAÑANA SERÁ BONITO',
    duration: 210,
    source: 'passenger_dj',
    addedBy: 'Top Musical',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/08/94/f2/0894f275-c09a-ea05-64bc-b1662ba47d10/22UMGIM39257.rgb.jpg/600x600bb.jpg',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/4a/60/eb/4a60ebba-b68d-8153-f725-bf7d5f081944/mzaf_11303975549048386345.plus.aac.p.m4a',
  },
  {
    id: 'trending-3',
    title: 'Feliz Cumpleaños Ferxxo',
    artist: 'Feid',
    album: 'FELIZ CUMPLEAÑOS FERXXO',
    duration: 156,
    source: 'passenger_dj',
    addedBy: 'Top Musical',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/35/d0/23/35d02336-e630-f5a6-574a-e4b2d3d3b7fa/22UMGIM81958.rgb.jpg/600x600bb.jpg',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b0/16/9e/b0169ec2-0ca5-ab00-c98f-928154113237/mzaf_17951255333728914139.plus.aac.p.m4a',
  },
  {
    id: 'trending-4',
    title: 'Mi Primera Cana',
    artist: 'Diomedes Díaz & Juancho Rois',
    album: 'Título de Amor',
    duration: 270,
    source: 'passenger_dj',
    addedBy: 'Top Musical',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/8e/58/bc/8e58bc75-ff1a-6df6-beff-12a8689feec3/886444855567.jpg/600x600bb.jpg',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/4a/60/eb/4a60ebba-b68d-8153-f725-bf7d5f081944/mzaf_11303975549048386345.plus.aac.p.m4a',
  },
  {
    id: 'trending-5',
    title: 'Another One Bites the Dust',
    artist: 'Queen',
    album: 'The Game',
    duration: 215,
    source: 'passenger_dj',
    addedBy: 'Top Musical',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/91/44/da/9144da68-c389-4819-97a6-1082a831784b/050087522032.jpg/600x600bb.jpg',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/15/91/df/1591df73-dd8a-ee42-bfb8-51c8cdda7078/mzaf_9819305553372065518.plus.aac.p.m4a',
  },
];

export class MusicSearchService {
  public static async searchOnline(query: string, djName: string): Promise<Track[]> {
    if (!query.trim()) {
      return TOP_TRENDING_TRACKS.map((t) => ({ ...t, addedBy: djName }));
    }

    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=20`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al consultar catálogo online');

      const data = await res.json();
      const results: ITunesResult[] = data.results || [];

      return results.map((item) => ({
        id: `online_${item.trackId}`,
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName || 'Single / Álbum',
        duration: Math.round(item.trackTimeMillis / 1000),
        source: 'passenger_dj',
        addedBy: djName,
        coverUrl: item.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg'),
        audioUrl: item.previewUrl,
      }));
    } catch (err) {
      console.warn('[MusicSearchService] Fallback a Top Musical:', err);
      return TOP_TRENDING_TRACKS.map((t) => ({ ...t, addedBy: djName }));
    }
  }
}
