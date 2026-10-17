# CarBeat — Registro de Versiones y Changelog Oficial

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
