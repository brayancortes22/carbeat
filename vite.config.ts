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

      // Endpoint dev en memoria para /api/room (elimina 404s en desarrollo local)
      const localRooms = new Map<string, any>();
      server.middlewares.use('/api/room', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const action = urlObj.searchParams.get('action') || '';
        const roomId = (urlObj.searchParams.get('roomId') || 'DEFAULT').toUpperCase();

        const now = Date.now();
        const INACTIVE_TIMEOUT_MS = 10000;

        // Purgar periódicamente salas inactivas
        for (const [id, r] of localRooms.entries()) {
          if (now - (r.lastUpdated || 0) > INACTIVE_TIMEOUT_MS) {
            localRooms.delete(id);
          }
        }

        if (req.method === 'GET') {
          if (action === 'discover') {
            const list: any[] = [];
            for (const r of localRooms.values()) {
              if (now - (r.lastUpdated || 0) <= INACTIVE_TIMEOUT_MS) {
                const activeDjs = Object.entries(r.djs || {}).filter(([_, time]: any) => now - time < 6000);
                list.push({
                  roomId: r.roomId,
                  roomName: r.roomName || `CarBeat ${r.roomId}`,
                  hostIp: '127.0.0.1',
                  djCount: activeDjs.length,
                  lastSeen: r.lastUpdated || now,
                });
              }
            }
            res.end(JSON.stringify(list));
            return;
          }

          const existing = localRooms.get(roomId);
          if (!existing || now - (existing.lastUpdated || 0) > INACTIVE_TIMEOUT_MS) {
            if (existing) localRooms.delete(roomId);
            res.end(JSON.stringify({
              exists: false,
              error: `La sala "${roomId}" no existe o el vehículo está desconectado.`,
            }));
            return;
          }

          const activeDjCount = Object.values(existing.djs || {}).filter((t: any) => now - t < 6000).length;
          res.end(JSON.stringify({
            exists: true,
            ...existing,
            djCount: activeDjCount,
          }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const targetId = (data.roomId || roomId).toUpperCase();

              // Cierre de sala explícito
              if (data.type === 'CLOSE_ROOM' || data.type === 'ROOM_CLOSED' || data.action === 'close') {
                localRooms.delete(targetId);
                res.end(JSON.stringify({ ok: true, closed: true }));
                return;
              }

              const existing = localRooms.get(targetId) || {
                roomId: targetId,
                queue: [],
                currentTrack: null,
                isPlaying: false,
                currentTime: 0,
                duration: 0,
                djs: {}
              };

              if (data.type === 'HOST_ANNOUNCE') {
                existing.roomName = data.payload?.roomName || existing.roomName;
                existing.lastUpdated = Date.now();
              } else if (data.type === 'DJ_HEARTBEAT') {
                existing.djs = existing.djs || {};
                if (data.payload?.djName) existing.djs[data.payload.djName] = Date.now();
              } else if (data.type === 'SYNC_CATALOG') {
                if (data.payload?.queue) existing.queue = data.payload.queue;
                if (data.payload?.catalog) existing.catalog = data.payload.catalog;
                if (data.payload?.currentTrack !== undefined) existing.currentTrack = data.payload.currentTrack;
                if (data.payload?.isPlaying !== undefined) existing.isPlaying = data.payload.isPlaying;
                if (data.payload?.currentTime !== undefined) existing.currentTime = data.payload.currentTime;
                if (data.payload?.duration !== undefined) existing.duration = data.payload.duration;
                existing.lastUpdated = Date.now();
              } else if (data.type === 'PLAYBACK_STATE') {
                if (data.payload?.currentTrack !== undefined) existing.currentTrack = data.payload.currentTrack;
                if (data.payload?.isPlaying !== undefined) existing.isPlaying = data.payload.isPlaying;
                if (data.payload?.currentTime !== undefined) existing.currentTime = data.payload.currentTime;
                if (data.payload?.duration !== undefined) existing.duration = data.payload.duration;
                existing.lastUpdated = Date.now();
              } else if (data.type === 'QUEUE_TRACK') {
                existing.queue = existing.queue || [];
                if (data.payload?.track) {
                  existing.queue.push({
                    queueId: `q_${Date.now()}`,
                    track: data.payload.track,
                    votes: 1,
                    requestedBy: data.payload.requestedBy || 'DJ',
                    requestedAt: Date.now()
                  });
                }
                existing.lastUpdated = Date.now();
              }

              localRooms.set(targetId, existing);
              res.end(JSON.stringify({ ok: true, room: existing }));
            } catch {
              res.end(JSON.stringify({ ok: true }));
            }
          });
          return;
        }
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
                  videoId,
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

      // Servidor WebSocket dedicado para comunicación de salas (/ws-rooms en puerto 5174)
      let wss: WebSocketServer;
      try {
        wss = new WebSocketServer({ port: 5174 });
        wss.on('error', (err: any) => {
          console.warn('[Vite WS] Evento de socket:', err.message || err);
        });
        server.httpServer?.on('close', () => {
          try { wss.close(); } catch { /* ignore */ }
        });
        console.log('[Vite WS] Servidor WebSocket dedicado escuchando en ws://localhost:5174');
      } catch {
        wss = new WebSocketServer({ noServer: true });
      }
      const rooms = new Map<string, Set<WebSocket>>();

      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url?.startsWith('/ws-rooms')) {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
          return;
        }
        if (req.url?.startsWith('/ws-discovery')) {
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

        // Enviar sincronización inmediata si ya tenemos estado de esta sala en memoria
        const cachedRoom = localRooms.get(roomId);
        if (cachedRoom) {
          try {
            ws.send(JSON.stringify({
              type: 'SYNC_CATALOG',
              roomId,
              senderId: 'server_fast_sync',
              senderName: 'Vite Memory Relay',
              timestamp: cachedRoom.lastUpdated || Date.now(),
              payload: {
                catalog: cachedRoom.catalog || [],
                queue: cachedRoom.queue || [],
                currentTrack: cachedRoom.currentTrack || null,
                isPlaying: cachedRoom.isPlaying || false,
                currentTime: cachedRoom.currentTime || 0,
                duration: cachedRoom.duration || 0,
              }
            }));
          } catch {
            /* ignore */
          }
        }

        ws.on('message', (data) => {
          const roomClients = rooms.get(roomId);
          if (!roomClients) return;

          try {
            const msg = JSON.parse(data.toString());
            console.log(`[Vite WS] Mensaje en sala ${roomId}: ${msg.type} de ${msg.senderName}`);

            // Actualizar caché en memoria
            const existing = localRooms.get(roomId) || { roomId, queue: [], djs: {} };
            if (msg.type === 'SYNC_CATALOG' || msg.type === 'PLAYBACK_STATE') {
              if (msg.payload?.queue) existing.queue = msg.payload.queue;
              if (msg.payload?.catalog) existing.catalog = msg.payload.catalog;
              if (msg.payload?.currentTrack !== undefined) existing.currentTrack = msg.payload.currentTrack;
              if (msg.payload?.isPlaying !== undefined) existing.isPlaying = msg.payload.isPlaying;
              if (msg.payload?.currentTime !== undefined) existing.currentTime = msg.payload.currentTime;
              if (msg.payload?.duration !== undefined) existing.duration = msg.payload.duration;
              existing.lastUpdated = Date.now();
              localRooms.set(roomId, existing);
            }

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
      const activeHosts = new Map<string, { raw: string; timestamp: number }>();

      discoveryWss.on('connection', (ws) => {
        discoveryClients.add(ws);
        console.log(`[Vite Discovery] Cliente conectado (total: ${discoveryClients.size})`);

        // Enviar inmediatamente todos los hosts activos conocidos al nuevo cliente
        const now = Date.now();
        for (const [roomId, host] of activeHosts.entries()) {
          if (now - host.timestamp < 15000 && ws.readyState === WebSocket.OPEN) {
            ws.send(host.raw);
          } else if (now - host.timestamp >= 15000) {
            activeHosts.delete(roomId);
          }
        }

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'HOST_ANNOUNCE' && msg.roomId) {
              const rawStr = data.toString();
              activeHosts.set(msg.roomId, { raw: rawStr, timestamp: Date.now() });
              console.log(`[Vite Discovery] Anuncio de host: ${msg.roomName} (${msg.roomId}) a ${discoveryClients.size} clientes`);
              for (const client of discoveryClients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(rawStr);
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

        ws.on('error', (err) => {
          discoveryClients.delete(ws);
          console.error('[Vite Discovery] Error de socket:', err);
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
