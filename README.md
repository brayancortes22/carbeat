# 🚗 CarBeat: Collaborative In-Car Jukebox & DJ System (v1.5.1)

Sistema colaborativo de música en tiempo real para vehículos y viajes por carretera. Convierte la pantalla del carro (Tablet, Android Auto, Navegador) en un reproductor central (Host) y permite que los pasajeros se unan como DJs desde sus teléfonos móviles sin descargas obligatorias para proponer, votar canciones y controlar la música de la cabina en vivo.

---

## 🌟 Novedades de la Versión 1.5.1

### 1. 🔀 Modos Inteligentes de Autopilot IA (Híbrido, Local, Nube y Mix Crossover)
- **⚡ Modo Híbrido (Por Defecto):** Mezcla inteligente que prioriza música local de la tablet/USB del chofer y complementa con recomendaciones armónicas en la nube vía YouTube Music (`/api/yt/related`).
- **💾 Modo Solo Local (Cero Datos):** 100% desconectado, diseñado para carreteras sin cobertura o para ahorrar el plan de datos.
- **🌐 Modo Solo Nube:** Búsqueda continua en streaming sin tocar archivos del vehículo.
- **🎉 Modo Mix Crossover Aleatorio:** Matriz multigénero exhaustiva que rota automáticamente entre:
  - *Rock en Español & Clásicos* (Soda Stereo, Enanitos Verdes, Hombres G, Vilma Palma, Queen)
  - *Reggaetón & Perreo Urbano* (Bad Bunny, Karol G, Feid, Don Omar, Daddy Yankee)
  - *Vallenato Romántico & Parranda* (Diomedes Díaz, Binomio de Oro, Silvestre Dangond)
  - *Salsa & Merengue* (Joe Arroyo, Grupo Niche, Marc Anthony, Héctor Lavoe)
  - *Música Popular & Despecho* (Yeison Jiménez, Darío Gómez, Jessi Uribe, Carin León)
  - *Cumbia & Tropical* (Los Ángeles Azules, Rodolfo Aicardi, Pastor López)
  - *Regional Mexicano, Rancheras, Pop Latino y Bachata*.

### 2. 🤖 Detección Automática Inteligente de Red (`Datos: Auto`)
- **Evaluación Telemática (`NetworkHealthService`):** Diagnóstico en vivo de latencia (RTT) y velocidad estimada con la Network Information API.
- **Asignación Dinámica:** Identifica automáticamente si la descarga o búsqueda debe consumirse con los datos del celular del pasajero (`📱 4G`) o de la pantalla del carro (`🚗 Wi-Fi`), conmutando según cuál tenga mejor señal.

### 3. 🕒 Historial de Reproducción con Guardado Individual y Masivo
- **Historial Completo del Viaje:** Pestaña dedicada en "Mi Música" que registra las canciones que han sonado en el trayecto de forma persistente (`carbeat_playback_history_v1`).
- **✨ Botón "Guardar TODAS en Mi Música":** Agrega con un solo toque todo el historial del viaje a la biblioteca personal del conductor.
- **Guardado Individual por Pista:** Botón táctil `[+]` por canción con confirmación visual `[✔]`.

### 4. 🎛️ Botón Táctil Ergonómico de Conducción Segura
- Botón directo `"Guardar en Mi Música"` (`BookmarkPlus`) en la pantalla de reproducción del carro para que el chofer lo presione sin desviar la atención al volante.
- Watchdog de fin de pista en `YouTubePlayerBridge` que previene congelamientos o pausas involuntarias al terminar canciones de streaming.

### 5. 📱 Blindaje Responsive Universal (100dvh & Safe-Areas)
- Soporte para **Dynamic Viewport Height (`100dvh`)** y Safe Area Insets (`env(safe-area-inset-top)` / `bottom`) para evitar recortes con la barra de navegación o el notch en cualquier modelo de iPhone, Samsung, Xiaomi o tablets vehiculares.
- Pestaña de Tendencias enriquecida con más de 20 éxitos y botón de refresco `[🔀 Nuevas Recomendaciones]`.

---

## 🛠️ Arquitectura Técnica de CarBeat

```
[ Car Screen / Tablet / Host ]
   ├── AudioEngine (Híbrido Universal)
   │     ├── YouTubePlayerBridge (IFrame API Watchdog - Full Songs)
   │     └── HTML5 Audio (USB / Audius MP3 / Tablet Storage)
   ├── RoomChannel (Cuatri-Capa Resiliente)
   │     ├── Capa 1: WebSocket Local (/ws-rooms)
   │     ├── Capa 2: WebRTC DataChannel (PeerJS P2P: carbeat-room-{ID})
   │     ├── Capa 3: HTTP Serverless Relay (/api/room en Vercel)
   │     └── Capa 4: BroadcastChannel (Local tabs)
   ├── AiAutopilotService (Híbrido / Local / Nube / Mix Crossover)
   ├── FolderWatcherService (Detección persistente de carpetas USB/Tablet)
   ├── NetworkHealthService (Telemetría de conexión y auto-enrutamiento de datos)
   └── DriverLibrary & PlaybackHistory (Almacenamiento persistente IndexedDB & LocalStorage)
         ▲
         │ Sincronización telemática (<20ms local / <150ms cloud)
         ▼
[ Mobile Passengers / DJs ]
   ├── DjView (Explorador + Cola de Votaciones con Badges)
   ├── DjNowPlayingCard (Control Remoto: Play/Pause/Next/Prev)
   ├── CatalogBrowser (Búsqueda Universal + Tendencias Rotativas + Auto Red)
   └── NewTrackModal (Búsqueda en YouTube Music, Apple/Spotify y Subida Local)
```

---

## 🚀 Puesta en Marcha

### Requisitos
- Node.js 18+
- Red Wi-Fi o Hotspot compartido (para uso vehicular)
- Android Studio / SDK (opcional, para compilar el APK)

### Instalación de Dependencias
```bash
npm install
```

### Ejecutar en Desarrollo (Vite + WebSocket Server)
```bash
npm run dev:all
```
- Local: `http://localhost:5173`
- Red Local (Wi-Fi): `http://<TU_IP_LOCAL>:5173`

### Compilación Web y Sincronización con Android
```bash
npm run build
npx cap sync android
```

### Compilar APK Android
```bash
cd android
./gradlew assembleDebug
```
El APK generado se ubica en: `public/downloads/carbeat-latest.apk`.

---

## 🌿 Estrategia de Ramas Git (Regla de Oro GEMINI.md)
1. `development`: Desarrollo activo, refactorizaciones e integración continua.
2. `qa`: Aseguramiento de calidad, staging y validación previa a producción.
3. `main`: Producción oficial y estable con despliegue automático a Vercel y descarga del APK.

---

Desarrollado con pasión por **Brayan Stid Cortés Lombana (`bscl`)**.
