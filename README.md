# 🚗 CarBeat: Collaborative In-Car Jukebox & DJ System (v2.1.0)

Sistema colaborativo de música en tiempo real para vehículos y viajes por carretera. Convierte la pantalla del carro (Tablet, Android Auto, Navegador) en un reproductor central (Host) y permite que los pasajeros se unan como DJs desde sus teléfonos móviles sin descargas obligatorias para proponer, votar canciones y controlar la música de la cabina en vivo.

---

## 🌟 Novedades de la Versión 2.1.0 (Blindaje Automotriz & Car Audio Pro)

### 1. 🛡️ Blindaje Total WebGL y Modo 2D Ligero Universal
- **Detección Activa de GPU (`graphics-detector.ts`):** Prueba rápida y segura de contexto WebGL con liberación inmediata (`WEBGL_lose_context`). Si la pantalla de la radio china o tablet carece de aceleración 3D, conmuta de forma transparente al cielo estrellado 2D vectorial sin colgar la máquina.
- **`ThreeErrorBoundary` Especializado:** Protege las escenas de Three.js / React Three Fiber contra fallos de `Error creating WebGL context` o pérdidas de contexto por suspensión de pantalla.
- **Recuperación en 1 Clic:** La pantalla de diagnóstico ofrece `[🚗 Entrar en Modo 2D Ligero]` guardando la preferencia permanente en `localStorage` para evitar bucles de recarga infinita.

### 2. 📁 Escáner USB Recursivo Profundo (Soporte Multinivel)
- **Rastreo Recursivo:** Explora automáticamente todas las carpetas y subcarpetas anidadas en memorias USB (hasta 12 niveles de profundidad) sin requerir que el conductor mueva sus archivos a la raíz.
- **Compatibilidad Extensa:** Soporta formatos `.mp3`, `.m4a`, `.wma`, `.flac`, `.wav`, `.aac`, `.ogg`, `.opus` con detección insensitive a mayúsculas/minúsculas.
- **Erradicación del Bug `crypto.randomUUID`:** Reemplazado por `generateLocalId()` de entropía mixta, eliminando fallos en WebViews antiguas de Android o conexiones locales HTTP.

### 3. 🎚️ Ecualizador Car Audio Pro (3 Bandas + Presets)
- **Filtros Web Audio API Biquad:**
  - **Bajos (Subwoofer):** Filtro LowShelf calibrado en 80 Hz (-12 dB a +12 dB).
  - **Medios (Voces):** Filtro Peaking calibrado en 1 kHz (Q: 1.0).
  - **Agudos (Brillo):** Filtro HighShelf calibrado en 8 kHz.
- **Presets Automotrices Listos para Usar:** *Plano*, *Bass Boost*, *Subwoofer Extremo*, *Voz Clara*, *Crossover*, *Rock*.
- **Persistencia y Ergonomía:** Guarda los ajustes del usuario y provee un modal táctil optimizado para operar con guantes o en movimiento.

### 4. ⚡ Modo "Sonar Ya" (Reproducción Directa para Pasajeros)
- Los pasajeros disponen de un selector intuitivo al pedir canciones: `[▶ Sonar de una vez / ➕ A la cola]`.
- Al marcar "Sonar Ya", la canción viaja con el flag `playNow: true` en el protocolo v2, saltando la cola y comenzando a reproducirse inmediatamente en los parlantes del carro.

### 5. 📤 Envío Directo de MP3 Locales (P2P Offline)
- Los pasajeros con canciones descargadas en la memoria de sus teléfonos pueden compartirlas al carro mediante el botón `[📤 Enviar MP3 local]`.
- El archivo se procesa en el navegador como flujo Base64 y se añade a la reproducción de cabina sin necesidad de conexión a internet.

### 6. ⭐ Guardado Inmediato en Mi Música con Feedback Visual
- Botón táctil ergonómico de favoritos integrado en el panel principal del conductor.
- Muestra una notificación visual en tiempo real (*"⭐ «Título» agregada a Mi Música"*) confirmando la persistencia en la biblioteca personal.

---

## 🛠️ Arquitectura Técnica de CarBeat

```
[ Car Screen / Tablet / Host ]
   ├── EqualizerService (Web Audio API: 80Hz LowShelf, 1kHz Peaking, 8kHz HighShelf)
   ├── AudioEngine (Híbrido Universal: YouTube Player + Local Audio DB)
   ├── GraphicsDetector (Detección WebGL + Conmutador Seguro a Modo 2D)
   ├── RoomEngine & Protocol v2 (Host Autorizado + Estado Monolítico Sincronizado)
   ├── Upstash Redis Relay & WebSocket Local LAN
   ├── Recursive Library Crawler (USB & Storage Deep Scan)
   └── DriverLibrary & PlaybackHistory (Almacenamiento persistente IndexedDB & LocalStorage)
         ▲
         │ Sincronización telemática (<20ms local / <150ms cloud)
         ▼
[ Mobile Passengers / DJs ]
   ├── RiderSession (Protocol v2: request con playNow, vote, sync)
   ├── P2P Audio Uploader (Conversión y streaming de archivos locales)
   └── Responsive Glassmorphism UI (Diseño optimizado para cualquier smartphone)
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

### Ejecutar en Desarrollo (Vite)
```bash
npm run dev
```

### Compilación Web y Verificación de Tests
```bash
npm test
npm run build
```

### Compilar APK Android
```bash
npm run build:app
npx cap sync android
cd android
./gradlew assembleDebug
```

---

## 🚀 Pipeline CI/CD Autónomo & Bypass de Vercel Hobby (Regla 17)

CarBeat implementa una arquitectura de integración y despliegue continuo autónomo en GitHub Actions para colaborar sin fricciones ni sobrecostes de proveedor:

1. **Auto-Aprobación y Fusión de PRs (`auto-approve-merge.yml`):**
   - Cuando colaboradores autorizados (`vars.AUTO_MERGE_SOURCE_USER`) o PRs con la etiqueta `automerge` envían cambios, el sistema ejecuta validaciones de compilación (`npm run build`).
   - Si las pruebas pasan, el PR es auto-aprobado a nombre de Brayan usando un Personal Access Token (`PR_AUTOMATION_TOKEN`) y se fusiona automáticamente.
2. **Despliegue Directo vía Vercel CLI (`deploy-vercel.yml`):**
   - Al integrarse en `main`, GitHub Actions compila los artefactos y realiza el despliegue a producción mediante `vercel deploy --prebuilt --prod` usando las credenciales del titular (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`).
   - Esto evita los bloqueos de cuentas Hobby de Vercel cuando los commits provienen de múltiples colaboradores.

---

Desarrollado con pasión por **Brayan Stid Cortés Lombana (`bscl`)**.
