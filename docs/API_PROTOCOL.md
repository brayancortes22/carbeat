# CarBeat: Especificación de API y Protocolo de Red v2.2

Este documento detalla la interfaz de red REST, WebSocket y WebRTC para desarrolladores e integradores de CarBeat.

---

## 1. Endpoints de Señalización y Salas (Cloud Relay)

* **`POST /api/room`**
  - **Propósito:** Registro y anuncio de heartbeat de la sala desde la cabina (Host).
  - **Body:** `{ "room": "VIBE-7KQ3", "role": "host", "token": "..." }`
  - **Respuesta:** `{ "ok": true, "version": "2.2.0" }`

* **`GET /api/room?room=VIBE-7KQ3`**
  - **Propósito:** Verificación de existencia de sala para pasajeros.
  - **Respuesta:** `{ "exists": true, "hostOnline": true, "name": "Carro VIBE-7KQ3" }`

* **`POST /api/relay`**
  - **Propósito:** Canal de señalización WebRTC (ICE candidates y SDP offers/answers).

---

## 2. Enlace Local LAN (Offline sin Internet)

Cuando el vehículo no cuenta con conexión de datos a internet, CarBeat utiliza la red local Wi-Fi / Hotspot del carro:

* **URL del WebSocket local:** `ws://<IP_HOST>:3001` (o `ws://localhost:3001` en simulador).
* **Protocolo:** Mismo contrato `WireMessage` serializado en JSON.
* **Latencia promedio:** **< 15 milisegundos**, garantizando respuesta táctil inmediata sin consumir datos móviles.

---

## 3. Canales P2P WebRTC (DataChannel)

* **Identificador de Peer del Host:** `carbeat2-<codigo_sala>` (ej. `carbeat2-vibe7kq3`).
* **Canal:** `RTCDataChannel` confiable y ordenado.
* **Transferencia de MP3:** Chunks binarios para archivos locales de pasajeros de hasta 25 MB.
