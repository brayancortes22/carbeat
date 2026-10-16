# CarBeat — Documentación del Proyecto (Obsidian)

[[00_Centro_de_Mando]] | [[Perfil y Reglas de Trabajo (Brayan - bscl)]]

---

## 📖 Resumen

**CarBeat** es un sistema de reproducción y control musical colaborativo para cabinas vehiculares y eventos sociales. Permite que múltiples pasajeros (DJs) conecten sus celulares a una pantalla principal (Host/Reproductor) sin depender de internet constante ni de suscripciones de streaming restrictivas como Spotify.

**Problema que resuelve:** Tu tío Sebas quiere controlar la música del carro desde su celular, ver qué suena en tiempo real, y elegir canciones desde su biblioteca local o descargar nuevas con sus datos móviles — todo sin bloquear tu cuenta de Spotify personal.

---

## 🏗️ Arquitectura y Novedades v1.1.0

### 🎵 OmniRoute Multi-Proveedor de Música (Inspirado en REA)
CarBeat integra un Gateway en cascada que aprovecha los contratos de ingeniería inversa de las plataformas líderes:
1. **YouTube Music:** Búsqueda y streaming directo de audio sin necesidad de autenticación Google.
2. **Apple Music / Spotify:** Streaming AAC a 256kbps con cero restricciones CORS y carátulas de alta resolución (600x600).
3. **Caché Local / USB:** Música sin conexión persistida en `localStorage` e indexación de archivos locales.

### ⚡ Sincronización Atómica Host ↔ DJ
- Eliminación de condiciones de carrera mediante sincronización atómica de referencias en `HostView`.
- Cada canción añadida por un DJ actualiza inmediatamente la cola del Host y es retransmitida a todos los copilotos conectados.
- Si el reproductor del carro está en silencio, la primera canción solicitada arranca de inmediato.

### 📱 Detección Automática de IP LAN para Códigos QR
- El servidor Vite expone `/api/server-info` con las interfaces de red del computador/carro.
- Al abrir el Host en `localhost`, el código QR detecta automáticamente la IP real (ej. `192.168.100.3:5173`), permitiendo que cualquier iPhone o Android entre a la sala al instante con la cámara.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Frontend | React 19 + TypeScript + Vite 8 | Interfaz de usuario (Host + DJ) |
| Estilos | Tailwind CSS v4 | Diseño oscuro automotriz (Refero AAA) |
| Comunicación | WebSocket (`ws`) + BroadcastChannel | Salas de música + descubrimiento de hosts |
| Audio | HTML5 Audio API + OmniRoute | Reproducción local en el Host |
| Iconos | Lucide React | Iconografía ligera |
| PWA / Mobile | Capacitor 8 | Empaquetado APK nativa para Android |

---

## 🏷️ Indicador de Versión

La versión de CarBeat se muestra en pantalla en todos los modos (Host, DJ y Landing):
- **Versión Actual:** `1.1.0`
- **Fuente única de verdad:** `src/core/version.ts`

---

## 📱 Modos de la App

| Modo | Dispositivo | Responsabilidad |
|------|-------------|-----------------|
| **Host / Reproductor** | Pantalla del carro (Android) | Reproduce audio, anuncia presencia en red, muestra QR de sala y cola en vivo |
| **DJ / Pasajero** | Celular (Android, iPhone, iPad, Web) | Explora catálogo, encola canciones, vota, busca música online en YouTube/Apple |

---

## 🧪 Cómo Probar

1. En la PC o Pantalla del Carro (Host):
```powershell
cd "C:\Users\NITRO ACER\Desktop\proyectos con ia\carbeat"
npm run dev
```

2. Abre `http://localhost:5173` → "Iniciar como Reproductor".
3. En el celular (DJ):
   - Escanea el código QR que muestra la IP local de red.
   - Pide una canción o busca en YouTube Music / Apple.
   - Observa la animación interactiva ("Conectando stream" ➔ "Descargando audio" ➔ "Transmitiendo al carro" ➔ "¡En la cola!").
   - La música sonará por los parlantes del carro y verás la barra de progreso en tu celular.