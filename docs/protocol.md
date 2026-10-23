# CarBeat: Protocolo de Sala y Mensajería Telemática (RoomProtocol v2.2)

El protocolo v2 de CarBeat opera bajo el paradigma de **«El carro es la única fuente de verdad autoritativa»**. Todos los mensajes intercambiados entre el Host (cabina) y los Riders (pasajeros) siguen el contrato de tipos `WireMessage`.

---

## 1. Estructura de Mensajes Wire (`WireMessage`)

Los mensajes se transmiten en formato JSON UTF-8 a través de enlaces **P2P (WebRTC DataChannel)**, **LAN (WebSocket local `ws://localhost:3001`)** o **Relay Cloud (Upstash Redis)**.

```ts
export type WireMessage =
  | { kind: 'snapshot'; snapshot: RoomSnapshot }
  | { kind: 'intent'; id: string; from: string; intent: Intent }
  | { kind: 'patch'; from: number; to: number; patch: unknown }
  | { kind: 'ack'; id: string; ok: boolean; reason?: string }
  | { kind: 'ping'; t: number }
  | { kind: 'pong'; t: number };
```

---

## 2. Catálogo de Intenciones (`Intent`)

Los pasajeros envían intenciones al carro; el motor de sala (`room-engine.ts`) las evalúa, valida las reglas y emite los efectos correspondientes.

| Tipo de Intención | Parámetros | Comportamiento en Cabina |
| :--- | :--- | :--- |
| `request` | `track: Track`, `playNow?: boolean` | Solicita una canción. Si `playNow: true`, la canción corta la reproducción actual y suena de inmediato (si `passengerPlayNow` está habilitado). De lo contrario, se encola ordenadamente. |
| `play_now` | `queueId?: string`, `track?: Track` | Solicita reproducir de inmediato una canción ya existente en la cola (`queueId`) o una pista recién seleccionada (`track`). |
| `vote` | `queueId: string`, `value: -1 \| 0 \| 1` | Emite o anula el voto para una canción en la cola. Cada celular tiene estrictamente 1 voto por canción. |
| `control` | `action: 'play' \| 'pause' \| 'next' \| 'prev'` | Comandos de transporte emitidos por el conductor o pasajeros autorizados. |
| `hello` | `name: string` | Saludo inicial de un pasajero para registrarse a bordo de la sala. |
| `bye` | *(ninguno)* | Notificación de salida voluntaria de un pasajero. |

---

## 3. Estado de la Sala (`RoomSnapshot`)

```ts
export interface RoomSnapshot {
  room: string;
  version: number;
  now: PlayingTrack | null;
  position: number;
  queue: QueueEntry[];
  riders: Record<string, RiderState>;
  settings: RoomSettings;
  autopilot: AutopilotMode;
}
```

### Configuración de la Sala (`RoomSettings`):
* `passengerPlayNow: boolean`: Controla si los pasajeros tienen permiso para usar el botón "Sonar Ya" o si sólo pueden encolar.
* `autopilotMode: 'smart' | 'car_only' | 'party' | 'off'`: Modo del piloto automático cuando la cola se agota.
* `allowExplicit: boolean`: Filtro de contenido explícito.
* `votesToSkip: number`: Votos negativos necesarios para descartar una canción automáticamente.
