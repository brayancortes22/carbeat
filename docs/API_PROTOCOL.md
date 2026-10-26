# CarBeat — API y protocolo de red (v2.2.0)

CarBeat usa cuatro caminos para conectar el carro con los pasajeros: **P2P (WebRTC)**,
**WebSocket local**, **BroadcastChannel** (misma pestaña) y **HTTP (relé)**. El servidor es un
buzón: no aplica reglas; el carro es la única fuente de verdad.

## 1. API HTTP `/api/room`

Base: `https://<tu-dominio>/api/room` (o `http://<IP>:5173` en desarrollo, `:8080` con
`npm run lan`).

### Consultas del pasajero / diagnóstico (GET)

| Consulta | Respuesta | Uso |
|---|---|---|
| `?op=health` | `{ ok: true, store: "upstash" \| "memory" }` | Comprobar el almacén. |
| `?op=state&room=CODE&rev=N` | `{ exists, closed?, unchanged?, rev?, snapshot?, age? }` | Última foto de la sala; con `rev` sólo dice si cambió. |
| `?op=library&room=CODE` | `{ library }` | Biblioteca publicada por el carro. |
| `?op=nearby` | `{ rooms: [{ room, name }] }` | Salas del mismo hotspot/IP (últimos 90 s). |

`CODE` debe ser un código válido (`VIBE-7KQ3`). Si la sala no existe, `exists: false`; si el
carro la cerró, `closed: true`.

### Acciones del carro (POST, JSON)

| `op` | Cuerpo | Respuesta | Notas |
|---|---|---|---|
| `claim` | `{ op, room, name, token }` | `{ ok: true, room }` | Reserva el código. El token debe tener 24–128 caracteres; sólo se guarda su hash. |
| `sync` | `{ op, room, token, snapshot?, library? }` | `{ ok: true, intents: [] }` | Publica foto/biblioteca y recoge intenciones en una sola llamada. |
| `close` | `{ op, room, token }` | `{ ok: true, closed: true }` | Cierra la sala para todos. |

### Intención del pasajero (POST)

```json
{
  "op": "push",
  "envelope": {
    "id": "intent-id",
    "room": "VIBE-7KQ3",
    "from": "client-id",
    "name": "Sebas",
    "intent": { "kind": "request", "track": { "...": "..." } }
  }
}
```

Respuesta `202 { ok: true }`. El carro la valida otra vez antes de aplicarla.

### Límites y errores

- Intención: **8 KiB**; foto: **96 KiB**; biblioteca: **120 KiB**; cuerpo HTTP máximo: **128 KiB**.
- `400` datos inválidos · `401` falta token · `403` token incorrecto · `404` sala inexistente o
  carro desconectado · `409` código en uso · `410` sala cerrada · `413` payload demasiado grande ·
  `502` almacén no disponible.

## 2. WebSocket local `/ws-room`

Mismo host y puerto que la web (`:5173` en desarrollo, `:8080` con `npm run lan`):

```
ws://<IP_DEL_CARRO>:8080/ws-room?room=VIBE-7KQ3&role=host&client=<id>&token=<token>
ws://<IP_DEL_CARRO>:8080/ws-room?room=VIBE-7KQ3&role=rider&client=<id>
```

Los mensajes usan el mismo contrato `WireMessage` en JSON que el resto de canales
(`shared/protocol.ts`). El carro publica `snapshot` y `library`; los pasajeros envían `intent`.
Un solo carro por código: el primero que se registra con su token manda.

## 3. P2P WebRTC (PeerJS)

- **Peer del carro:** `carbeat2-<codigo_sala>` (sólo minúsculas y alfanuméricos; ejemplo:
  `carbeat2-vibe7kq3`).
- **Canal:** `RTCDataChannel` confiable y ordenado.
- **Mensajes:** el mismo `WireMessage`; las intenciones llevan id único para aplicarse una sola vez.
- **Archivos locales:** los MP3 de los pasajeros viajan por el DataChannel en fragmentos; el
  tamaño máximo aceptado se valida en el carro.

## 4. Protocolo de sala v2

El detalle de intenciones, fotos, revisión (`rev`), votos, reglas y «Sonar ya» está en
[protocol.md](protocol.md). El motor puro vive en `shared/room-engine.ts` y está cubierto por
`shared/room-engine.test.ts`.
