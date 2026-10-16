import { Track } from '../../src/types/track.types';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const artist = (req.query?.artist as string) || '';
    const title = (req.query?.title as string) || '';

    if (!artist.trim() && !title.trim()) {
      return res.status(200).json([]);
    }

    // Buscar mezclas, canciones similares o éxitos del mismo estilo/artista
    const query = `${artist} canciones similares ${title}`.trim();

    const ytRes = await fetch('https://music.youtube.com/youtubei/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Referer: 'https://music.youtube.com/',
        Origin: 'https://music.youtube.com',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20241014.01.00',
            hl: 'es',
            gl: 'CO',
          },
        },
        query,
      }),
    });

    if (!ytRes.ok) {
      return res.status(ytRes.status).json([]);
    }

    const data = (await ytRes.json()) as any;
    const sectionList =
      data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    const songs: Track[] = [];
    for (const s of sectionList) {
      const item = s.itemSectionRenderer?.contents?.[0]?.musicResponsiveListItemRenderer;
      if (item) {
        const runs0 = item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const songTitle = runs0.map((r: any) => r.text).join('').trim();
        const runs1 = item.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const subtitle = runs1.map((r: any) => r.text).join('').trim();
        const videoId =
          item.playlistItemData?.videoId ||
          item.doubleTapData?.playlistItemData?.videoId ||
          item.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
        const thumbs = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        let cover = thumbs[thumbs.length - 1]?.url;
        if (cover && cover.startsWith('//')) cover = `https:${cover}`;

        if (songTitle && videoId) {
          // Omitir si es exactamente la misma canción que ya está sonando
          if (
            songTitle.toLowerCase().trim() === title.toLowerCase().trim() &&
            subtitle.toLowerCase().includes(artist.toLowerCase().trim())
          ) {
            continue;
          }

          songs.push({
            id: `yt_${videoId}`,
            title: songTitle,
            artist: subtitle.split('•')[0]?.trim() || artist || 'YouTube Music',
            album: 'YouTube Music',
            duration: 210,
            coverUrl: cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
            audioUrl: `https://invidious.nerdvpn.de/latest_version?id=${videoId}&itag=140`,
            videoId,
            source: 'stream',
            addedBy: 'IA Autopilot ⚡',
          });
        }
      }
    }

    // Deduplicar estrictamente
    const seen = new Set<string>();
    const cleanSongs = songs.filter((s) => {
      const key = `${s.title.toLowerCase().trim()}_${s.artist.toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.status(200).json(cleanSongs.slice(0, 8));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error en recomendación' });
  }
}
