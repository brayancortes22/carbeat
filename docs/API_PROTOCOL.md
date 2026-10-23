# CarBeat — API HTTP del relé (`/api/room`)

Código: [`server/relay.ts`](../server/relay.ts). El relé **no decide nada** sobre la música: guarda
la última foto del carro y una bandeja de intenciones de los pasajeros. Es el respaldo cuando el
P2P no conecta (redes móviles con NAT estricto, WebViews sin WebRTC). Formato de los mensajes:
[protocol.md](protocol.md).

Almacén: Upstash Redis REST si hay `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
(o `KV_REST_API_URL` / `KV_REST_API_TOKEN`); si no, memoria (sólo una instancia: desarrollo y LAN).

## Seguridad

Crear, publicar, leer la bandeja y cerrar exigen el **token del carro**; sólo se guarda su hash.
Un pasajero sólo puede dejar intenciones, que el carro valida otra vez con el motor de la sala.

## GET `/api/room?op=…`

| `op` | Parámetros | Respuesta |
|---|---|---|
| `state` (por defecto) | `room`, `rev?` | `{ exists, snapshot, age }`; `{ exists: true, unchanged: true, rev, age }` si `rev` coincide; `{ exists: false, closed }` si no hay sala. |
| `library` | `room` | `{ library }` (índice de la música del carro o `null`). |
| `nearby` | — | `{ rooms: [{ room, name }] }`: carros con actividad desde la misma IP pública en los últimos 90 s (hasta 10) («Buscar carros en esta red»). |
| `health` | — | `{ ok: true, store: 'upstash' \| 'memory' }`. |

## POST `/api/room` (JSON)

| `op` | Cuerpo | Respuesta |
|---|---|---|
| `claim` | `room`, `token`, `name?` | Crea la sala o la renueva con el mismo token. `409` si el código ya es de otro carro. |
| `sync` | `room`, `token`, `snapshot?`, `library?` | Publica foto y/o biblioteca y devuelve `{ ok, intents }` (hasta 50 de la bandeja). |
| `push` | `envelope` | Deja una intención en la bandeja (máx. 100). `202`; `404` sin carro; `410` sala cerrada. |
| `close` | `room`, `token` | Cierra la sala. |

## Errores

`400` código o mensaje inválido · `401` falta el token · `403` token incorrecto · `404` sala
inexistente o caducada · `405` método · `409` código en uso · `410` cerrada · `413` demasiado grande
(envelope 8 KiB, foto 96 KiB, biblioteca 120 KiB) · `502` almacén no disponible.

## Caducidad

Si el carro deja de publicar **2 min**, la sala desaparece sola. Una sala cerrada se recuerda
10 min (para avisar «el conductor cerró la sala»); la lista de cercanos, 5 min.

## Ritmo del carro por HTTP

Sincroniza cada 5 s; durante 1 min después de recibir una intención por HTTP baja a 1,5 s (hay un
pasajero que depende de ese camino). Si la foto no cambia, sólo la renueva cada 40 s. Coste medido en reposo (60 s, 1 carro + 3 pasajeros): sólo HTTP
**135 comandos de Redis/min**; con P2P activo **58/min**. El plan gratis de Upstash da 500.000
comandos al mes.

## Otras rutas

`/api/yt/search?q=` y `/api/yt/related` (búsqueda y afines de YouTube Music) · `/api/version`.
