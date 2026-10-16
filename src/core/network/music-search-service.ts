import { Track } from '../../types/track.types';
import { OmniMusicGateway, MusicSourceType } from '../providers/omni-music-gateway';

export const TOP_TRENDING_TRACKS: Track[] = [
  {
    id: 'yt_lx__gZ_s9cM',
    title: 'LA CANCIÓN',
    artist: 'J Balvin & Bad Bunny',
    album: 'OASIS',
    duration: 242,
    source: 'passenger_dj',
    addedBy: 'Top Musical',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4a/04/b8/4a04b868-b7eb-d731-bf38-518204646765/19UMGIM56262.rgb.jpg/600x600bb.jpg',
    audioUrl: 'https://invidious.nerdvpn.de/latest_version?id=lx__gZ_s9cM&itag=140',
    videoId: 'lx__gZ_s9cM',
  },
  {
    id: 'yt_ca48oMV5GwU',
    title: 'PROVENZA',
    artist: 'KAROL G',
    album: 'MAÑANA SERÁ BONITO',
    duration: 210,
    source: 'passenger_dj',
    addedBy: 'Top Musical',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/08/94/f2/0894f275-c09a-ea05-64bc-b1662ba47d10/22UMGIM39257.rgb.jpg/600x600bb.jpg',
    audioUrl: 'https://invidious.nerdvpn.de/latest_version?id=ca48oMV5GwU&itag=140',
    videoId: 'ca48oMV5GwU',
  },
  {
    id: 'yt_u38hJ23q-2k',
    title: 'Feliz Cumpleaños Ferxxo',
    artist: 'Feid',
    album: 'FELIZ CUMPLEAÑOS FERXXO',
    duration: 156,
    source: 'passenger_dj',
    addedBy: 'Top Musical',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/35/d0/23/35d02336-e630-f5a6-574a-e4b2d3d3b7fa/22UMGIM81958.rgb.jpg/600x600bb.jpg',
    audioUrl: 'https://invidious.nerdvpn.de/latest_version?id=u38hJ23q-2k&itag=140',
    videoId: 'u38hJ23q-2k',
  },
  {
    id: 'yt_o7_WqT4bZ34',
    title: 'Mi Primera Cana',
    artist: 'Diomedes Díaz & Juancho Rois',
    album: 'Título de Amor',
    duration: 270,
    source: 'passenger_dj',
    addedBy: 'Top Musical',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/8e/58/bc/8e58bc75-ff1a-6df6-beff-12a8689feec3/886444855567.jpg/600x600bb.jpg',
    audioUrl: 'https://invidious.nerdvpn.de/latest_version?id=o7_WqT4bZ34&itag=140',
    videoId: 'o7_WqT4bZ34',
  },
  {
    id: 'yt_rY0WxgSXdEE',
    title: 'Another One Bites the Dust',
    artist: 'Queen',
    album: 'The Game',
    duration: 215,
    source: 'passenger_dj',
    addedBy: 'Top Musical',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/91/44/da/9144da68-c389-4819-97a6-1082a831784b/050087522032.jpg/600x600bb.jpg',
    audioUrl: 'https://invidious.nerdvpn.de/latest_version?id=rY0WxgSXdEE&itag=140',
    videoId: 'rY0WxgSXdEE',
  },
];

export class MusicSearchService {
  public static async searchOnline(
    query: string,
    djName: string,
    source: MusicSourceType = 'all'
  ): Promise<Track[]> {
    return OmniMusicGateway.search(query, djName, source);
  }
}
