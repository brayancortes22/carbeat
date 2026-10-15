# CarBeat: Documentación Técnica de Arquitectura

## 1. Resumen Ejecutivo
CarBeat es un sistema de reproducción y control musical colaborativo diseñado para entornos de cabina vehicular y eventos sociales. Permite que múltiples usuarios (DJs) interactúen con una pantalla principal (Host/Reproductor) sin depender de conexión a internet constante ni de suscripciones de streaming restrictivas.

## 2. Componentes del Sistema

### 2.1 Host (Pantalla del Carro / Parlante Principal)
- **Responsabilidad:** Reproducción continua de audio, custodia de la biblioteca local, almacenamiento de música enviada por pasajeros (`/Music/DJ_Queue`), y difusión del estado de reproducción.
- **Plataformas Soportadas:** Android Auto / Pantallas Android chinas (APK nativa vía Capacitor), Tablets, Smart TVs y Navegadores en laptops.

### 2.2 Client / DJ (Celulares y Dispositivos de Pasajeros)
- **Responsabilidad:** Explorar el catálogo disponible, encolar pistas, votar por canciones y enviar pistas nuevas adquiridas con su plan de datos.
- **Plataformas Soportadas:** 
  - Android (APK nativa o PWA).
  - iOS / iPadOS (PWA instantánea vía Safari sin necesidad de sideloading ni App Store).
  - Web Desktop / Mobile.

## 3. Matriz de Transporte Híbrido

```
                 +---------------------------+
                 |    ConnectionManager      |
                 +---------------------------+
                               |
         +---------------------+---------------------+
         |                                           |
         v                                           v
+-------------------+                       +-------------------+
|   LAN Transport   |                       |  Cloud Transport  |
|  (WebSocket local |                       | (Relay WebSocket  |
|   192.168.x.x)    |                       |   Server Vercel)  |
+-------------------+                       +-------------------+
```

- **LAN Directo:** Se activa cuando Host y Client comparten el mismo segmento de red (Hotspot del carro o Wi-Fi doméstico).
- **Cloud Relay:** Se activa cuando los dispositivos están en redes distintas (ej. pasajero con datos móviles 4G/5G y Host en Wi-Fi o viceversa).
