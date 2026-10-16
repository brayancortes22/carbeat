export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const query = (req.query?.q as string) || '';

    if (!query.trim()) {
      return res.status(200).json([]);
    }

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

    const songs: any[] = [];
    for (const s of sectionList) {
      const item = s.itemSectionRenderer?.contents?.[0]?.musicResponsiveListItemRenderer;
      if (item) {
        const runs0 = item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const title = runs0.map((r: any) => r.text).join('').trim();
        const runs1 = item.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const subtitle = runs1.map((r: any) => r.text).join('').trim();
        const videoId =
          item.playlistItemData?.videoId ||
          item.doubleTapData?.playlistItemData?.videoId ||
          item.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
        const thumbs = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        let cover = thumbs[thumbs.length - 1]?.url;
        if (cover) {
          cover = cover.replace(/=w\d+-h\d+/, '=w300-h300');
        }
        if (title && videoId) {
          const artist = subtitle.replace(/^Canción\s*•\s*/i, '').replace(/^Video\s*•\s*/i, '').trim();
          songs.push({
            id: `yt_${videoId}`,
            title,
            artist: artist || 'YouTube Music',
            album: 'YouTube Music',
            duration: 210,
            coverUrl: cover || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            audioUrl: `https://invidious.nerdvpn.de/latest_version?id=${videoId}&itag=140`,
            videoId,
          });
        }
      }
    }

    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json(songs.slice(0, 20));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error en búsqueda' });
  }
}
