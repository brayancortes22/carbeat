import { describe, expect, it } from 'vitest';
import { parseEnvelope, parseWire, sanitizeTrack } from './protocol.ts';
import { generateRoomCode, isRoomCode, normalizeRoomCode } from './room-code.ts';

describe('códigos de sala', () => {
  it('genera códigos válidos y distintos', () => {
    const codes = new Set(Array.from({ length: 500 }, generateRoomCode));
    for (const c of codes) expect(isRoomCode(c)).toBe(true);
    expect(codes.size).toBeGreaterThan(495);
  });

  it('acepta lo que escribe un pasajero', () => {
    expect(normalizeRoomCode('vibe 7kq3')).toBe('VIBE-7KQ3');
    expect(normalizeRoomCode('VIBE7KQ3')).toBe('VIBE-7KQ3');
    expect(normalizeRoomCode('vibe-7kq')).toBeNull();
    expect(normalizeRoomCode('BEAT-123')).toBeNull(); // formato viejo
    expect(normalizeRoomCode('VIBE-0OQ1')).toBeNull(); // símbolos ambiguos
  });
});

describe('validación de lo que llega por la red', () => {
  const ok = { id: 'yt_a', title: 'Provenza', artist: 'KAROL G', duration: 210, source: 'stream', audioUrl: '', videoId: 'ca48oMV5GwU' };

  it('acepta una pista de YouTube y recorta campos', () => {
    const t = sanitizeTrack({ ...ok, title: 'x'.repeat(500) });
    expect(t?.title).toHaveLength(160);
    expect(t?.videoId).toBe('ca48oMV5GwU');
  });

  it('rechaza URLs peligrosas o inútiles en otro dispositivo', () => {
    expect(sanitizeTrack({ ...ok, videoId: undefined, audioUrl: 'javascript:alert(1)' })).toBeNull();
    expect(sanitizeTrack({ ...ok, videoId: undefined, audioUrl: 'blob:http://x/1' })).toBeNull();
    expect(sanitizeTrack({ ...ok, coverUrl: 'javascript:alert(1)' })?.coverUrl).toBeUndefined();
  });

  it('rechaza sobres sin sala válida o con intención desconocida', () => {
    const base = { id: 'e1', room: 'VIBE-7KQ3', from: 'c1', name: 'Ana', at: 1 };
    expect(parseEnvelope({ ...base, intent: { kind: 'hello', name: 'Ana' } })).not.toBeNull();
    expect(parseEnvelope({ ...base, room: 'BEAT-123', intent: { kind: 'hello', name: 'Ana' } })).toBeNull();
    expect(parseEnvelope({ ...base, intent: { kind: 'borrar_todo' } })).toBeNull();
    expect(parseEnvelope({ ...base, intent: { kind: 'vote', queueId: 'q', value: 5 } })).toBeNull();
  });

  it('parseWire descarta basura', () => {
    expect(parseWire('hola')).toBeNull();
    expect(parseWire({ t: 'snapshot', s: { v: 1 } })).toBeNull();
  });
});
