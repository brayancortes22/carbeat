# CarBeat — Registro de Versiones y Changelog Oficial

## [Sin publicar] — 2026-10-22

### Añadido
- **«Sonar ya» en el carro:** cada resultado del buscador (web y APK) tiene «+ Cola» y «Sonar ya»; en la cola, «Sonar ya» y «Quitar».
- **«Sonar ya» para pasajeros:** intención `play_now` (con `queueId` o `track`) y regla de la sala *Los pasajeros pueden «Sonar ya»*, **apagada por defecto**. Encendida, la canción suena de inmediato y queda «PIDIÓ PASAJERO».

### Cambiado
- La portada ya no rellena el campo de código con la última sala: arranca vacío con el ejemplo `VIBE-7KQ3`.
- Los botones «Sonar ya» se ajustan al ancho de la lista (container queries): sólo icono en columnas estrechas. A 1024×600 el título del buscador de la cabina pasa de 95 a 174 px; a 390 px, los textos cortados en el buscador del pasajero bajan de 20 a 4.
- Documentación reescrita para la v2 (README, arquitectura, protocolo, API del relé, despliegue y guía).

## [v2.0.0] — 2026-10-17

### Salas rehechas
- El carro es la **única fuente de verdad**; los pasajeros envían intenciones con id única (una petición ya no cuenta dos veces) y reciben fotos con revisión.
- Token del carro (sólo se guarda el hash) para crear, publicar y cerrar la sala.
- Relé HTTP sin estado propio sobre **Upstash Redis** (antes, un cubo público de kvdb.io). Coste medido en reposo con 1 carro y 3 pasajeros: 135 comandos/min sólo HTTP, 58/min con P2P.
- Enlaces P2P, WebSocket local, BroadcastChannel y HTTP con reintentos; estado de conexión real.
- La sala sobrevive a una recarga: cola, votos, historial, reglas, piloto y canción con su posición (6 h).
- Servidor de red local `npm run lan` (sustituye a `server/ws-server.mjs`, que no arrancaba).

### Interfaz
- Diseño «Cabina de noche»: portada con escena 3D, cuadro con agujas, testigos y placa; autopista 3D de la cola.
- APK con modo carro y modo pasajero propios, escáner QR con jsQR (APK debug 8,6 MB frente a 37,8 MB con el escáner oficial) y minSdk 26.
- YouTube suena dentro del APK: `iframe_api` tardaba 10,3 s en cargar y ahora se reintenta.
- Accesibilidad: contraste del gris tenue 3,04:1 → 4,71:1, objetivos táctiles de 44 px.
- Fuga de memoria al ir y volver portada 3D ↔ cabina: cada vuelta retenía el renderer de three (LUT DFG). En producción, 12 ciclos: **0,609 → 0,145 MB por ciclo** y los contextos WebGL vivos dejan de crecer (1→12 → fijo en 1).

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
