# Directorio de Descargas de APK

Aquí se almacena el binario `carbeat-latest.apk` para descarga directa desde la pantalla del carro o celulares Android.

## Compilar la versión de producción

Requisitos: Node.js 22 y JDK 21.

```bash
npm run cap:sync
cd android
./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

Cópialo a este directorio con el nombre `carbeat-latest.apk` (y, si quieres conservar la versión, `carbeat-v2.2.0.apk`). La portada usa siempre `carbeat-latest.apk`, así que basta con reemplazarlo para que el botón **App Android** entregue la versión nueva.
