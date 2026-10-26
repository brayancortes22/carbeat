# CarBeat — Registro de Versiones y Changelog Oficial

## [Sin publicar] — 2026-10-26
### 🌙 Música con la Pantalla Apagada y Documentación Sincronizada
1. **Servicio de Audio en Primer Plano (APK):**
   - `BackgroundAudioService.java` mantiene vivo el WebView con `PARTIAL_WAKE_LOCK` y `WifiLock` mientras suena la música.
   - `MediaSession` nativa con notificación y controles anterior / play-pausa / siguiente, traducidos a acciones de la sala.
   - El servicio se detiene al cerrar la cabina o salir desde *Recientes* (`stopWithTask="true"`).
2. **Modo «Pantalla Apagada»:**
   - Botón luna en la cabina y en *Modos > Pantalla apagada*: brillo de ventana a cero + capa negra, sin que Android apague el WebView.
   - Es la opción recomendada para YouTube; con el botón físico, YouTube puede pausarse por su política. El audio local/HTML5 sigue gracias al servicio.
   - En web/PWA se usa la Media Session API del navegador.
3. **Documentación:**
   - README, arquitectura, API, protocolo, despliegue y guía de uso sincronizados a la v2.2.0.
   - Se recuperó la documentación completa de la rama `feat/carbeat-v2` y se actualizó con el audio en segundo plano.

---

## [v2.2.0] — 2026-10-22
### ⚡ Sonar Ya Dual, Portada Limpia y Blindaje Definitivo de Hardware Antiguo
1. **Acción Dual "Sonar Ya" en Buscador y Cola:**
   - En cada resultado de búsqueda tanto en la cabina del carro como en los teléfonos de los pasajeros se ofrecen botones duales independientes: `[▶ Sonar ya]` (reproducción instantánea) y `[+ Cola]` (encolado ordenado por votos).
   - Cada ítem en la lista de la cola (`QueueList`) incorpora un botón `[▶ Sonar ya]` para saltar directamente a la pista activa.
   - Nuevo ajuste en el host (`passengerPlayNow`) para encender o apagar la capacidad de los pasajeros de forzar reproducción inmediata.
2. **Entrada de Pasajero con Portada Limpia:**
   - Erradicación de la precarga residual de códigos de sala (`getLastRiderRoom()`).
   - El input de placa arranca 100% vacío con su placeholder visible (`VIBE-7KQ3`), permitiendo escritura directa o escaneo de QR sin tener que borrar caracteres anteriores.
3. **Blindaje Total de Radios Antiguas (Anti "Fallo en la cabina"):**
   - Inclusión de test de compilación de shaders en `isWebGLAvailable()`.
   - Detección de hardware automotriz modesto (`deviceMemory <= 2 GB`) en `graphics-detector.ts`.
   - Envoltorio de la autopista 3D con `<ThreeErrorBoundary>` en `HighwayStrip.tsx` para conmutar de inmediato a letreros planos 2D si la GPU pierde contexto.
   - Auto-recuperación persistente en `ErrorBoundary.tsx`: ante cualquier error gráfico, se activa el modo 2D en `localStorage` eliminando el bucle infinito de reinicios.
4. **Verificación Exhaustiva con Subagentes y Pruebas Web:**
   - 86/86 pruebas automatizadas en Vitest pasando al 100%.
   - Pruebas E2E en navegador real (Chrome DevTools MCP) validando la portada limpia, búsqueda dual y salto de cola en tiempo real.

---

## [v2.1.0] — 2026-10-20
### 🎛️ Car Audio Pro, Escáner USB Recursivo y Envío de MP3 P2P
1. **Ecualizador Car Audio Pro (Web Audio API):**
   - Cadena de filtros paramétricos Biquad (Bajos 80Hz, Medios 1kHz, Agudos 8kHz).
   - Presets automotrices: *Plano*, *Bajo Potente*, *Subwoofer Extremo*, *Voz Clara*, *Discoteca / Crossover*, *Rock*.
   - Modal táctil ergonómico para cabina vehicular (`EqualizerModal.tsx`).
2. **Escáner USB Recursivo:**
   - Implementación de `crawlDirectory` en `library.ts` para explorar hasta 12 niveles de subcarpetas en memorias USB.
   - Soporte universal de formatos `.mp3`, `.m4a`, `.wma`, `.flac`, `.wav`, `.aac`, `.ogg`, `.opus`.
3. **Generación Universal de IDs:**
   - Reemplazo de `crypto.randomUUID` por `generateLocalId()` de entropía mixta, solventando errores en WebViews antiguas de Android sin soporte HTTPS.
4. **Envío de MP3 Locales por Pasajeros:**
   - Botón `[📤 Enviar MP3 local]` para compartir canciones descargadas vía WebRTC DataChannel sin internet en el vehículo.
5. **Favoritos en 1 Toque para el Conductor:**
   - Botón de favorito agrandado con notificación visual en cabina (*"¡Guardada en Mi Música!"*).

---

## [v2.0.0] — 2026-10-18
### 🚗 Arquitectura CarBeat 2.0 (Salas con el Carro como Única Verdad)
1. **Rediseño Arquitectónico de Sala:**
   - El carro pasa a ser la única fuente de verdad autoritativa (`room-engine.ts`).
   - Sincronización telemática basada en fotos (`Snapshot`) y un `WireMessage` único para todos los transportes.
2. **Relay Serverless con Upstash Redis:**
   - Redundancia en la nube para conectar pasajeros y carros a través de firewalls o redes celulares distintas.
3. **Autopista 3D de la Cola (QueueHighway):**
   - Visualización interactiva en 3D con Three.js simulando una carretera nocturna con pórticos y letreros de las próximas canciones.
4. **APK Oficial de CarBeat:**
   - Empaquetado nativo con Capacitor para pantallas Android y tablets.

---

## [v1.5.0] — 2026-10-17
### 📂 Auto-Detección y Vigilancia Persistente de Carpeta de Música
1. **Servicio `FolderWatcherService`:**
   - Permite al chofer vincular su carpeta de música (Tablet o USB).
   - Utiliza la File System Access API para vigilar la carpeta en segundo plano cada 12 segundos.
   - Si el chofer descarga más canciones o inserta una USB, la app las detecta, guarda en `LocalAudioDatabase` y las añade al catálogo automáticamente sin intervención.
2. **Persistencia de Handle en IndexedDB:**
   - Al reiniciar o abrir la cabina, CarBeat restaura automáticamente la vigilancia de la carpeta previamente vinculada.
3. **Indicador Visual en Cabina:**
   - Botón interactivo en la barra superior: muestra el nombre de la carpeta activa con pulso verde esmeralda (`Auto: Música`).

---

## [v1.4.0] — 2026-10-17
### ⚡ Novedades y Reparación de Búsqueda Online
1. **Búsqueda en la Nube Reparada (Apartado DJ):**
   - Resuelto el fallo donde el buscador del DJ intentaba consultar rutas relativas inexistentes en el WebView móvil.
   - Integrado `apiUrl('/api/yt/search')` con fallback automático a la red distribuida de `OmniMusicGateway` (YouTube Music, Apple, Audius).
   - Búsqueda instantánea con debounce de 350ms, deduplicación de pistas y botón para limpiar texto en un toque (`X`).
2. **Envío Instantáneo de Canciones al Carro:**
   - Eliminados los retrasos de espera artificiales de animación (`setTimeout` de 2 segundos) en el modal de DJs.
   - El envío ahora es inmediato (<50ms) usando el canal P2P y HTTP Serverless en paralelo.
3. **Música Local del Celular a la Pantalla del Carro:**
   - Se añadió el selector **"Mi Celular (Offline)"** en el modal de nueva pista.
   - Permite al copiloto o pasajeros seleccionar cualquier archivo de audio (`.mp3`, `.m4a`, `.flac`) almacenado en su teléfono y enviarlo directamente a la cola de la cabina.

---

## [v1.3.0] — 2026-10-16
### 🛡️ Novedades, Blindaje y Optimizaciones
1. **Blindaje de Votación 1-Voto por DJ/Dispositivo:**
   - Se resolvió la anomalía donde un usuario podía enviar likes ilimitados y alterar la cola sin control.
   - Cada voto ahora registra el identificador del usuario (`votedBy[djKey]`).
   - Soporte para alternar el voto (toggle): si el usuario ya votó a favor y vuelve a presionar, el voto se anula limpiamente.
2. **Pre-Caché en Cola en Segundo Plano (Anti-Congelamiento):**
   - Servicio `queue-cacher.ts` implementado. Pre-calienta y almacena en búfer silenciosamente la pista siguiente (`queue[0]`) antes de que termine la pista actual.
   - Previene pausas o bloqueos de la aplicación en carretera al reproducir canciones solicitadas desde internet.
3. **Separación de Carpetas y Selector de Red:**
   - Filtros explícitos en el catálogo del DJ: **Todo**, **Carro Local** y **Tendencias**.
   - Selector inteligente de datos: permite al pasajero alternar entre consumir datos de la pantalla del carro o aportar streaming con la conexión de su propio celular.
4. **Diseño Responsivo Fluido:**
   - `NowPlayingScreen`: carátula adaptable fluidamente mediante dimensiones responsivas y contenedor que elimina el desbordamiento en pantallas de carro (1024x600) y tablets verticales.
   - `HostView`: grid con orden adaptable (`md:order-1`, `md:order-2`, `md:order-3`) para visualización ergonómica en cabina.
5. **Versionado Sincronizado:**
   - `src/core/version.ts`: `1.3.0`
   - `package.json`: `1.3.0`
   - `android/app/build.gradle`: `versionCode 4`, `versionName "1.3.0"`
   - `api/version.ts`: `1.3.0`
