import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 5173;
const PUBLIC_DIR = path.resolve(process.cwd(), 'dist');

// Mapeo en memoria de salas: Map<roomId, Set<WebSocket>>
const rooms = new Map();

// Contador de conexiones por sala para el badge de DJs
const roomDjCount = new Map();

// Función para servir archivos estáticos (fallback para modo producción)
function serveFile(res, filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Archivo no encontrado');
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Rutas de WebSocket se manejan por separado en 'upgrade'
  if (url.pathname === '/ws-rooms' || url.pathname === '/ws-discovery') {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Use WebSocket connection');
    return;
  }

  // En desarrollo, redirigir a Vite. En producción, servir archivos estáticos.
  if (process.env.NODE_ENV === 'production' && PUBLIC_DIR && fs.existsSync(PUBLIC_DIR)) {
    const filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    serveFile(res, filePath);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CarBeat WebSocket Server running. Use npm run dev for full app.');
  }
});

const wss = new WebSocketServer({ server, path: '/ws-rooms' });
const discoveryWss = new WebSocketServer({ server, path: '/ws-discovery' });

// === Sala de música (/ws-rooms) ===
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('room') || 'default-room';

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
    roomDjCount.set(roomId, 0);
  }
  rooms.get(roomId)!.add(ws);
  roomDjCount.set(roomId, (roomDjCount.get(roomId) || 0) + 1);

  console.log(`[CarBeat WS] Cliente conectado a sala: ${roomId} (total: ${rooms.get(roomId)!.size})`);

  ws.on('message', (data) => {
    const roomClients = rooms.get(roomId);
    if (!roomClients) return;

    try {
      const msg = JSON.parse(data.toString());
      console.log(`[CarBeat WS] Mensaje en sala ${roomId}: ${msg.type} de ${msg.senderName}`);

      // Retransmitir a TODOS los clientes de la sala (incluyendo al remitente para confirmación)
      for (const client of roomClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data.toString());
        }
      }
    } catch (err) {
      console.error('[CarBeat WS] Error procesando mensaje:', err);
    }
  });

  ws.on('close', () => {
    const roomClients = rooms.get(roomId);
    if (roomClients) {
      roomClients.delete(ws);
      roomDjCount.set(roomId, Math.max(0, (roomDjCount.get(roomId) || 1) - 1));
      if (roomClients.size === 0) {
        rooms.delete(roomId);
        roomDjCount.delete(roomId);
        console.log(`[CarBeat WS] Sala vacía eliminada: ${roomId}`);
      }
    }
    console.log(`[CarBeat WS] Cliente desconectado de sala: ${roomId}`);
  });

  ws.on('error', (err) => {
    console.error('[CarBeat WS] Error de conexión:', err);
  });
});

// === Descubrimiento de hosts (/ws-discovery) ===
const discoveryClients = new Set();

discoveryWss.on('connection', (ws) => {
  discoveryClients.add(ws);
  console.log(`[CarBeat Discovery] Cliente conectado (total: ${discoveryClients.size})`);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'HOST_ANNOUNCE') {
        console.log(`[CarBeat Discovery] Anuncio de host: ${msg.roomName} (${msg.roomId})`);
        // Retransmitir a TODOS los clientes EXCEPTO al remitente
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
    console.log(`[CarBeat Discovery] Cliente desconectado (total: ${discoveryClients.size})`);
  });

  ws.on('error', (err) => {
    console.error('[CarBeat Discovery] Error:', err);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[CarBeat] Servidor WebSocket activo en puerto ${PORT}`);
  console.log(`[CarBeat] Acceso local: http://localhost:${PORT}`);
  console.log(`[CarBeat] Acceso en red: http://0.0.0.0:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n[CarBeat] Cerrando servidor...');
  wss.close();
  discoveryWss.close();
  server.close();
  process.exit(0);
});
