# 🚗 CarBeat — la rocola colaborativa del carro (v2.0.0)

El carro pone los parlantes; los pasajeros piden y votan canciones desde su celular, sin instalar
nada. La pantalla del carro (tablet, radio Android o un navegador) es el reproductor y la **única
fuente de verdad** de la sala: los celulares sólo envían intenciones y reciben fotos del estado.

- **Web:** portada con escena 3D, cabina del carro y pantalla del pasajero (React 19 + Vite 8).
- **APK Android** (`com.bscl.carbeat`, Capacitor 8, minSdk 26): modo carro y modo pasajero con
  escáner QR propio.
- **Relé** sin estado propio sobre Upstash Redis (Vercel) o en memoria (desarrollo y red local).

Documentación: [arquitectura](docs/architecture.md) · [protocolo de sala](docs/protocol.md) ·
[API del relé](docs/API_PROTOCOL.md) · [despliegue](docs/DEPLOY.md) · [guía de uso](docs/user-guide.md) ·
[sistema de diseño](docs/design-system.md) · [cambios](docs/CHANGELOG.md)

---

## Qué hace

| Quién | Qué puede hacer |
|---|---|
| **Carro** | Crear la sala (código tipo `VIBE-7KQ3` y QR), buscar en YouTube Music, **«+ Cola»** o **«Sonar ya»** en cada resultado, «Sonar ya» y quitar en cada canción de la cola, música guardada en el carro, historial, piloto automático y reglas de la sala. |
| **Pasajero** | Entrar con el código o el QR, buscar y **pedir**, votar 👍/👎 en la cola, pausar/saltar si el carro lo permite y **«Sonar ya»** si el carro lo permite. |

### Reglas de la sala (pestaña **Modos** del carro)

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Los pasajeros controlan la música | encendido | Pausar, saltar y volver desde el celular. |
| Los pasajeros pueden «Sonar ya» | **apagado** | Una canción (de la búsqueda o de la cola) suena de inmediato, sin esperar turno ni votos. Apagado, el carro responde «El conductor no permite “Sonar ya” a los pasajeros». |
| Canciones en espera por pasajero | 4 | Nadie llena la cola solo. |

### Piloto automático

Cuando la cola se vacía elige la siguiente: **Afín** (por defecto: primero música del carro del
mismo artista, si no, afines de internet), **Solo carro**, **Solo internet**, **Mezcla** (rota
géneros) o **Apagado**.

### La sala sobrevive a una recarga

El carro guarda por sala la cola, votos, historial, reglas, piloto y la canción con su posición
(cada 5 s y al cambiar; caduca a las 6 h; se borra al cerrar la sala). Al volver, la canción queda
en pausa en su segundo.

---

## Cómo se conecta un pasajero

El pasajero prueba varios caminos y usa el primero que funcione; el estado que ve es real
(«Buscando el carro…», «En vivo · red local», «En vivo · por internet»…):

1. **P2P** (PeerJS / WebRTC) directo con el carro.
2. **WebSocket** al relé local (`/ws-room`) en desarrollo o con `npm run lan`.
3. **BroadcastChannel** si carro y pasajero son pestañas del mismo navegador.
4. **HTTP** contra `/api/room` (Upstash Redis): el respaldo para redes móviles con NAT estricto.

Cada intención lleva un id único y el carro la aplica una sola vez aunque llegue por varios
caminos. Detalle en [docs/protocol.md](docs/protocol.md).

---

## Puesta en marcha

Requisitos: Node.js 22, y para el APK JDK 21 y el SDK de Android.

```bash
npm install
npm run dev          # web en http://localhost:5173 (también http://<IP-de-tu-PC>:5173)
npm run dev:app      # la app del APK en el navegador (/app.html)
npm test             # vitest
npm run build        # tsc -b + build web en dist/
```

`npm run dev` incluye la API (`/api/room`, `/api/yt/search`, `/api/yt/related`, `/api/version`) y
el relé WebSocket con un Redis **en memoria**: no hace falta Upstash para desarrollar.

### Red local sin internet

```bash
npm run lan          # compila la web y un servidor Node en el puerto 8080
```

Un portátil en el carro sirve web, API y relé a los celulares del mismo Wi-Fi o hotspot. Todo
funciona sin internet salvo la búsqueda de YouTube.

### APK Android

```bash
npm run cap:sync     # build en modo app (dist-app/) + cap sync android
cd android
./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`. En CI, `build-apk.yml` lo
compila en cada push a `main` y lo deja como artefacto `carbeat-android-apk`. Los APK que se
descargan desde la web están en `public/downloads/`.

### Producción (Vercel + Upstash)

Variables: `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (también se aceptan
`KV_REST_API_URL` / `KV_REST_API_TOKEN`). Sin ellas el relé cae a memoria, que en Vercel no sirve
(cada función tiene la suya). Opcional: `CARBEAT_IP_SALT` para el hash de IP de «carros cercanos».
Pasos en [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Estructura

```
shared/        protocolo v2, motor de la sala (room-engine) y códigos de sala: lo usan web, APK y servidor
server/        relé HTTP, relé WebSocket, Redis (Upstash o memoria), búsqueda YouTube Music, servidor LAN
api/           funciones de Vercel que llaman a server/
src/web/       portada, cabina del carro y pasajero (web)
src/app/       APK: modo carro, modo pasajero, escáner QR, puente nativo
src/core/      sesiones del carro y del pasajero, enlaces de red, reproductor, piloto automático
src/ui/        componentes (música, tablero, autopista 3D, controles) y escena 3D de la portada
```

---

## CI/CD (GitHub Actions)

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `deploy-vercel.yml` | push a `main`, `qa`, `development`; PR a `main` y `qa` | Compila y despliega con `vercel deploy --prebuilt`. |
| `build-apk.yml` | push a `main` o a mano | APK debug como artefacto. |
| `auto-approve-merge.yml` | `pull_request_target` | Valida con `npm run build` y fusiona PRs autorizados. |

Secrets: `PR_AUTOMATION_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
Variable: `AUTO_MERGE_SOURCE_USER`.

---

Desarrollado por **Brayan Stid Cortés Lombana (`bscl`)** y Diego.
