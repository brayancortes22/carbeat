# CarBeat — Protocolo de Sala y Mensajería (RoomProtocol v1.1)

[[README]]

---

## 📦 Formato de Trama (Payload)

Todas las tramas son objetos JSON serializados en UTF-8:

```json
{
  "type": "NOMBRE_DEL_EVENTO",
  "roomId": "BEAT-784",
  "senderId": "uuid-v4-del-cliente",
  "senderName": "Sebas",
  "timestamp": 1729023400000,
  "payload": {}
}
```

---

## 📡 Catálogo de Eventos

| Evento | Origen | Destino | Descripción | Payload Requerido |
|--------|--------|---------|-------------|-------------------|
| `ROOM_JOIN` | DJ | Host | Petición para unirse a la sala | `{ djName: string }` |
| `DJ_HEARTBEAT` | DJ | Host / Nube | Latido de presencia cada 3s para conteo real | `{ djName: string }` |
| `ROOM_LEAVE` | DJ | Host / Nube | Salida limpia del DJ | `{ djName: string }` |
| `SYNC_CATALOG` | Host → DJ | DJ | Catálogo, cola deduplicada y estado | `{ catalog, queue, currentTrack, isPlaying, currentTime, duration }` |
| `PLAYBACK_STATE` | Host → Todos | Todos | Estado de reproducción cada 1s | `{ isPlaying, currentTime, duration, currentTrack }` |
| `QUEUE_TRACK` | DJ → Host | Host | Solicitud de encolar pista (suma votos si ya existe) | `{ track: Track, requestedBy: string }` |
| `VOTE_TRACK` | DJ → Host | Host | Votar (+1/-1) por canción en cola | `{ queueId: string, delta: number }` |
| `NEW_TRACK_OFFER` | DJ → Host | Host | Nueva canción ofrecida por pasajero | `{ track: Track }` |
| `HOST_ANNOUNCE` | Host → Descubrimiento | DJs / Nube | Anuncio de presencia del Host cada 2.5s | `{ roomId, roomName, hostIp, port, djCount, timestamp }` |

---

## 🔌 Endpoints de Sincronización y Descubrimiento

| Endpoint | Protocolo | Propósito |
|----------|-----------|-----------|
| `/api/room?action=discover` | HTTP GET | Descubrimiento de hosts/carros activos en la nube |
| `/api/room?roomId=XXX` | HTTP GET | Verificación de existencia de sala y estado vivo |
| `/api/room` | HTTP POST | Relay Serverless de eventos (`HOST_ANNOUNCE`, `QUEUE_TRACK`, `DJ_HEARTBEAT`, etc.) |
| `/ws-rooms` | WebSocket | Comunicación de sala de baja latencia en red local (5173) |
| `/ws-discovery` | WebSocket | Descubrimiento local en red Wi-Fi (5173) |

---

## 🎵 Tipos de Datos

### Track
```typescript
{
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;      // segundos
  source: 'local_car' | 'passenger_dj' | 'online';
  coverUrl: string;
  audioUrl: string;
  addedBy?: string;
}
```

### QueueItem
```typescript
{
  queueId: string;
  track: Track;
  votes: number;
  requestedBy: string;
  requestedAt: number;   // timestamp
}
```

---

## 🔄 Flujo de Sincronización

```
DJ (celular)                              Host (pantalla del carro)
     |                                          |
     |---- ROOM_JOIN {djName} ---------------->|
     |                                          |
     |<--- SYNC_CATALOG {catalog, queue, state}|
     |                                          |
     |---- QUEUE_TRACK {track, requestedBy} --->|
     |                                          |
     |<--- SYNC_CATALOG {updatedQueue} ---------|
     |                                          |
     |<--- PLAYBACK_STATE {isPlaying, time} ----| (cada 1s)
     |                                          |
```

---

## ⚠️ Reglas de Conexión

1. **El DJ debe conocer la IP del host** para conectarse por red remota
2. **BroadcastChannel solo funciona en el mismo dispositivo** (mismo navegador)
3. **WebSocket es el único canal entre dispositivos diferentes**
4. **Reconexión automática:** Si el WebSocket se cae, se reintenta cada 1.5s
5. **Cola de reintentos:** Si el socket está conectando, los mensajes se encolan y se envían al abrir

---

> 💡 **Tip para Obsidian:** Esta nota se conecta a `[[README]]` y documenta el protocolo actualizado después de las correcciones de sincronización.