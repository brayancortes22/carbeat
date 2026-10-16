# 🚗 CarBeat: Collaborative In-Car Jukebox & DJ System (v1.2.0)

Sistema colaborativo de música en tiempo real para vehículos y viajes. Convierte la pantalla del carro (Tablet, Android Auto, Navegador) en un reproductor central (Host) y permite que los pasajeros se unan como DJs desde sus teléfonos móviles sin descargas obligatorias para proponer y votar canciones en vivo.

---

## 🌟 Novedades de la Versión 1.2.0

- **🤖 Modo Autopilot IA (DJ Autónomo Inteligente):**
  - Cuando la cola se vacía o queda una sola canción, el motor de IA predice y encola de **1 en 1** temas armónicamente afines basados en lo que está sonando (`/api/yt/related`).
  - Previene saturaciones de red o peticiones masivas y filtra canciones ya reproducidas.
- **🚗 Biblioteca Personal del Chofer:**
  - El conductor puede guardar pistas individuales o vaciar la cola de pasajeros a su colección personal persistente (`driver_library_v1`).
  - Acceso instantáneo a su propia música desde el botón "Mi Música" para reproducirla en cualquier momento durante el viaje.
- **⚡ Purga de Cola de un Solo Tacazo:**
  - Botón "Vaciar" en el panel del carro para eliminar todas las peticiones de los pasajeros de inmediato con confirmación de seguridad y sincronización instantánea a todos los celulares.
- **🏷️ Distinción Visual de Origen de Pistas:**
  - Badges intuitivos en tiempo real tanto en la pantalla del vehículo como en los celulares de los pasajeros:
    - `[🚗 Chofer / Carro]` para música del conductor o archivos locales/USB.
    - `[📱 Pasajero: Nombre]` para peticiones de los acompañantes.
    - `[✨ IA Autopilot]` para recomendaciones generadas por la IA.
- **🚪 Cierre de Sala y Expulsión Limpia:**
  - Al salir del Modo Carro, el reproductor apaga de inmediato el audio (`pause()`), destruye la sala en el backend y emite `CLOSE_ROOM`, mostrando un modal de fin de viaje y regresando a todos los pasajeros al inicio.
- **📱 App Móvil Android 100% Offline (Cero Pantallas Blancas):**
  - Empaquetado de assets locales (`dist/`) directo en el APK servido bajo `https://localhost` mediante Capacitor y Gradle.
  - Funciona de forma instantánea y completamente desconectada en cabinas vehiculares sin internet, sin errores de DNS (`net::ERR_NAME_NOT_RESOLVED`).
- **💾 Almacenamiento Local Dual e IndexedDB en la Tablet:**
  - Nueva pestaña en "Mi Música" para gestionar directamente los archivos de audio locales (.mp3, .flac, .wav) almacenados en la tablet/USB.
  - Carga automática en memoria al iniciar la cabina y escaneo directo con 1 tap.
- **⏮️ Historial Real de Pistas Previas:**
  - Botón de retroceso (`handlePrev`) con doble click (<2.5s) que navega hacia atrás en la pila histórica real de canciones reproducidas en lugar de simplemente reiniciar la canción actual.
- **🛡️ Cierre Atómico y Erradicación de Salas Fantasma:**
  - Purga de salas huérfanas en menos de 6 segundos en `/api/room` y extracción robusta de `roomId` desde POST body y query.
- **🔄 Auto-Actualización Dinámica de Versión y Descarga Directa:**
  - Notificación inteligente en tiempo real y descarga instantánea del APK compilado.

---

## 🛠️ Arquitectura Técnica

```
[ Car Screen / Host ]
   ├── AudioEngine (Híbrido)
   │     ├── YouTubePlayerBridge (YouTube IFrame API - Full Songs)
   │     └── HTML5 Audio (USB / Audius MP3)
   ├── RoomChannel (Cuatri-Capa Resiliente)
   │     ├── Capa 1: WebSocket Local (/ws-rooms)
   │     ├── Capa 2: WebRTC DataChannel (PeerJS P2P: carbeat-room-{ID})
   │     ├── Capa 3: HTTP Serverless Relay (/api/room en Vercel)
   │     └── Capa 4: BroadcastChannel (Local tabs)
   ├── AiAutopilotService (DJ Autónomo predictivo 1-a-1)
   └── DriverLibrary (Almacenamiento persistente del chofer)
         ▲
         │ Sincronización en tiempo real (<20ms local / <200ms cloud)
         ▼
[ Mobile Passengers / DJs ]
   ├── DjView (Explorador + Cola de Votaciones con Badges)
   ├── HostScannerModal (Escaneo Wi-Fi /ws-discovery + HTTP)
   ├── RoomClosedModal (Expulsión elegante al terminar el viaje)
   └── OmniMusicGateway (Búsqueda en YouTube Music, Audius y Catálogo)
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
1. `development`: Desarrollo activo y pruebas de integración de nuevas funcionalidades.
2. `qa`: Aseguramiento de calidad, staging y validación previa a producción.
3. `main`: Producción oficial y estable con despliegue automático a Vercel y compilación de APK en GitHub Actions.

---

Desarrollado con pasión por **Brayan Stid Cortés Lombana (`bscl`)**.
