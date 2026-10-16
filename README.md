# 🚗 CarBeat: Collaborative In-Car Jukebox & DJ System

Sistema colaborativo de música en tiempo real para vehículos y viajes. Convierte la pantalla del carro (Tablet, Android Auto, Navegador) en un reproductor central (Host) y permite que los pasajeros se unan como DJs desde sus teléfonos móviles sin descargas obligatorias para proponer y votar canciones en vivo.

---

## 🌟 Características Principales

- **Reproducción Completa al 100% (Sin Cortes de 30 Segundos):**
  - Motor Híbrido Universal: Integración con **YouTube Music (IFrame API)** para canciones completas de 3 a 6+ minutos con calidad oficial.
  - Soporte **Audius Direct Stream (MP3 completo)** y archivos locales (USB / almacenamiento del vehículo).
  - Auto-actualizador transparente: Las pistas de catálogo con clips breves se resuelven y enlazan automáticamente a su versión completa en YouTube.
- **Descubrimiento Automático por Wi-Fi:**
  - Los DJs pueden pulsar *"Escanear Carros Cercanos"* y detectar el Host del vehículo en menos de 1 segundo mediante el protocolo WebSocket de descubrimiento (`/ws-discovery`) con caché inmediata.
  - Auto-resolución de IPs de red local (LAN/Hotspot) para evitar problemas de conexión al apuntar a `localhost`.
- **Sincronización Tri-Capa Resiliente (OmniRoute Pattern):**
  - **Capa 1 (WebSocket Local):** Ultra baja latencia (<20ms) en la red local o punto de acceso Wi-Fi del vehículo.
  - **Capa 2 (WebRTC P2P DataChannel con PeerJS):** Conexión directa peer-to-peer cifrada que funciona tanto en despliegues cloud (Vercel) como a través de datos móviles 4G/5G.
  - **Capa 3 (BroadcastChannel):** Sincronización inmediata entre pestañas del mismo navegador para desarrollo y pruebas.
- **Búsqueda Multi-Fuente:**
  - Búsqueda en YouTube Music (protocolo Innertube WEB_REMIX), Audius y catálogo local.

---

## 🛠️ Arquitectura Técnica

```
[ Car Screen / Host ]
   ├── AudioEngine (Híbrido)
   │     ├── YouTubePlayerBridge (YouTube IFrame API - Full Songs)
   │     └── HTML5 Audio (USB / Audius MP3)
   └── RoomChannel (Tri-Capa)
         ├── Capa 1: WebSocket Local (/ws-rooms)
         ├── Capa 2: WebRTC DataChannel (PeerJS P2P: carbeat-room-{ID})
         └── Capa 3: BroadcastChannel
               ▲
               │ Sincronización en tiempo real
               ▼
[ Mobile Passengers / DJs ]
   ├── DjView (Explorador + Cola de Votaciones)
   ├── HostScannerModal (Escaneo Wi-Fi /ws-discovery)
   └── OmniMusicGateway (Búsqueda en cascada)
```

---

## 🚀 Puesta en Marcha

### Requisitos
- Node.js 18+
- Red Wi-Fi o Hotspot compartido (para uso en vehículos)

### Instalación
```bash
npm install
```

### Ejecutar en Desarrollo
```bash
npm run dev
```

El servidor estará accesible en:
- Local: `http://localhost:5173`
- Red Local (Wi-Fi): `http://<TU_IP_LOCAL>:5173`

### Compilación para Producción
```bash
npm run build
```

---

## 🌿 Estrategia de Ramas Git (Regla de Oro)
1. `development`: Desarrollo activo y pruebas de integración.
2. `qa`: Aseguramiento de calidad y validación previa a producción.
3. `main`: Producción oficial y estable con despliegue automático a Vercel.

---

Desarrollado con pasión por **Brayan Stid Cortés Lombana (`bscl`)**.
