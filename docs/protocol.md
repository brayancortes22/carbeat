# CarBeat — Protocolo de sala v2 (v2.2.0)

El carro es la **única fuente de verdad**. Los pasajeros no modifican el estado: envían
**intenciones** con un id único y reciben **fotos** (`Snapshot`) con una revisión creciente. El
motor puro vive en `shared/room-engine.ts`; los tipos y la validación, en `shared/protocol.ts`.

Los mensajes viajan igual por **P2P (WebRTC)**, **WebSocket local** (`/ws-room`),
**BroadcastChannel** (misma pestaña) y **HTTP** (`/api/room`). Cada intención se aplica una sola
vez aunque llegue por varios caminos.

## 1. Mensajes de cable (`WireMessage`)

```ts
export type WireMessage =
  | { t: 'intent'; e: Envelope }
  | { t: 'snapshot'; s: Snapshot }
  | { t: 'library'; l: LibraryIndex };
```

- **`intent`** — lo envía un pasajero (o el carro, para control).
- **`snapshot`** — foto completa del estado; la publica sólo el carro.
- **`library`** — índice de la música guardada en el carro (sin URLs).

## 2. Sobre (`Envelope`)

```ts
export interface Envelope {
  id: string;        // único por mensaje: deduplica entre transportes
  room: string;      // código de sala, p. ej. VIBE-7KQ3
  from: string;      // id estable del dispositivo del pasajero
  name: string;      // nombre visible
  at: number;        // reloj del emisor (informativo)
  intent: Intent;
}
```

## 3. Intenciones (`Intent`)

| Tipo | Parámetros | Efecto en el carro |
|---|---|---|
| `hello` | `name` | Registra al pasajero en la sala. |
| `bye` | — | Lo quita de la lista de pasajeros. |
| `request` | `track`, `playNow?` | Pide una canción. Si `playNow` y la regla lo permite, suena ya; si no, se encola. |
| `vote` | `queueId`, `value: -1 \| 0 \| 1` | Vota o anula el voto de una entrada de la cola. |
| `control` | `action: 'toggle' \| 'next' \| 'prev'` | Pausa/reanuda, salta o vuelve. Requiere `passengerControl` si lo envía un pasajero. |
| `play_now` | `queueId?` o `track?` | «Sonar ya»: adelanta una canción de la cola o de la búsqueda. Requiere `passengerPlayNow` si lo envía un pasajero. |

Los límites de validación están en `shared/protocol.ts`:

| Campo | Máximo |
|---|---|
| Nombre | 32 caracteres |
| Título | 160 |
| Artista / álbum | 120 |
| URL | 1024 |
| Id | 96 |
| Intención serializada | 8 KiB |
| Foto | 96 KiB |
| Biblioteca | 120 KiB |

Las URLs de audio sólo aceptan `http:`, `https:` o `data:audio/`; una pista `local_car` viaja
sólo con su id y el carro la resuelve en su biblioteca.

## 4. Foto de la sala (`Snapshot`)

```ts
export interface Snapshot {
  v: 2;
  room: string;
  name: string;
  rev: number;
  sentAt: number;
  now: NowPlaying | null;
  queue: QueueEntry[];
  history: Track[];
  riders: Rider[];
  settings: RoomSettings;
  notices: Notice[];
  libraryRev?: number;
  closed: boolean;
}
```

- `now`: canción actual con `isPlaying`, `position` y `duration`.
- `queue`: entradas con `queueId`, `track`, quién la pidió, `autopilot` y `votes`.
- `history`: últimas canciones reproducidas.
- `notices`: avisos para un pasajero (`to`) o para todos (`*`).
- `rev`: el pasajero sólo pinta fotos con revisión mayor; recibir la misma dos veces no cambia
  nada.

## 5. Reglas de la sala (`RoomSettings`)

| Campo | Tipo | Por defecto | Efecto |
|---|---|---|---|
| `passengerControl` | boolean | `true` | Los pasajeros pueden pausar, saltar y volver. |
| `passengerPlayNow` | boolean | `false` | Los pasajeros pueden usar «Sonar ya». |
| `maxPendingPerRider` | number | `4` | Canciones pendientes por pasajero. |

## 6. Piloto automático

`AutopilotMode`: `off`, `hybrid` (Afín), `local` (Solo carro), `cloud` (Solo internet),
`crossover` (Mezcla). Cuando la cola se vacía, el carro elige la siguiente según el modo; si no
encuentra nada, pausa y avisa «La cola está vacía».

## 7. Persistencia

El carro guarda por sala la cola, votos, historial, reglas, piloto y la canción con su posición
(cada 5 s y al cambiar). La sala caduca a las 6 h y se borra al cerrarla. Al recargar, la canción
queda en pausa en su segundo.
