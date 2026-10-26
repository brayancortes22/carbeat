# CarBeat — Documentación del proyecto

Rocola colaborativa para el carro: la pantalla del carro pone la música y los pasajeros piden y
votan desde su celular, sin instalar nada. Versión **2.2.0**. Resumen general en el
[README del repositorio](../README.md).

| Documento | Contenido |
|---|---|
| [architecture.md](architecture.md) | Piezas del sistema, audio en segundo plano y cómo encajan. |
| [protocol.md](protocol.md) | Protocolo de sala v2: intenciones, fotos y reglas. |
| [API_PROTOCOL.md](API_PROTOCOL.md) | API HTTP del relé `/api/room`. |
| [DEPLOY.md](DEPLOY.md) | Desarrollo, red local, Vercel + Upstash y APK. |
| [user-guide.md](user-guide.md) | Guía para el conductor y los pasajeros. |
| [design-system.md](design-system.md) | Sistema de diseño «Cabina de noche». |
| [CHANGELOG.md](CHANGELOG.md) | Historial de versiones. |

La versión la define `shared/version.ts` y se ve en la portada y en la bienvenida del APK.

> **Pantalla apagada:** en el APK, el botón luna de la cabina deja el panel en negro y mantiene la
> música sonando. Para YouTube usa siempre ese botón: el apagado físico puede pausar el video.
