# CarBeat — Guía de Despliegue

[[README]]

---

## 🖥️ Opción 1: Desarrollo Local (Vite)

```powershell
cd "C:\Users\NITRO ACER\Desktop\proyectos con ia\carbeat"
npm run dev
```

El servidor Vite escucha en `0.0.0.0:5173` y acepta conexiones de cualquier dispositivo en la misma red Wi-Fi.

### Abrir desde el celular
1. Averigua la IP de tu PC (aparece en la terminal de Vite, ej: `192.168.100.3:5173`)
2. En el navegador del celular: `http://192.168.100.3:5173`

### 🔧 Firewall de Windows (OBLIGATORIO para conexiones remotas)

Windows bloquea conexiones entrantes por defecto. Debes abrir el puerto 5173:

1. Abre **Firewall de Windows Defender con seguridad avanzada** (`wf.msc`)
2. **Reglas de entrada** → **Nueva regla**
3. Selecciona **Puerto** → **TCP** → puerto específico `5173`
4. **Permitir la conexión**
5. Aplica a **Privado** y **Público** (al menos Privado)
6. Nombre: `CarBeat WebSocket 5173`

Si usas el servidor independiente (`npm run ws`), también abre el puerto **4001**.

---

## 📦 Opción 2: Servidor WebSocket Independiente (Producción)

Para despliegue en un servidor dedicado o para mayor estabilidad:

```powershell
# Iniciar solo el servidor WebSocket
npm run ws

# O iniciar ambos (Vite + WebSocket)
npm run dev:all
```

El servidor en `server/ws-server.mjs` escucha en `0.0.0.0:5173` y maneja:
- `/ws-rooms` — Comunicación de salas de música
- `/ws-discovery` — Descubrimiento de hosts cercanos

---

## 📱 Opción 3: APK para Android (Pantalla del Carro y Celulares)

```powershell
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
```

Copia el APK generado a `carbeat/public/downloads/carbeat-latest.apk`.

### Instalación en pantalla Android del carro
1. Descarga el APK desde la web de CarBeat o transfiere por USB
2. En la pantalla del carro, habilita "Instalar apps de fuentes desconocidas"
3. Instala el APK
4. Abre CarBeat y selecciona "Modo Reproductor"

### Instalación en celulares Android
Mismo proceso, selecciona "Modo Pasajero / DJ"

---

## ☁️ Opción 4: Despliegue en Vercel (Web Portal + PWA)

```powershell
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel
```

Configura `vercel.json` para:
- Routing SPA (fallback a `index.html`)
- Headers de descarga directa de APK
- Variables de entorno para el servidor de relay (Cloud Relay)

---

## 🔐 Seguridad de Red

| Riesgo | Mitigación |
|--------|------------|
| Puerto 5173 expuesto en red local | Firewall de Windows restringido a red privada |
| WebSocket sin autenticación | Códigos de sala (ej: `BEAT-784`) como control de acceso |
| Conexiones desde redes externas | Cloud Relay opcional con código de sala de 6 caracteres |
| Archivos de audio maliciosos | Validación de extensión y tamaño en `local-scanner.ts` |

---

## 📊 Monitoreo

Revisa la consola del navegador (F12) para ver logs del WebSocket:
- `[Vite WS] Cliente conectado a sala: BEAT-784`
- `[Vite WS] Mensaje en sala BEAT-784: QUEUE_TRACK de Sebas`
- `[RoomChannel] WS conectado a la sala: BEAT-784`

---

> 💡 **Tip:** Si usas Obsidian, esta nota se conecta automáticamente a `[[README]]` y a `[[00_Centro_de_Mando]]`.