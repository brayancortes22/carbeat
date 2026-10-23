# CarBeat — Arquitectura (v2)

## Idea central

El **carro** (host) guarda y decide todo: cola, votos, historial, reglas y qué suena. Los
pasajeros envían **intenciones** y pintan la última **foto** que reciben. El servidor es un buzón:
no aplica reglas. En la v1 el servidor y el carro aplicaban votos cada uno por su lado (dos
verdades) y una petición podía contar dos veces; la v2 lo resuelve con un único motor y una id
por intención. Formatos: [protocol.md](protocol.md).

```
  Pasajero (celular)                  Carro (tablet / radio / navegador)
  RiderSession ──intención──►  links: P2P · WebSocket · BroadcastChannel · HTTP  ──► HostSession
        ▲                                                                              │
        └──────────────── foto (Snapshot, rev creciente) ◄─────────────────────────────┘
                                         │ HTTP
                                         ▼
                              /api/room (relay.ts) ── Upstash Redis
```

## Piezas

| Capa | Archivos | Qué hace |
|---|---|---|
| Protocolo y reglas | `shared/protocol.ts`, `shared/room-engine.ts`, `shared/room-code.ts` | Tipos, validación de todo lo que entra, motor puro de la sala (pedir, votar, control, «Sonar ya», veto, orden de la cola). Con tests. |
| Carro | `src/core/room/host-session.ts`, `host-store.ts` | Aplica intenciones, controla el reproductor, publica fotos, piloto automático y guarda la sala en `localStorage` (6 h). |
| Pasajero | `src/core/room/rider-session.ts` | Envía intenciones, estado de conexión real, extrapola la posición de la canción. |
| Enlaces | `src/core/room/links.ts`, `relay-client.ts` | PeerJS (WebRTC), WebSocket local, BroadcastChannel y HTTP, con reintentos. |
| Servidor | `server/relay.ts`, `ws-relay.ts`, `redis.ts`, `handlers.ts`, `yt-music.ts`, `lan-server.ts`; `api/` | Relé HTTP con token del carro, relé WebSocket, Redis (Upstash o memoria), búsqueda de YouTube Music, servidor para red local. |
| Reproducción | `src/core/audio/` | YouTube IFrame API (con reintentos: en el WebView del APK tardaba 10,3 s en cargar, medido) y audio local. |
| Música y piloto | `src/core/search.ts`, `library.ts`, `autopilot.ts` | Búsqueda unificada, música del carro, modos Afín / Solo carro / Solo internet / Mezcla / Apagado. |
| Web | `src/web/` | Portada (escena 3D), cabina del carro y pasajero. |
| APK | `src/app/` | Modo carro (riel, cajón, inmersivo, horizontal, pantalla encendida, hápticos) y modo pasajero (pestañas abajo, escáner QR con jsQR). |
| Interfaz | `src/ui/` | Componentes de música, tablero (agujas, testigos, placa), autopista 3D de la cola y escena `three/NightDrive`. Diseño: [design-system.md](design-system.md). |

## 3D

- **Portada** (`src/ui/three/NightDrive.tsx`): geometría procedural, sin modelos ni texturas que
  descargar; 155–165 FPS en una RTX 4060. Al desmontarla se libera la LUT DFG de three r186, que
  si no retiene el renderer en cada ida y vuelta (medido: 0,609 → 0,145 MB por ciclo en
  producción).
- **Autopista de la cola** (`src/ui/three/QueueHighway.tsx`): letreros de las próximas canciones
  en la cabina; se puede apagar y cae a letreros planos sin WebGL o con ahorro de datos.

## Despliegue

Vercel (web + funciones `api/`) con Upstash Redis; red local con `npm run lan`; APK con
Capacitor 8. Ver [DEPLOY.md](DEPLOY.md).
