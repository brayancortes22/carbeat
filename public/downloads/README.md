# Directorio de Descargas de APK

Aquí se almacena el binario `carbeat-latest.apk` para descarga directa desde la pantalla del carro o celulares Android.

Para compilar la versión de producción:
```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
```
El archivo resultante se copia a este directorio.
