# CarBeat — Arquitectura (v2.2.0)

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
| Protocolo y reglas | `shared/protocol.ts`, `shared/room-engine.ts`, `shared/room-code.ts` | Tipos, validación de todo lo que entra y motor puro de la sala (pedir, votar, control, «Sonar ya», veto, orden de la cola). Con tests. |
| Carro | `src/core/room/host-session.ts`, `host-store.ts` | Aplica intenciones, controla el reproductor, publica fotos, piloto automático y guarda la sala en `localStorage` (6 h). |
| Pasajero | `src/core/room/rider-session.ts` | Envía intenciones, estado de conexión real y extrapola la posición de la canción. |
| Enlaces | `src/core/room/links.ts`, `relay-client.ts` | PeerJS (WebRTC), WebSocket local, BroadcastChannel y HTTP, con reintentos. |
| Servidor | `server/relay.ts`, `ws-relay.ts`, `redis.ts`, `handlers.ts`, `yt-music.ts`, `lan-server.ts`; `api/` | Relé HTTP con token del carro, relé WebSocket, Redis (Upstash o memoria), búsqueda de YouTube Music y servidor para red local. |
| Reproducción | `src/core/audio/audio-player.ts`, `youtube-player-bridge.ts`, `equalizer-service.ts`, `background-playback.ts` | YouTube IFrame API con reintentos, audio local, ecualizador de 3 bandas y sesión de reproducción en segundo plano. |
| Música y piloto | `src/core/search.ts`, `library.ts`, `autopilot.ts` | Búsqueda unificada, música del carro, escáner USB recursivo y modos Afín / Solo carro / Solo internet / Mezcla / Apagado. |
| Web | `src/web/` | Portada (escena 3D), cabina del carro y pantalla del pasajero. |
| APK | `src/app/`, `android/` | Modo carro (riel, cajón, inmersivo, horizontal, pantalla encendida, hápticos), modo pasajero (pestañas abajo, escáner QR con jsQR) y plugins nativos. |
| Interfaz | `src/ui/` | Componentes de música, tablero (agujas, testigos, placa), autopista 3D de la cola y escena `three/NightDrive`. Diseño: [design-system.md](design-system.md). |

## Audio y pantalla apagada

La reproducción real sigue en JS (`AudioEngine`): `<audio>` HTML5 para archivos locales, MP3
directos y Audius; YouTube IFrame para las canciones completas.

- **APK:** `BackgroundAudioService.java` es un servicio en primer plano `mediaPlayback` con
  `PARTIAL_WAKE_LOCK` y `WifiLock`. Mantiene vivo el WebView y la conexión de la sala cuando la
  pantalla se apaga o la app pasa a segundo plano. Los wake locks solo se mantienen mientras
  `playing` es verdadero.
- **Controles del sistema:** el servicio publica una `MediaSession` con título, artista, carátula
  y botones anterior / play-pausa / siguiente. `BackgroundAudioPlugin.java` traduce esos botones a
  acciones de la sala (`toggle`, `next`, `prev`).
- **Modo luna:** `src/ui/useScreenOff.tsx` baja el brillo de la ventana a cero y pinta una capa
  negra. Android sigue considerando la pantalla encendida, así que YouTube no recibe la señal de
  «pantalla apagada» y sigue sonando. Un toque o el botón *Atrás* devuelven el brillo.
- **Web / PWA:** `src/core/audio/background-playback.ts` usa la Media Session API del navegador
  para metadatos y controles. En el APK se omite para no duplicar la notificación nativa.
- **Límite de YouTube:** con el botón físico de apagado, YouTube puede pausar por su propia
  política. El audio local/HTML5 sí sigue gracias al servicio. Para YouTube hay que usar el botón
  luna.
- **Cierre:** el servicio se detiene al cerrar la cabina o salir de la pantalla del carro
  (`stopWithTask="true"`), para no dejar música fantasma al cerrar desde *Recientes*.

## Gráficos y rendimiento

- **Detección de hardware** (`src/core/device/graphics-detector.ts`): prueba la compilación de
  shaders antes de cargar WebGL y detecta equipos modestos (`deviceMemory <= 2 GB`, CPUs lentas).
  Si no hay GPU fiable, activa el **Modo 2D Ligero Atmosférico**.
- **`ThreeErrorBoundary`:** protege la portada y la autopista de la cola. Si la GPU pierde el
  contexto, la interfaz cae a letreros planos 2D sin tumbar la app ni cortar el audio.
- **Autopista de la cola** (`src/ui/car/HighwayStrip.tsx`): letreros de las próximas canciones en
  la cabina; se puede apagar y usa el fallback 2D sin WebGL o con ahorro de datos.
- **Portada 3D** (`src/ui/three/NightDrive.tsx`): geometría procedural, sin modelos ni texturas que
  descargar. Al desmontarla se libera la LUT DFG de three para no retener el renderer en cada ida
  y vuelta.

## Música del carro

- `src/core/library.ts` indexa archivos locales y memorias USB con `crawlDirectory` (hasta 12
  niveles), soporta `.mp3`, `.m4a`, `.wma`, `.flac`, `.wav`, `.aac`, `.ogg` y `.opus`, y genera IDs
  compatibles con WebViews antiguas.
- Los pasajeros pueden enviar MP3 locales por el canal P2P (WebRTC DataChannel / LAN) sin gastar
  internet.
- `equalizer-service.ts` aplica filtros biquad de bajos (80 Hz), medios (1 kHz) y agudos (8 kHz)
  con presets automotrices; los ajustes se guardan en el dispositivo.

## Despliegue

Vercel (web + funciones `api/`) con Upstash Redis; red local con `npm run lan`; APK con Capacitor
8, minSdk 26 y targetSdk 36. Ver [DEPLOY.md](DEPLOY.md).
