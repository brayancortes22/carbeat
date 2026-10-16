export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
      return Response.json([], {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
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
      return Response.json([], { status: ytRes.status });
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

    return Response.json(songs.slice(0, 20), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    return Response.json(
      { error: err.message || 'Error en búsqueda de YouTube Music' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
