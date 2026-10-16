import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { WebSocketServer, WebSocket } from 'ws';

function websocketRoomsPlugin(): Plugin {
  return {
    name: 'vite-plugin-carbeat-ws',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      const rooms = new Map<string, Set<WebSocket>>();

      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url?.startsWith('/ws-rooms')) {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const roomId = url.searchParams.get('room') || 'default-room';

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId)!.add(ws);

        ws.on('message', (data) => {
          const roomClients = rooms.get(roomId);
          if (!roomClients) return;
          for (const client of roomClients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(data.toString());
            }
          }
        });

        ws.on('close', () => {
          const roomClients = rooms.get(roomId);
          if (roomClients) {
            roomClients.delete(ws);
            if (roomClients.size === 0) rooms.delete(roomId);
          }
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
  },
});
