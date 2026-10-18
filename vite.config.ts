import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeApiRouter } from './server/handlers.ts';
import { MemoryRedis } from './server/redis.ts';
import { createWsRelay } from './server/ws-relay.ts';

// En desarrollo la API y el relé WebSocket corren dentro de Vite con el MISMO código que en
// Vercel (server/handlers.ts). Antes había una copia distinta aquí, con reglas de voto que no
// coincidían con producción.
function carbeatDevServer(): Plugin {
  const redis = new MemoryRedis();
  const api = makeApiRouter(redis);
  const relay = createWsRelay();
  return {
    name: 'carbeat-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Contadores del almacén en memoria: sirven para estimar el gasto en Upstash.
        if (req.url === '/api/_dev/stats') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ commands: redis.commandCount, requests: redis.requestCount, ...relay.stats() }));
          return;
        }
        if (!(await api(req, res))) next();
      });
      server.httpServer?.on('upgrade', (req, socket, head) => {
        relay.handleUpgrade(req, socket, head);
      });
      server.httpServer?.on('close', () => relay.close());
    },
  };
}

// Capacitor abre index.html: en el build de la app, app.html se renombra al terminar.
function appEntryAsIndex(): Plugin {
  return {
    name: 'carbeat-app-index',
    apply: 'build',
    closeBundle() {
      const from = resolve(import.meta.dirname, 'dist-app/app.html');
      if (existsSync(from)) renameSync(from, resolve(import.meta.dirname, 'dist-app/index.html'));
    },
  };
}

// Dos interfaces: la web (index.html) y la app Android (app.html, modo "app").
// La app se compila aparte, a dist-app/, que es lo que empaqueta Capacitor.
export default defineConfig(({ mode }) => {
  const isApp = mode === 'app';
  return {
    plugins: [react(), tailwindcss(), carbeatDevServer(), ...(isApp ? [appEntryAsIndex()] : [])],
    // La app no lleva public/: ahí están los APK de descarga (~100 MB) que acabarían dentro del APK.
    publicDir: isApp ? false : 'public',
    define: {
      __CARBEAT_TARGET__: JSON.stringify(isApp ? 'app' : 'web'),
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      allowedHosts: true,
    },
    build: {
      outDir: isApp ? 'dist-app' : 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        input: resolve(import.meta.dirname, isApp ? 'app.html' : 'index.html'),
      },
    },
  };
});
