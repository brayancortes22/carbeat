import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = process.env.PORT || 4001;
const server = createServer();
const wss = new WebSocketServer({ server });

// Mapeo en memoria de salas: Map<roomId, Set<WebSocket>>
const rooms = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('room') || 'default-room';

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(ws);

  ws.on('message', (data) => {
    try {
      const roomClients = rooms.get(roomId);
      if (!roomClients) return;

      // Retransmitir a los demás clientes de la sala
      for (const client of roomClients) {
        if (client !== ws && client.readyState === 1) { // 1 = OPEN
          client.send(data.toString());
        }
      }
    } catch (err) {
      console.error('[RelayServer] Error retransmitiendo mensaje:', err);
    }
  });

  ws.on('close', () => {
    const roomClients = rooms.get(roomId);
    if (roomClients) {
      roomClients.delete(ws);
      if (roomClients.size === 0) {
        rooms.delete(roomId);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`[CarBeat Relay] Servidor de salas activo en puerto ${PORT}`);
});
