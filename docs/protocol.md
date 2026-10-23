# CarBeat — Protocolo de sala v2

Código: [`shared/protocol.ts`](../shared/protocol.ts) (tipos y validación) y
[`shared/room-engine.ts`](../shared/room-engine.ts) (reglas). Lo comparten la web, el APK y el
servidor. API HTTP del relé: [API_PROTOCOL.md](API_PROTOCOL.md).

## Modelo

- **El carro es la única fuente de verdad.** Los pasajeros no cambian el estado: envían
  **intenciones** y reciben **fotos** (`Snapshot`) con un número de revisión `rev` creciente.
- Cada intención viaja en un `Envelope` con un `id` único: aunque llegue por P2P, WebSocket,
  BroadcastChannel y HTTP a la vez, el carro la aplica **una sola vez**. En la v1 una petición
  contaba como dos votos (medido).
- Las fotos son idempotentes: recibir la misma dos veces no cambia nada; una con `rev` menor se
  descarta.

## Código de sala

`PREFIJO-XXXX`, con prefijo `BEAT`, `RIDE`, `VIBE`, `AUTO` o `RUTA` y cuatro caracteres de un
alfabeto sin ambigüedades (3.536.405 combinaciones). El pasajero puede escribirlo como quiera
(`vibe 7kq3`, `VIBE7KQ3`): se normaliza.

## Envelope

```ts
{ id: string; room: string; from: string /* id estable del dispositivo */; name: string; at: number; intent: Intent }
```

Tamaño máximo: 8 KiB.

## Intenciones

| `kind` | Campos | Qué hace el carro |
|---|---|---|
| `hello` | `name` | Registra o renueva al pasajero (se cae a los 60 s sin señales). |
| `bye` | — | El pasajero se va. |
| `request` | `track` | Si no suena nada, suena ya. Si ya está en la cola, suma un voto. Si no, entra a la cola. Rechaza si ya suena («Esa canción ya está sonando») o si el pasajero tiene `maxPendingPerRider` pendientes. |
| `vote` | `queueId`, `value` (−1, 0, 1) | Un voto por pasajero y canción; 0 lo retira. Si la puntuación es negativa y hay al menos `max(2, ⌈pasajeros/2⌉)` votos en contra, sale de la cola. |
| `control` | `action`: `toggle`, `next`, `prev` | Sólo si `settings.passengerControl`. |
| `play_now` | `queueId` **o** `track` | Sólo si `settings.passengerPlayNow` (apagado por defecto). Con `queueId`, saca esa canción de la cola y suena ya; con `track`, suena ya sin pasar por la cola. La canción que sonaba pasa al historial. |

Orden de la cola: más puntuación primero; a igualdad, lo pedido por una persona antes que lo del
piloto automático; y a igualdad, lo que se pidió antes.

Los rechazos vuelven al pasajero como aviso (`Notice`) dentro de la foto, p. ej.
«El conductor desactivó el control de los pasajeros», «El conductor no permite “Sonar ya” a los
pasajeros» o «Esa canción ya no está en la cola».

## Foto (`Snapshot`)

```ts
{
  v: 2; room; name; rev; sentAt;
  now: { track; isPlaying; position; duration; requestedBy? } | null;
  queue: QueueEntry[];      // { queueId, track, requestedBy, requestedById, requestedAt, autopilot, votes }
  history: Track[];         // últimas 12
  riders: { id, name }[];
  settings: { passengerControl: boolean; passengerPlayNow: boolean; maxPendingPerRider: number };
  notices: { id, to /* id del pasajero o '*' */, text, at }[];
  libraryRev?: number;      // versión del índice de la música del carro
  closed: boolean;
}
```

Máximo 96 KiB. El índice de la biblioteca del carro (`LibraryIndex`, hasta 600 entradas, 120 KiB)
viaja aparte y sólo cuando cambia `libraryRev`.

## Mensajes en la red

```ts
type WireMessage = { t: 'intent'; e: Envelope } | { t: 'snapshot'; s: Snapshot } | { t: 'library'; l: LibraryIndex };
```

Caminos (`src/core/room/links.ts`), en este orden de preferencia: P2P con PeerJS, WebSocket al
relé local (`/ws-room`), BroadcastChannel (`carbeat2-<sala>`, misma máquina) y HTTP
(`/api/room`). Reintentos de enlace a 1,5 / 3 / 5 / 8 / 12 s.

## Compatibilidad

Un carro anterior a `play_now` no conoce la intención y la ignora; un pasajero nuevo con un carro
viejo no ve «Sonar ya» porque la foto no trae `passengerPlayNow`.
