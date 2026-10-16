import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'node:os';

function websocketRoomsPlugin(): Plugin {
  return {
    name: 'vite-plugin-carbeat-ws',
    configureServer(server) {
      // Endpoint para entregar IPs de red local (LAN / Hotspot) al Host
      server.middlewares.use('/api/server-info', (_req, res) => {
        const interfaces = os.networkInterfaces();
        const addresses: string[] = [];
        for (const name of Object.keys(interfaces)) {
          for (const net of interfaces[name] || []) {
            if (net.family === 'IPv4' && !net.internal) {
              addresses.push(net.address);
            }
          }
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ ips: addresses, port: 5173 }));
      });

      // Endpoint proxy de YouTube Music Innertube (protocolo Metrolist / WEB_REMIX)
      server.middlewares.use('/api/yt/search', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
          const query = urlObj.searchParams.get('q') || '';
          if (!query.trim()) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify([]));
            return;
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

          if (!ytRes.ok) throw new Error(`YouTube Music respondió: ${ytRes.status}`);

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
                });
              }
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(songs.slice(0, 20)));
        } catch (err: any) {
          console.error('[Vite Proxy YT] Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ error: err.message || 'Error en búsqueda de YouTube Music' }));
        }
      });

      // Servidor WebSocket para comunicación de salas (/ws-rooms)
      const wss = new WebSocketServer({ noServer: true });
      const rooms = new Map<string, Set<WebSocket>>();

      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url?.startsWith('/ws-rooms')) {
          console.log('[Vite WS] Upgrade /ws-rooms desde:', req.socket.remoteAddress);
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
          return;
        }
        if (req.url?.startsWith('/ws-discovery')) {
          console.log('[Vite WS] Upgrade /ws-discovery desde:', req.socket.remoteAddress);
          discoveryWss.handleUpgrade(req, socket, head, (ws) => {
            discoveryWss.emit('connection', ws, req);
          });
          return;
        }
      });

      wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const roomId = url.searchParams.get('room') || 'default-room';

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId)!.add(ws);

        console.log(`[Vite WS] Cliente conectado a sala: ${roomId} (total: ${rooms.get(roomId)!.size})`);

        ws.on('message', (data) => {
          const roomClients = rooms.get(roomId);
          if (!roomClients) return;

          try {
            const msg = JSON.parse(data.toString());
            console.log(`[Vite WS] Mensaje en sala ${roomId}: ${msg.type} de ${msg.senderName}`);

            // Retransmitir a TODOS los clientes de la sala EXCEPTO al remitente
            for (const client of roomClients) {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data.toString());
              }
            }
          } catch (err) {
            console.error('[Vite WS] Error procesando mensaje:', err);
          }
        });

        ws.on('close', () => {
          const roomClients = rooms.get(roomId);
          if (roomClients) {
            roomClients.delete(ws);
            if (roomClients.size === 0) rooms.delete(roomId);
          }
          console.log(`[Vite WS] Cliente desconectado de sala: ${roomId}`);
        });

        ws.on('error', (err) => {
          console.error('[Vite WS] Error de conexión:', err);
        });
      });

      // Servidor WebSocket para descubrimiento de hosts (/ws-discovery)
      const discoveryWss = new WebSocketServer({ noServer: true });
      const discoveryClients = new Set<WebSocket>();

      discoveryWss.on('connection', (ws) => {
        console.log(`[Vite Discovery] Cliente conectado (total: ${discoveryClients.size})`);

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'HOST_ANNOUNCE') {
              console.log(`[Vite Discovery] Anuncio de host: ${msg.roomName} (${msg.roomId})`);
              for (const client of discoveryClients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(data.toString());
                }
              }
            }
          } catch {
            // Mensaje inválido, ignorar
          }
        });

        ws.on('close', () => {
          discoveryClients.delete(ws);
          console.log(`[Vite Discovery] Cliente desconectado (total: ${discoveryClients.size})`);
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    websocketRoomsPlugin(),
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
    cors: true,
    allowedHosts: true,
  },
});
