# CarBeat: Documentación Técnica de Arquitectura

## 1. Resumen Ejecutivo
CarBeat es un sistema de reproducción y control musical colaborativo diseñado para entornos de cabina vehicular y eventos sociales. Permite que múltiples usuarios (DJs) interactúen con una pantalla principal (Host/Reproductor) sin depender de conexión a internet constante ni de suscripciones de streaming restrictivas.

## 2. Componentes del Sistema

### 2.1 Host (Pantalla del Carro / Parlante Principal)
- **Responsabilidad:** Reproducción continua de audio, custodia de la biblioteca local, almacenamiento de música enviada por pasajeros (`/Music/DJ_Queue`), y difusión del estado de reproducción.
- **Plataformas Soportadas:** Android Auto / Pantallas Android chinas (APK nativa vía Capacitor), Tablets, Smart TVs y Navegadores en laptops.

### 2.2 Client / DJ (Celulares y Dispositivos de Pasajeros)
- **Responsabilidad:** Explorar el catálogo disponible, encolar pistas, votar por canciones y enviar pistas nuevas adquiridas con su plan de datos.
- **Plataformas Soportadas:** 
  - Android (APK nativa o PWA).
  - iOS / iPadOS (PWA instantánea vía Safari sin necesidad de sideloading ni App Store).
  - Web Desktop / Mobile.

## 3. Matriz de Transporte Híbrido

```
                 +---------------------------+
                 |    ConnectionManager      |
                 +---------------------------+
                               |
         +---------------------+---------------------+
         |                                           |
         v                                           v
+-------------------+                       +-------------------+
|   LAN Transport   |                       |  Cloud Transport  |
|  (WebSocket local |                       | (Relay WebSocket  |
|   192.168.x.x)    |                       |   Server Vercel)  |
+-------------------+                       +-------------------+
```

- **LAN Directo:** Se activa cuando Host y Client comparten el mismo segmento de red (Hotspot del carro o Wi-Fi doméstico).
- **Cloud Relay:** Se activa cuando los dispositivos están en redes distintas (ej. pasajero con datos móviles 4G/5G y Host en Wi-Fi o viceversa).

## 4. Descubrimiento de Hosts (ShareIt-style)

### 4.1 Protocolo de Anuncio

El Host anuncia su presencia cada 2 segundos a través de WebSocket (`/ws-discovery`) y BroadcastChannel:

```json
{
  "type": "HOST_ANNOUNCE",
  "roomId": "BEAT-784",
  "roomName": "Carro BEAT-784",
  "hostIp": "192.168.100.3",
  "port": 5173,
  "djCount": 0,
  "timestamp": 1729023400000,
  "announcerId": "ann_1729023400000_abc123"
}
```

### 4.2 Arquitectura de Conexión

```
                    Host (Pantalla del Carro)              DJ (Celular)
                           |                                      |
                           |  HOST_ANNOUNCE (cada 2s)            |
                           |----------------------------------->|
                           |                                      |
                           |<--- DJ se conecta a hostIp:port ----|
                           |   /ws-rooms?room=BEAT-784           |
                           |                                      |
                           |<--- SYNC_CATALOG {catalog, queue}   |
                           |   {currentTrack, isPlaying, ...}    |
                           |                                      |
```

### 4.3 Componentes de Red

| Módulo | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Host Announcer | `src/core/network/host-discovery.ts` | Anuncia presencia del Host cada 2s |
| Host Scanner | `src/core/network/host-discovery.ts` | Escucha anuncios y muestra hosts encontrados |
| Room Channel | `src/core/network/room-channel.ts` | Comunicación WebSocket de sala con reconexión |
| Vite WS Plugin | `vite.config.ts` | Servidor WebSocket integrado en desarrollo |

### 4.4 Endpoints WebSocket

| Endpoint | Propósito | Puerto |
|----------|-----------|--------|
| `/ws-rooms` | Comunicación de sala (cola, reproducción, votos) | 5173 |
| `/ws-discovery` | Descubrimiento de hosts cercanos (estilo ShareIt) | 5173 |

---

## 5. Módulos Adicionales de Última Generación

- **LocalScanner (`src/core/audio/local-scanner.ts`):** Permite indexar memorias USB completas y carpetas locales del carro en segundos con nombres limpios y soporte para MP3, FLAC y M4A.
- **MusicSearchService (`src/core/network/music-search-service.ts`):** Motor de búsqueda global sin necesidad de API Keys para que los pasajeros descubran millones de canciones usando sus datos móviles y las envíen a los parlantes del carro.
- **CI/CD Autónomo:** Pipeline configurado en `.github/workflows/deploy-vercel.yml` para despliegues continuos a Vercel.
