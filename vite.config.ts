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
