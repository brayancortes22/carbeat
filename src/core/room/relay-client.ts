// Cliente del relé HTTP (/api/room). Ver server/relay.ts.

import type { Envelope, LibraryIndex, Snapshot } from '../../../shared/protocol';
import { apiUrl } from '../network/api-config';

export class RelayError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(init: { method: 'GET'; query: Record<string, string> } | { method: 'POST'; body: unknown }, timeoutMs = 6000): Promise<T> {
  const url =
    init.method === 'GET' ? `${apiUrl('/api/room')}?${new URLSearchParams(init.query).toString()}` : apiUrl('/api/room');
  const res = await fetch(url, {
    method: init.method,
    headers: init.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: init.method === 'POST' ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* cuerpo vacío */
  }
  if (!res.ok) throw new RelayError(res.status, (data as { error?: string })?.error ?? `HTTP ${res.status}`);
  return data as T;
}

/** `age`: segundos desde la última foto del carro según el servidor (null si no se sabe). */
export type StateResult =
  | { exists: false; closed: boolean }
  | { exists: true; unchanged: true; rev: number; age: number | null }
  | { exists: true; snapshot: Snapshot | null; age: number | null };

export const relay = {
  claim: (room: string, token: string, name: string) => call<{ ok: true }>({ method: 'POST', body: { op: 'claim', room, token, name } }),
  sync: (room: string, token: string, snapshot?: Snapshot, library?: LibraryIndex) =>
    call<{ ok: true; intents: Envelope[] }>({ method: 'POST', body: { op: 'sync', room, token, snapshot, library } }),
  library: (room: string) => call<{ library: LibraryIndex | null }>({ method: 'GET', query: { op: 'library', room } }),
  close: (room: string, token: string) => call<{ ok: true }>({ method: 'POST', body: { op: 'close', room, token } }),
  push: (envelope: Envelope) => call<{ ok: true }>({ method: 'POST', body: { op: 'push', envelope } }),
  state: (room: string, rev?: number) =>
    call<StateResult>({ method: 'GET', query: rev ? { op: 'state', room, rev: String(rev) } : { op: 'state', room } }),
  nearby: () => call<{ rooms: { room: string; name: string }[] }>({ method: 'GET', query: { op: 'nearby' } }, 4000),
  /** Cierre al descargar la página: sendBeacon sobrevive a la navegación. */
  closeBeacon(room: string, token: string): void {
    const body = JSON.stringify({ op: 'close', room, token });
    if (navigator.sendBeacon?.(apiUrl('/api/room'), new Blob([body], { type: 'application/json' }))) return;
    fetch(apiUrl('/api/room'), { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  },
};
