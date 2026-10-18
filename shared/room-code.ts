// Códigos de sala: legibles en voz alta dentro de un carro y difíciles de adivinar.
// Antes eran PREFIJO-NNN: 5 x 900 = 4.500 combinaciones, recorribles en segundos.
// Ahora PREFIJO-XXXX con 29 símbolos sin ambigüedad (sin 0/O, 1/I/L, U/V): 5 x 29^4 = 3.536.405.
// Además las acciones del carro exigen un token secreto, así que adivinar un código sólo
// permite pedir canciones, no controlar la sala.

const PREFIXES = ['BEAT', 'RIDE', 'VIBE', 'AUTO', 'RUTA'] as const;
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTWXYZ';
const SUFFIX_LENGTH = 4;

export const ROOM_CODE_PATTERN = new RegExp(`^(${PREFIXES.join('|')})-[${ALPHABET}]{${SUFFIX_LENGTH}}$`);

function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % max;
}

export function generateRoomCode(): string {
  const prefix = PREFIXES[randomIndex(PREFIXES.length)];
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) suffix += ALPHABET[randomIndex(ALPHABET.length)];
  return `${prefix}-${suffix}`;
}

/** Acepta lo que escribe un pasajero ("vibe 7kq3", "VIBE7KQ3") y lo deja canónico, o null. */
export function normalizeRoomCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = PREFIXES.find((p) => raw.startsWith(p));
  if (!match) return null;
  const code = `${match}-${raw.slice(match.length)}`;
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

export function isRoomCode(value: unknown): value is string {
  return typeof value === 'string' && ROOM_CODE_PATTERN.test(value);
}

export const ROOM_CODE_SPACE = PREFIXES.length * ALPHABET.length ** SUFFIX_LENGTH;
