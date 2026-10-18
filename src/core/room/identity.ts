// Identidad del dispositivo y token del carro.
// El voto se ata al dispositivo (clientId), no al nombre: en la v1 dos pasajeros con el mismo
// nombre compartían voto y uno podía votar varias veces cambiándose el nombre.

import { newId } from '../../../shared/protocol';

const KEYS = {
  client: 'carbeat.client.v2',
  name: 'carbeat.name.v2',
  hostToken: (room: string) => `carbeat.host-token.v2.${room}`,
  lastHostRoom: 'carbeat.host-room.v2',
  lastRiderRoom: 'carbeat.rider-room.v2',
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* modo privado: se vive sin persistencia */
  }
}

let memoClient: string | null = null;

export function getClientId(): string {
  if (memoClient) return memoClient;
  let id = read(KEYS.client);
  if (!id) {
    id = newId('c_');
    write(KEYS.client, id);
  }
  memoClient = id;
  return id;
}

export function getDisplayName(): string {
  return read(KEYS.name) ?? '';
}

export function setDisplayName(name: string): void {
  write(KEYS.name, name.trim().slice(0, 32) || null);
}

/** El token sobrevive a recargar la página: el carro recupera su sala sin perder la cola. */
export function getHostToken(room: string): string {
  let token = read(KEYS.hostToken(room));
  if (!token) {
    token = newId('t_') + newId();
    write(KEYS.hostToken(room), token);
  }
  return token;
}

export function forgetHostToken(room: string): void {
  write(KEYS.hostToken(room), null);
}

export function getLastHostRoom(): string | null {
  return read(KEYS.lastHostRoom);
}

export function setLastHostRoom(room: string | null): void {
  write(KEYS.lastHostRoom, room);
}

export function getLastRiderRoom(): string | null {
  return read(KEYS.lastRiderRoom);
}

export function setLastRiderRoom(room: string | null): void {
  write(KEYS.lastRiderRoom, room);
}
