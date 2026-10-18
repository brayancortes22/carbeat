/*
 * Textos de la portada. Sólo describen lo que la app hace de verdad: nada de cifras ni
 * promesas que no se puedan comprobar en el código.
 */

// «en manos» con espacio no separable: en el celular «EN» quedaba solo al final de la línea.
export const HEADLINE = ['La', 'música', 'del', 'carro,', 'en\u00a0manos', 'de', 'todos.'];
/** Índice de "en": desde ahí el titular va en cian. */
export const HEADLINE_ACCENT = 4;

export type Step = { n: string; title: string; body: string; gear: string; short: string };

export const STEPS: Step[] = [
  {
    n: '01',
    gear: '1',
    short: 'Enciende',
    title: 'Enciende el carro',
    body: 'La tablet, el portátil o el celular conectado a los parlantes abre la sala. Sale un código con forma de placa y un QR.',
  },
  {
    n: '02',
    gear: '2',
    short: 'Se suben',
    title: 'Los pasajeros se suben',
    body: 'Escanean el QR o dictan la placa. Entran desde el navegador: no hay que instalar nada.',
  },
  {
    n: '03',
    gear: '3',
    short: 'Votan',
    title: 'Piden y votan',
    body: 'Cada celular pide canciones y vota. Suena primero lo más votado; si la mitad la rechaza, sale de la cola.',
  },
];

export const SPECS: [string, string][] = [
  ['Conexión', 'Directa entre celulares (WebRTC). Si la red la bloquea, entra el respaldo por internet.'],
  ['Votos', 'Uno por celular, no por nombre. Pedir dos veces la misma canción no suma dos votos.'],
  ['Música del carro', 'Archivos de la USB o de la tablet: suenan sin datos y los pasajeros también los ven.'],
  ['Piloto automático', 'Si nadie pide nada, elige la siguiente: afín al artista, sólo del carro o mezcla de géneros.'],
  ['El que manda', 'Sólo la pantalla del carro puede cerrar la sala o cambiar las reglas: tiene una llave secreta.'],
];
