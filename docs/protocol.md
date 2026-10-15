# CarBeat: Protocolo de Sala y Mensajería (RoomProtocol v1.0)

## 1. Formato de Trama (Payload)
Todas las tramas son objetos JSON serializados en UTF-8 con la siguiente estructura base:

```json
{
  "type": "NOMBRE_DEL_EVENTO",
  "roomId": "BEAT-123",
  "senderId": "uuid-v4-del-cliente",
  "timestamp": 1729023400000,
  "payload": {}
}
```

## 2. Catálogo de Eventos

| Evento | Origen | Destino | Descripción | Payload Requerido |
| :--- | :--- | :--- | :--- | :--- |
| `ROOM_JOIN` | DJ | Host | Petición para unirse a la sala con un alias. | `{ djName: string, avatar: string }` |
| `ROOM_JOINED` | Host | DJ | Confirmación de entrada con estado actual. | `{ success: boolean, roomName: string, currentTrack: Track \| null, queue: QueueItem[] }` |
| `SYNC_CATALOG` | Host | DJ | Lista completa de canciones locales disponibles. | `{ tracks: Track[] }` |
| `QUEUE_TRACK` | DJ | Host | Solicitud de encolar una pista. | `{ trackId: string, trackTitle: string, artist: string }` |
| `VOTE_TRACK` | DJ | Host | Voto a favor (+1) o en contra (-1) de una pista en cola. | `{ queueItemId: string, delta: 1 \| -1 }` |
| `NEW_TRACK_OFFER` | DJ | Host | Notificación de envío de nueva canción descargada por DJ. | `{ title: string, artist: string, duration: number, audioBlobUrl: string }` |
| `PLAYBACK_STATE` | Host | Todos | Difusión periódica de estado (play/pause/seek). | `{ isPlaying: boolean, currentTime: number, duration: number, track: Track \| null }` |
| `HOST_COMMAND` | Host | Host | Comandos de control administrativo (skip, prev, mute). | `{ action: "NEXT" \| "PREV" \| "TOGGLE" \| "REMOVE", targetId?: string }` |
