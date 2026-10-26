# CarBeat — Guía de uso (v2.2.0)

## Conductor (pantalla del carro)

1. Abre CarBeat en la tablet o radio del carro (APK) o en un navegador, y pulsa **Encender el
   carro**.
2. Arriba verás la placa con el **código de sala** (p. ej. `VIBE-7KQ3`). **Invitar** muestra el QR.
3. Pestañas del tablero:
   - **Cola:** lo que viene. Cada canción tiene **Sonar ya** (▶) y **Quitar** (✕).
   - **Buscar:** YouTube Music. En cada resultado, **+ Cola** (respeta el turno y los votos) o
     **Sonar ya** (suena de inmediato).
   - **Música:** la música guardada en el carro, favoritas e historial. El escáner USB lee
     subcarpetas anidadas.
   - **Modos:** piloto automático, reglas de la sala, pantalla apagada y autopista 3D.
4. **Reglas de la sala** (pestaña Modos):
   - *Los pasajeros controlan la música* — pausar, saltar y volver desde el celular (encendido por
     defecto).
   - *Los pasajeros pueden «Sonar ya»* — **apagado por defecto**. Enciéndelo sólo si quieres que
     cualquiera pueda saltarse la cola.
   - *Canciones en espera por pasajero* — 4 por defecto.
5. **Ecualizador:** el botón **Audio** abre los controles de bajos (80 Hz), medios (1 kHz) y
   agudos (8 kHz), con presets para el carro.
6. **Favoritos:** el botón de corazón guarda la canción en la memoria del vehículo y confirma con
   *«¡Guardada en Mi Música!»*.
7. Si recargas la página o se reinicia la app, la sala vuelve con su cola y la canción en pausa en
   su segundo (hasta 6 h).
8. **Apagar** cierra la sala para todos.

### Música con la pantalla apagada

- **Botón luna** (barra superior o *Modos > Pantalla apagada*): deja la pantalla negra y la música
  sigue. Toca la pantalla o pulsa *Atrás* para volver a encenderla.
- **Botón físico de apagado:** la música local/HTML5 sigue gracias al servicio en primer plano.
  **YouTube puede pausarse** por su política de segundo plano; para YouTube usa el botón luna.
- La notificación y la pantalla de bloqueo muestran los controles de anterior, play-pausa y
  siguiente.

## Pasajeros (celular)

1. Escanea el QR del carro con la cámara, o entra a la web y escribe el código en **Subirme como
   pasajero** (el campo siempre empieza vacío). **Buscar carros en esta red** lista los carros
   cercanos.
2. Escribe tu nombre (opcional): el conductor lo verá junto a lo que pidas.
3. **Buscar:** busca y pulsa **Pedir**. Si no suena nada, suena al instante; si ya estaba en la
   cola, sumas tu voto.
4. **Cola:** vota 👍 o 👎. Una canción con muchos votos en contra sale de la cola.
5. Si el conductor lo permite, verás también:
   - los botones **anterior / pausa / siguiente**;
   - **Sonar ya** (▶) en cada resultado y en cada canción de la cola.
6. **Enviar MP3 local:** comparte un archivo de tu celular sin gastar internet; se añade a la cola
   o suena de inmediato si el carro lo permite.
7. El estado de conexión es real: «Buscando el carro…», «En vivo · red local», «En vivo · por
   internet»…

### iPhone / iPad

Funciona en Safari, sin instalar nada.

### Android

Web, o el APK que se descarga desde la portada (**App Android**). El APK trae escáner QR propio.

## Sin internet en el carro

Con un portátil en el carro y `npm run lan`, los celulares del mismo Wi-Fi o hotspot usan la sala
sin internet. La búsqueda de YouTube sí necesita internet; la música guardada en el carro no.
