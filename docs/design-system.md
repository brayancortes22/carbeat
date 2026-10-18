# Sistema de diseño de CarBeat v2 — «Cabina de noche»

La interfaz es el **tablero de un carro de noche**. No es una metáfora decorativa: cada pieza
existe en un carro real y significa lo mismo aquí.

| Pieza del carro | En CarBeat |
|---|---|
| Velocímetro | Tiempo de la canción (aguja de 0 a la duración) |
| Tacómetro | Volumen (se arrastra la aguja) |
| Pantalla central del cuadro (MFD) | Lo que suena: portada, título, quién la pidió |
| Testigos (verde/ámbar/rojo) | Estado real: conexión directa, nube, pasajeros, piloto automático |
| Control de crucero | Piloto automático |
| Computadora de viaje | Siguiente canción, tiempo en ruta, canciones sonadas |
| Placa | Código de la sala (`VIBE-7KQ3`) |
| Botón START/STOP | Encender la cabina = abrir la sala |
| Pantalla del radio | Títulos y números en matriz de puntos |
| Reóstato del tablero | Atenuación nocturna automática (18:30–6:00) |

## Color

Sin cambios respecto a la v2.0: el **cian de la v1** (`#22d3ee`) es la luz de instrumento.
Grafito casi negro de fondo. Ámbar, rojo y verde **sólo** en testigos y avisos, nunca como
decoración. La aguja es naranja (`#ff5a36`) como en los tableros reales.

Tokens en `src/index.css` (`@theme`): `asphalt`, `cabin`, `panel`, `bezel`, `rim`, `ink`, `dim`,
`faint`, `cyan`, `cyan-soft`, `cyan-deep`, `ice`, `amber`, `danger`, `go`.

`--glow` (1 de día, 0,62 de noche) escala todos los brillos. Lo pone `useNightDim()`.

## Tipografía

Elegida con una muestra renderizada (no a ojo). Todo empaquetado: el APK funciona sin internet.

| Uso | Familia | Clase |
|---|---|---|
| Titulares | **Anybody** variable, ancha (`font-stretch: 132%`, peso 860) | `.type-hero`, `KineticTitle` |
| Títulos de sección | Anybody 118 % / 800 | `.type-wide` |
| Rótulos, botones, pestañas | Anybody estrecha (78 % por defecto en `.font-display`) | `font-display`, `.label-cluster` |
| Números de interfaz | Anybody 82 %, cifras tabulares | `.readout`, `Odometer` |
| Pantallas tipo radio | **Doto** (matriz de puntos) | `.dotmatrix`, `DotMatrix` |
| Texto corrido | **Hanken Grotesk** | (por defecto) |

El eje de ancho de Anybody se anima: los titulares **entran estrechos y se abren** (`KineticTitle`),
como si se estiraran con la velocidad.

## Movimiento

- Curva base `[0.16, 1, 0.3, 1]`; muelles para agujas y dígitos.
- **Encendido** (`Ignition`): testigos encendidos a la vez + `CARBEAT` escrito en matriz de puntos
  + barrido de luz; las agujas barren solas con `ignition` en `Gauge`. ~1,7 s, se puede saltar.
- **Odómetro** (`Odometer`): los números ruedan, no saltan.
- **Radio** (`DotMatrix`): si el título no cabe, se desplaza de ida y vuelta con pausas.
- **Inclinación 3D** (`Tilt`): sólo con ratón; en táctil queda quieto.
- `prefers-reduced-motion` desactiva todo lo anterior.
- Nada de datos inventados en las pantallas funcionales (ni medidores de audio falsos). En la
  portada, la escena 3D es decorativa y se puede animar libremente.

## 3D

- React Three Fiber, **cargado bajo demanda**, DPR ≤ 1,5, geometría instanciada, se detiene fuera
  de pantalla y con ahorro de datos.
- Medir FPS con el método de Edge sin ventana (`cdp.mjs`): portada ≥ 120 FPS en la RTX 4060 y sin
  fotogramas de más de 34 ms en régimen estable.

## Componentes

`src/ui/`: `Gauge`, `Cluster`, `Telltale`, `Plate`, `StartButton`, `Wordmark`, `TripComputer`,
`Ignition`, `kit` (`Odometer`, `DotMatrix`, `KineticTitle`, `Tilt`, `useNightDim`), `controls`
(`Key`, `WheelButton`, `Rocker`, `Cover`, `Toasts`), `music` (`LedBar`, `TrackRow`, `QueueList`,
`SearchPanel`, `LibraryList`), `three/` (escenas).
