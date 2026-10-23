# CarBeat — Despliegue

## 1. Desarrollo local

```bash
npm install
npm run dev
```

Vite escucha en `0.0.0.0:5173` con la API y el relé WebSocket (`/ws-room`) dentro, y un Redis en
memoria. Desde un celular de la misma Wi-Fi: `http://<IP-de-tu-PC>:5173`.

**Firewall de Windows:** para que entren los celulares, abre el puerto TCP **5173** (o **8080**
con `npm run lan`) en `wf.msc` → Reglas de entrada → Nueva regla → Puerto, sólo en redes
**privadas**.

## 2. Red local en el carro (sin internet)

```bash
npm run lan
```

Compila la web (`dist/`) y `server/lan-server.ts`, y arranca en el puerto **8080** (`PORT` lo
cambia; `CARBEAT_WEB_DIR` la carpeta servida). Sirve web, API y relé WebSocket. Sin internet
funciona todo salvo la búsqueda de YouTube.

## 3. Vercel + Upstash Redis (producción)

1. Crea una base **Upstash Redis** (el plan gratis da 500.000 comandos/mes; en reposo, 1 carro y
   3 pasajeros consumen 58 comandos/min con P2P y 135/min sólo por HTTP, medido).
2. En Vercel → Project → Settings → Environment Variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - opcional `CARBEAT_IP_SALT` (sal del hash de IP para «carros cercanos»)
3. Despliega. El workflow `deploy-vercel.yml` lo hace en cada push a `main`, `qa` y `development`
   (`vercel deploy --prebuilt`); a mano:

   ```bash
   npx vercel deploy --prebuilt --prod
   ```

4. Comprueba el almacén: `GET /api/room?op=health` debe responder `"store": "upstash"`. Con
   `"memory"` faltan las variables y las salas no se verán entre instancias.

`vercel.json` hace el fallback de SPA a `index.html` (salvo `/api/` y `/downloads/`) y fuerza la
descarga de los APK de `/downloads/`.

## 4. APK Android

```bash
npm run cap:sync          # build en modo app (dist-app/) + cap sync android
cd android
./gradlew assembleDebug   # android/app/build/outputs/apk/debug/app-debug.apk
```

Requisitos: JDK 21 y SDK de Android (minSdk 26, targetSdk 36). El APK usa la API de producción.
Para publicarlo en la portada, cópialo a `public/downloads/carbeat-latest.apk`. En CI,
`build-apk.yml` lo compila en cada push a `main` (artefacto `carbeat-android-apk`).

### Instalar

1. Descarga el APK desde la portada (**App Android**) o pásalo por USB.
2. Permite «instalar apps de fuentes desconocidas».
3. Abre CarBeat y elige **carro** o **pasajero**.

## Seguridad

| Riesgo | Mitigación |
|---|---|
| Alguien cierra o cambia la sala de otro | El token del carro (sólo se guarda su hash) es obligatorio para crear, publicar y cerrar. |
| Un pasajero manda datos falsos | Toda intención se valida en `shared/protocol.ts` y el carro la aplica con sus reglas. |
| Peticiones enormes | Límites: intención 8 KiB, foto 96 KiB, biblioteca 120 KiB. |
| Puerto abierto en la red local | Regla de firewall sólo para redes privadas. |
