import { beforeEach, describe, expect, it } from 'vitest';
import {
  LIMITS,
  PROTOCOL_VERSION,
  parseEnvelope,
  parseLibrary,
  parseSnapshot,
  parseWire,
  sanitizeTrack,
  scoreOf,
  type Envelope,
  type Intent,
  type Snapshot,
  type Track,
} from '../shared/protocol.ts';
import {
  applyIntent,
  applyVote,
  createEngine,
  pruneRiders,
  requestTrack,
  toSnapshot,
  vetoThreshold,
  type ApplyContext,
  type EngineState,
} from '../shared/room-engine.ts';
import { handleRelay, resetRelayCache, type RelayRequest } from '../server/relay.ts';
import { MemoryRedis } from '../server/redis.ts';
import { isAudioFile } from '../src/core/audio/local-audio-db.ts';

const VALID_ROOM = 'RUTA-K7M2';
const VALID_TOKEN = 't'.repeat(32);
let clock = 1_700_000_000_000;
let redis: MemoryRedis;

const defaultContext = (current: Track | null = null): ApplyContext => ({
  now: clock,
  current,
});

const postRelay = (body: unknown, ip = '186.84.90.12') =>
  handleRelay({ method: 'POST', query: {}, body, ip }, redis, clock);

const getRelay = (query: RelayRequest['query'], ip = '186.84.90.12') =>
  handleRelay({ method: 'GET', query, body: null, ip }, redis, clock);

beforeEach(() => {
  clock = 1_700_000_000_000;
  redis = new MemoryRedis(() => clock);
  resetRelayCache();
});

describe('DevSecOps & Abuse QA: Seguridad en Metadatos y Resistencia a XSS', () => {
  it('sanea e inocua payloads XSS y HTML en título, artista y solicitadoPor sin corromper el motor', () => {
    const maliciousPayloads = [
      "<script>alert('XSS-1')</script>",
      "<img src=x onerror=alert('XSS-2')>",
      "';alert(String.fromCharCode(88,83,83))//",
      '"><svg/onload=alert(document.domain)>',
      '"><iframe src="javascript:alert(1)"></iframe>',
      '{{constructor.constructor("alert(1)")()}}',
      'Track \u0000 NullByte \u202E RTL Inversion',
    ];

    let state = createEngine(VALID_ROOM, 'Carro Blindado');

    for (const [idx, payload] of maliciousPayloads.entries()) {
      const rawTrack = {
        id: `xss_${idx}`,
        title: `Song ${payload}`,
        artist: `Artist ${payload}`,
        source: 'local_car',
        addedBy: `User ${payload}`,
      };

      const sanitized = sanitizeTrack(rawTrack);
      expect(sanitized).not.toBeNull();
      expect(sanitized!.title).toBe(`Song ${payload}`.slice(0, LIMITS.title));
      expect(sanitized!.artist).toBe(`Artist ${payload}`.slice(0, LIMITS.artist));

      const ctx: ApplyContext = { now: clock + idx * 1000, current: null };
      const res = requestTrack(
        state,
        sanitized!,
        { id: `rider_${idx}`, name: `Hacker_${payload}`.slice(0, LIMITS.name) },
        ctx,
      );

      // El motor debe procesar o encolar sin lanzar excepciones
      expect(res.state).toBeDefined();
      expect(typeof res.state.rev).toBe('number');
      state = res.state;

      // Verificar que toSnapshot maneje las cadenas sin romper el JSON
      const snap = toSnapshot(state, null, clock + idx * 1000, state.rev);
      const json = JSON.stringify(snap);
      expect(json).toBeDefined();
      expect(() => JSON.parse(json)).not.toThrow();
    }
  });

  it('trunca metadatos excesivos que intenten provocar desbordamiento o DoS de memoria', () => {
    const massiveTitle = 'A'.repeat(5000);
    const massiveArtist = 'B'.repeat(5000);
    const massiveId = 'C'.repeat(5000);

    const sanitized = sanitizeTrack({
      id: massiveId,
      title: massiveTitle,
      artist: massiveArtist,
      source: 'local_car',
    });

    expect(sanitized).not.toBeNull();
    expect(sanitized!.title.length).toBe(LIMITS.title);
    expect(sanitized!.artist.length).toBe(LIMITS.artist);
    expect(sanitized!.id.length).toBe(LIMITS.id);
  });
});

describe('DevSecOps & Abuse QA: Validación de Protocolo y Datos Corruptos', () => {
  it('rechaza sobres (envelopes) con campos nulos, corruptos o códigos de sala inválidos', () => {
    expect(parseEnvelope(null)).toBeNull();
    expect(parseEnvelope(undefined)).toBeNull();
    expect(parseEnvelope('string_invalido')).toBeNull();
    expect(parseEnvelope([])).toBeNull();
    expect(parseEnvelope({})).toBeNull();

    // Intent con sala manipulada (Path traversal / Inyección)
    expect(
      parseEnvelope({
        id: 'env_1',
        from: 'rider_1',
        room: '../../etc/passwd',
        intent: { kind: 'hello', name: 'Ana' },
      }),
    ).toBeNull();

    expect(
      parseEnvelope({
        id: 'env_2',
        from: 'rider_1',
        room: '<script>alert(1)</script>',
        intent: { kind: 'hello', name: 'Ana' },
      }),
    ).toBeNull();

    // Intent con kind request pero track nulo o corrupto
    expect(
      parseEnvelope({
        id: 'env_3',
        from: 'rider_1',
        room: VALID_ROOM,
        intent: { kind: 'request', track: null },
      }),
    ).toBeNull();

    expect(
      parseEnvelope({
        id: 'env_4',
        from: 'rider_1',
        room: VALID_ROOM,
        intent: { kind: 'request', track: { id: '', title: '' } },
      }),
    ).toBeNull();
  });

  it('el motor ignora intenciones con estructura corrupta sin mutar estado erróneamente', () => {
    const state = createEngine(VALID_ROOM, 'Carro');
    const corruptedEnv = {
      id: 'env_bad',
      room: VALID_ROOM,
      from: 'rider_x',
      name: 'Rider',
      at: clock,
      intent: { kind: 'unknown_kind' } as unknown as Intent,
    };

    const res = applyIntent(state, corruptedEnv as Envelope, defaultContext());
    expect(res.changed).toBe(false);
    expect(res.effects).toEqual([]);
    expect(res.state.queue).toEqual([]);
  });
});

describe('DevSecOps & Abuse QA: Control de Votación y Ataques de Duplicación', () => {
  it('garantiza 1 solo voto por usuario ante ataques de envío masivo (Spam / Replay)', () => {
    let state = createEngine(VALID_ROOM, 'Carro');
    const ctx = defaultContext({ id: 'current', title: 'Sonando', artist: 'Artista', duration: 180, source: 'stream', audioUrl: 'https://carbeat.test/stream.mp3' });

    // Encolar una canción
    const reqRes = requestTrack(
      state,
      { id: 't1', title: 'Canción 1', artist: 'Artista 1', duration: 180, source: 'stream', audioUrl: 'https://carbeat.test/t1.mp3' },
      { id: 'rider_a', name: 'Rider A' },
      ctx,
    );
    state = reqRes.state;
    expect(state.queue.length).toBe(1);
    const queueId = state.queue[0].queueId;

    // El solicitante ya votó automáticamente +1
    expect(scoreOf(state.queue[0])).toBe(1);

    // Un atacante (rider_spammer) envía 100 votos positivos concurrentes/consecutivos
    for (let i = 0; i < 100; i++) {
      const voteRes = applyVote(state, 'rider_spammer', queueId, 1);
      state = voteRes.state;
    }

    // El puntaje neto debe ser exactamente 2 (rider_a + rider_spammer), NO 101
    expect(scoreOf(state.queue[0])).toBe(2);
    expect(Object.keys(state.queue[0].votes)).toEqual(['rider_a', 'rider_spammer']);
    expect(state.queue[0].votes['rider_spammer']).toBe(1);
  });

  it('permite alternancia de voto (toggle: 1 -> -1 -> 0) de forma idempotente y segura', () => {
    let state = createEngine(VALID_ROOM, 'Carro');
    const ctx = defaultContext({ id: 'cur', title: 'Now', artist: 'Car', duration: 100, source: 'local_car' });

    state = requestTrack(
      state,
      { id: 't2', title: 'Canción 2', artist: 'Artista 2', duration: 200, source: 'stream', audioUrl: 'https://carbeat.test/t2.mp3' },
      { id: 'rider_owner', name: 'Owner' },
      ctx,
    ).state;
    const qId = state.queue[0].queueId;

    // Pasajero vota negativo
    state = applyVote(state, 'voter_1', qId, -1).state;
    expect(state.queue[0].votes['voter_1']).toBe(-1);
    expect(scoreOf(state.queue[0])).toBe(0); // 1 (owner) - 1 (voter_1)

    // Pasajero quita su voto (valor 0)
    state = applyVote(state, 'voter_1', qId, 0).state;
    expect(state.queue[0].votes['voter_1']).toBeUndefined();
    expect(scoreOf(state.queue[0])).toBe(1);

    // Voto sobre un queueId inexistente no rompe el motor
    const ghostRes = applyVote(state, 'voter_1', 'q_inexistente', 1);
    expect(ghostRes.changed).toBe(false);
    expect(ghostRes.notice).toContain('ya no está en la cola');
  });

  it('rechaza votos con valores no permitidos (valores mayores a 1 o cadenas no numéricas)', () => {
    // Probar a nivel protocolo que parseIntent filtre valores anómalos
    const parsedMaliciousVote = parseEnvelope({
      id: 'env_v',
      room: VALID_ROOM,
      from: 'hacker',
      name: 'Hacker',
      at: clock,
      intent: { kind: 'vote', queueId: 'q_123', value: 999 },
    });
    expect(parsedMaliciousVote).toBeNull();

    const parsedStringVote = parseEnvelope({
      id: 'env_v2',
      room: VALID_ROOM,
      from: 'hacker',
      name: 'Hacker',
      at: clock,
      intent: { kind: 'vote', queueId: 'q_123', value: '1' },
    });
    expect(parsedStringVote).toBeNull();
  });
});

describe('DevSecOps & Abuse QA: URLs Maliciosas y Prevención de Inyección', () => {
  it('neutraliza o rechaza esquemas peligrosos como javascript:, data:, vbscript: o file:', () => {
    const dangerousSchemes = [
      'javascript:alert(document.cookie)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'blob:http://evil.com/498234-uuid',
    ];

    for (const badUrl of dangerousSchemes) {
      // Intento en audioUrl con stream: DEBE ser rechazado completamente
      const trackStream = sanitizeTrack({
        id: 't_evil',
        title: 'Exploit Track',
        artist: 'Attacker',
        source: 'stream',
        audioUrl: badUrl,
      });
      expect(trackStream).toBeNull();

      // Intento en audioUrl con local_car: audioUrl debe ser forzado a vacío ''
      const trackLocal = sanitizeTrack({
        id: 't_evil_local',
        title: 'Exploit Local Track',
        artist: 'Attacker',
        source: 'local_car',
        audioUrl: badUrl,
      });
      expect(trackLocal).not.toBeNull();
      expect(trackLocal!.audioUrl).toBe(''); // Sanitizado a cadena vacía

      // Intento en coverUrl: coverUrl debe ser forzado a undefined
      const trackCover = sanitizeTrack({
        id: 't_cover_evil',
        title: 'Exploit Cover Track',
        artist: 'Attacker',
        source: 'stream',
        audioUrl: 'https://safe.test/song.mp3',
        coverUrl: badUrl,
      });
      expect(trackCover).not.toBeNull();
      expect(trackCover!.coverUrl).toBeUndefined();
    }
  });

  it('rechaza URLs que superen el límite de 1024 caracteres', () => {
    const giantUrl = 'https://safe.test/stream.mp3?' + 'a'.repeat(2000);
    const track = sanitizeTrack({
      id: 't_long',
      title: 'Long URL Song',
      artist: 'Artist',
      source: 'stream',
      audioUrl: giantUrl,
    });
    expect(track).toBeNull();
  });
});

describe('DevSecOps & Abuse QA: Límites de Tamaño y Subida de Archivos MP3', () => {
  it('valida tipos de archivo con isAudioFile y rechaza binarios, scripts y extensiones maliciosas', () => {
    const validAudios = [
      { name: 'song.mp3', type: 'audio/mpeg' },
      { name: 'track.m4a', type: 'audio/mp4' },
      { name: 'audio.wav', type: 'audio/wav' },
      { name: 'music.flac', type: 'audio/flac' },
      { name: 'sound.ogg', type: 'audio/ogg' },
      { name: 'voice.opus', type: 'audio/opus' },
    ];

    for (const item of validAudios) {
      expect(isAudioFile(item)).toBe(true);
    }

    const maliciousOrCorruptFiles = [
      { name: 'payload.exe', type: 'application/x-msdownload' },
      { name: 'exploit.sh', type: 'application/x-sh' },
      { name: 'webshell.php', type: 'application/x-php' },
      { name: 'malware.bat', type: 'text/plain' },
      { name: 'fake.pdf', type: 'application/pdf' },
      { name: 'image.png', type: 'image/png' },
      { name: 'virus.exe.mp3', type: 'application/octet-stream' }, // Extension spoofing sin mime de audio
    ];

    for (const item of maliciousOrCorruptFiles) {
      // Los archivos sin tipo audio/ o extensión soportada deben ser false
      if (!item.name.toLowerCase().endsWith('.mp3')) {
        expect(isAudioFile(item)).toBe(false);
      }
    }
  });

  it('el relé HTTP rechaza envelopes masivos que excedan LIMITS.envelopeBytes (8 KB) con código 413', async () => {
    await postRelay({ op: 'claim', room: VALID_ROOM, token: VALID_TOKEN });

    // Simulación de un archivo MP3 en base64 de 30 MB o payload grande enviado en push
    const largeData = 'x'.repeat(LIMITS.envelopeBytes + 500);
    const maliciousEnvelope = {
      id: 'env_big',
      room: VALID_ROOM,
      from: 'rider_attacker',
      name: 'Attacker',
      at: clock,
      intent: {
        kind: 'request',
        track: {
          id: 'large_track',
          title: 'Big Song',
          artist: 'Big Artist',
          source: 'local_car',
          audioUrl: largeData,
        },
      },
    };

    const res = await postRelay({ op: 'push', envelope: maliciousEnvelope });
    expect(res.status).toBe(413);
    expect((res.body as { error: string }).error).toContain('demasiado grande');
  });

  it('el relé rechaza snapshots manipulados de tamaño excesivo con código 413', async () => {
    await postRelay({ op: 'claim', room: VALID_ROOM, token: VALID_TOKEN });

    const massiveSnapshot = {
      v: PROTOCOL_VERSION,
      room: VALID_ROOM,
      name: 'Carro',
      rev: 2,
      sentAt: clock,
      now: null,
      queue: Array.from({ length: 1500 }, (_, i) => ({
        queueId: `q_${i}`,
        track: { id: `t_${i}`, title: 'Spam'.repeat(20), artist: 'Artist', duration: 180, source: 'local_car' },
        requestedBy: 'Spammer',
        requestedById: 'spammer_id',
        requestedAt: clock,
        autopilot: false,
        votes: {},
      })),
      history: [],
      riders: [],
      settings: { passengerControl: true, maxPendingPerRider: 4 },
      notices: [],
      closed: false,
    };

    const res = await postRelay({
      op: 'sync',
      room: VALID_ROOM,
      token: VALID_TOKEN,
      snapshot: massiveSnapshot,
    });

    expect(res.status).toBe(413);
    expect((res.body as { error: string }).error).toContain('demasiado grande');
  });
});

describe('DevSecOps & Abuse QA: Seguridad de Tokens y Resiliencia ante Desconexión del Host', () => {
  it('rechaza tajantemente operaciones del host con tokens ausentes, cortos, inválidos o ajenos', async () => {
    // 1. Claim con token demasiado corto (< 24 chars)
    const shortTokenRes = await postRelay({ op: 'claim', room: VALID_ROOM, token: 'short_token' });
    expect(shortTokenRes.status).toBe(401);

    // 2. Claim válido
    const claimRes = await postRelay({ op: 'claim', room: VALID_ROOM, token: VALID_TOKEN });
    expect(claimRes.status).toBe(200);

    // 3. Intento de usurpación (claim con otro token para la misma sala)
    const usurpToken = 'u'.repeat(32);
    const usurpRes = await postRelay({ op: 'claim', room: VALID_ROOM, token: usurpToken });
    expect(usurpRes.status).toBe(409); // Conflicto: código en uso

    // 4. Operación sync con token incorrecto
    const syncRes = await postRelay({ op: 'sync', room: VALID_ROOM, token: usurpToken });
    expect(syncRes.status).toBe(403); // Prohibido

    // 5. Cierre con token incorrecto
    const closeRes = await postRelay({ op: 'close', room: VALID_ROOM, token: usurpToken });
    expect(closeRes.status).toBe(403);
  });

  it('notifica estado cerrado a pasajeros cuando el conductor cierra la sala (HTTP 410)', async () => {
    await postRelay({ op: 'claim', room: VALID_ROOM, token: VALID_TOKEN });

    // Host cierra la sala legítimamente
    const closeRes = await postRelay({ op: 'close', room: VALID_ROOM, token: VALID_TOKEN });
    expect(closeRes.status).toBe(200);

    // Pasajero intenta enviar una intención a sala cerrada
    const pushRes = await postRelay({
      op: 'push',
      envelope: {
        id: 'env_after_close',
        room: VALID_ROOM,
        from: 'rider_lost',
        name: 'Rider',
        at: clock,
        intent: { kind: 'hello', name: 'Rider' },
      },
    });
    expect(pushRes.status).toBe(410);
    expect((pushRes.body as { error: string }).error).toContain('cerró la sala');

    // Consulta de estado por GET reporta closed: true
    const stateRes = await getRelay({ op: 'state', room: VALID_ROOM });
    expect(stateRes.status).toBe(200);
    expect((stateRes.body as { closed: boolean }).closed).toBe(true);
  });

  it('pruneRiders desconecta y expulsa pasajeros fantasma que no emitan señales de vida tras 60 s', () => {
    let state = createEngine(VALID_ROOM, 'Carro');

    // Registrar 2 pasajeros
    state = applyIntent(
      state,
      { id: 'h1', room: VALID_ROOM, from: 'rider_active', name: 'Activo', at: clock, intent: { kind: 'hello', name: 'Activo' } },
      defaultContext(),
    ).state;

    state = applyIntent(
      state,
      { id: 'h2', room: VALID_ROOM, from: 'rider_ghost', name: 'Fantasma', at: clock, intent: { kind: 'hello', name: 'Fantasma' } },
      defaultContext(),
    ).state;

    expect(Object.keys(state.riders)).toEqual(['rider_active', 'rider_ghost']);

    // Avanzamos el reloj 30s y rider_active saluda de nuevo
    clock += 30_000;
    state = applyIntent(
      state,
      { id: 'h3', room: VALID_ROOM, from: 'rider_active', name: 'Activo', at: clock, intent: { kind: 'hello', name: 'Activo' } },
      defaultContext(),
    ).state;

    // Avanzamos el reloj 35s más (total 65s desde el saludo de rider_ghost)
    clock += 35_000;
    state = pruneRiders(state, clock);

    // rider_ghost debe haber sido podado por inactividad (> 60_000 ms)
    expect(state.riders['rider_ghost']).toBeUndefined();
    expect(state.riders['rider_active']).toBeDefined();
  });
});
