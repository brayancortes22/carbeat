// Servidor de red local: un portátil o PC dentro del carro sirve la web, la API y el relé
// WebSocket a los teléfonos conectados al mismo Wi-Fi o hotspot. Sin internet funciona todo
// menos la búsqueda en YouTube (que necesita salir a internet).
//
// Uso: npm run lan   (compila la web y este servidor, y lo arranca en el puerto 8080)
//
// Sustituye a server/ws-server.mjs, que tenía sintaxis de TypeScript dentro de un .mjs y no
// llegaba a arrancar (SyntaxError en la línea 74).

import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { makeApiRouter } from './handlers.js';
import { MemoryRedis } from './redis.js';
import { createWsRelay } from './ws-relay.js';

const PORT = Number(process.env.PORT ?? 8080);
const ROOT = resolve(process.env.CARBEAT_WEB_DIR ?? 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.apk': 'application/vnd.android.package-archive',
};

const api = makeApiRouter(new MemoryRedis());
const relay = createWsRelay();

const server = createServer(async (req, res) => {
  if (await api(req, res)) return;
  const url = new URL(req.url ?? '/', 'http://localhost');
  // normalize + comprobación de prefijo: impide salir de dist/ con "../".
  let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Falta la web compilada: ejecuta npm run build');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.on('upgrade', (req, socket, head) => {
  if (!relay.handleUpgrade(req, socket, head)) socket.destroy();
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n!.address);
  console.log(`[CarBeat LAN] sirviendo ${ROOT}`);
  for (const ip of ips) console.log(`[CarBeat LAN] abre en los teléfonos: http://${ip}:${PORT}`);
});

const stop = () => {
  relay.close();
  server.close(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
