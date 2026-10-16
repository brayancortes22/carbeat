import { Track } from '../../types/track.types';

// Canciones iniciales de alta fidelidad con CORS universal y reproducción inmediata
export const MOCK_CAR_TRACKS: Track[] = [
  {
    id: 'track-queen-bohemian',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    duration: 355,
    source: 'local_car',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/15/c7/55/15c755bc-7603-3ce3-e243-e59f1f9863ea/602527724171.jpg/600x600bb.jpg',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/15/91/df/1591df73-dd8a-ee42-bfb8-51c8cdda7078/mzaf_9819305553372065518.plus.aac.p.m4a',
  },
  {
    id: 'track-queen-dont-stop',
    title: "Don't Stop Me Now",
    artist: 'Queen',
    album: 'Jazz',
    duration: 209,
    source: 'local_car',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/91/44/da/9144da68-c389-4819-97a6-1082a831784b/050087522032.jpg/600x600bb.jpg',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b0/16/9e/b0169ec2-0ca5-ab00-c98f-928154113237/mzaf_17951255333728914139.plus.aac.p.m4a',
  },
  {
    id: 'track-carlos-vives-gota-fria',
    title: 'La Gota Fría',
    artist: 'Carlos Vives',
    album: 'Clásicos de la Provincia',
    duration: 215,
    source: 'local_car',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/8e/58/bc/8e58bc75-ff1a-6df6-beff-12a8689feec3/886444855567.jpg/600x600bb.jpg',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/4a/60/eb/4a60ebba-b68d-8153-f725-bf7d5f081944/mzaf_11303975549048386345.plus.aac.p.m4a',
  },
  {
    id: 'track-vicente-fernandez-rey',
    title: 'El Rey',
    artist: 'Vicente Fernández',
    album: 'Para Recordar',
    duration: 149,
    source: 'local_car',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/3d/8c/fb/3d8cfb39-d3fb-586b-ca39-ae1589178ad3/886445214066.jpg/600x600bb.jpg',
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/bf/7a/74/bf7a7407-3532-67ee-cb6f-b258673a5a41/mzaf_17409249767794354279.plus.aac.p.m4a',
  },
];
