import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyIntent,
  createEngine,
  requestTrack,
  takeEntry,
  type ApplyContext,
  type EngineState,
  AUTOPILOT_ID,
  HOST_ID,
} from '../shared/room-engine';
import {
  parseEnvelope,
  parseWire,
  scoreOf,
  type Envelope,
  type Intent,
  type Track,
} from '../shared/protocol';
import { HostSession, type PlayerPort, type PlayerState } from '../src/core/room/host-session';
import { carLibrary } from '../src/core/library';
import { EQ_PRESETS, EqualizerPreset, EqualizerGains } from '../src/core/audio/equalizer-service';

// ---------------------------------------------------------------------------
// Mocks para Storage y Web Audio API en entorno Node / Vitest
// ---------------------------------------------------------------------------

const memStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => memStorage.get(k) ?? null,
  setItem: (k: string, v: string) => void memStorage.set(k, String(v)),
  removeItem: (k: string) => void memStorage.delete(k),
  clear: () => memStorage.clear(),
};

class MockAudioParam {
  value = 0;
  setTargetAtTime(target: number, _startTime: number, _timeConstant: number) {
    this.value = target;
  }
}

class MockBiquadFilterNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  gain = new MockAudioParam();
  connectedTo: unknown = null;

  connect(destination: unknown) {
    this.connectedTo = destination;
    return destination;
  }
}

class MockMediaElementAudioSourceNode {
  mediaElement: HTMLMediaElement;
  connectedTo: unknown = null;
  constructor(element: HTMLMediaElement) {
    this.mediaElement = element;
  }
  connect(destination: unknown) {
    this.connectedTo = destination;
    return destination;
  }
}

class MockAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = { id: 'speakers_destination' };
  createdNodes: MockBiquadFilterNode[] = [];

  createBiquadFilter() {
    const node = new MockBiquadFilterNode();
    this.createdNodes.push(node);
    return node as unknown as BiquadFilterNode;
  }

  createMediaElementSource(element: HTMLMediaElement) {
    return new MockMediaElementAudioSourceNode(element) as unknown as MediaElementAudioSourceNode;
  }

  async resume() {
    this.state = 'running';
  }
}

// ---------------------------------------------------------------------------
// Helpers para generación de pistas de prueba
// ---------------------------------------------------------------------------

const ROOM_ID = 'BEAT-9988';

const makeTrack = (id: string, opts: Partial<Track> = {}): Track => ({
  id: `track_${id}`,
  title: `Título ${id}`,
  artist: `Artista ${id}`,
  duration: 180,
  source: 'stream',
  audioUrl: `https://cdn.example.com/audio/${id}.mp3`,
  videoId: undefined,
  ...opts,
});

const makeEnv = (from: string, intent: Intent, name = from): Envelope => ({
  id: `env_${Math.random().toString(36).slice(2, 9)}`,
  room: ROOM_ID,
  from,
  name,
  at: Date.now(),
  intent,
});

// ---------------------------------------------------------------------------
// SUITE 1: Protocolo v2 y Room Engine - Flag playNow y Prioridad Inmediata
// ---------------------------------------------------------------------------

describe('Motor de Sala v2 - Flag playNow e Inmediatez de Reproducción', () => {
  const currentPlaying = makeTrack('now_playing', { title: 'Canción en Curso' });
  const contextPlaying: ApplyContext = { now: 1000, current: currentPlaying };
  const contextIdle: ApplyContext = { now: 1000, current: null };

  it('[P0] Si no hay nada sonando, una petición normal se reproduce de inmediato', () => {
    const state = createEngine(ROOM_ID, 'Carro Principal');
    const newTrack = makeTrack('first_track');
    const result = requestTrack(state, newTrack, { id: 'p1', name: 'Pasajero Uno' }, contextIdle, { playNow: false });

    expect(result.effects).toHaveLength(1);
    expect(result.effects[0]).toEqual({
      type: 'play',
      track: expect.objectContaining({ id: 'track_first_track', addedBy: 'Pasajero Uno' }),
      requestedBy: 'Pasajero Uno',
    });
    expect(result.state.queue).toHaveLength(0);
    expect(result.changed).toBe(true);
  });

  it('[P0] Si hay música sonando y playNow=true, emite efecto "play" de inmediato y no va a la cola', () => {
    const state = createEngine(ROOM_ID, 'Carro Principal');
    const urgentTrack = makeTrack('urgent_song', { title: 'Canción Urgente' });
    const result = requestTrack(state, urgentTrack, { id: HOST_ID, name: 'Conductor' }, contextPlaying, { playNow: true });

    // Debe emitir el efecto play de inmediato
    expect(result.effects).toEqual([
      {
        type: 'play',
        track: expect.objectContaining({ id: 'track_urgent_song', addedBy: 'Conductor' }),
        requestedBy: 'Conductor',
      },
    ]);
    // No debe agregarse a la cola
    expect(result.state.queue).toHaveLength(0);
    expect(result.changed).toBe(true);
  });

  it('[P0] Si hay música sonando y playNow=false, la canción entra a la cola con voto y no emite efecto play', () => {
    const state = createEngine(ROOM_ID, 'Carro Principal');
    const normalTrack = makeTrack('normal_song');
    const result = requestTrack(state, normalTrack, { id: 'rider_a', name: 'Ana' }, contextPlaying, { playNow: false });

    expect(result.effects).toHaveLength(0);
    expect(result.state.queue).toHaveLength(1);
    expect(result.state.queue[0].track.id).toBe('track_normal_song');
    expect(result.state.queue[0].votes['rider_a']).toBe(1);
    expect(scoreOf(result.state.queue[0])).toBe(1);
  });

  it('[P1] applyIntent propaga correctamente playNow=true desde el Envelope del pasajero', () => {
    let state = createEngine(ROOM_ID, 'Carro Principal');
    const riderEnv = makeEnv('rider_vip', {
      kind: 'request',
      track: makeTrack('vip_request'),
      playNow: true,
    }, 'VIP Guest');

    const result = applyIntent(state, riderEnv, contextPlaying);

    expect(result.effects).toHaveLength(1);
    expect(result.effects[0].type).toBe('play');
    expect(result.effects[0]).toEqual({
      type: 'play',
      track: expect.objectContaining({ id: 'track_vip_request', addedBy: 'VIP Guest' }),
      requestedBy: 'VIP Guest',
    });
    expect(result.state.queue).toHaveLength(0);
  });

  it('[P1] Si la canción pedida con playNow=true es idéntica a la que ya está sonando, rechaza con aviso', () => {
    const state = createEngine(ROOM_ID, 'Carro Principal');
    const result = requestTrack(state, currentPlaying, { id: 'p1', name: 'Pasajero' }, contextPlaying, { playNow: true });

    expect(result.effects).toHaveLength(0);
    expect(result.notice).toBe('Esa canción ya está sonando');
    expect(result.changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SUITE 2: Ecualizador Car Audio Pro (Web Audio API, Rangos y Presets)
// ---------------------------------------------------------------------------

describe('Ecualizador Car Audio Pro (equalizer-service.ts)', () => {
  let mockCtx: MockAudioContext;

  beforeEach(async () => {
    memStorage.clear();
    mockCtx = new MockAudioContext();

    // Inyectar constructor de AudioContext compatible en globalThis
    function MockAudioContextConstructor() {
      return mockCtx;
    }

    Object.assign(globalThis, {
      localStorage: mockLocalStorage,
      window: {
        AudioContext: MockAudioContextConstructor,
        localStorage: mockLocalStorage,
      },
    });

    const { equalizerService } = await import('../src/core/audio/equalizer-service');
    // Resetear estado interno del singleton para garantizar aislamiento en cada test
    (equalizerService as any).ctx = null;
    (equalizerService as any).bassNode = null;
    (equalizerService as any).midNode = null;
    (equalizerService as any).trebleNode = null;
    (equalizerService as any).sourceConnected = false;
    (equalizerService as any).connectedElement = null;
    (equalizerService as any).gains = { bass: 0, mid: 0, treble: 0 };
    (equalizerService as any).activePreset = 'flat';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('[P0] Inicializa correctamente la cadena Biquad: LowShelf(80Hz) -> Peaking(1000Hz) -> HighShelf(8000Hz)', async () => {
    const { equalizerService } = await import('../src/core/audio/equalizer-service');

    // Forzar conexión con un elemento de audio dummy
    const dummyAudio = {} as HTMLMediaElement;
    equalizerService.connectSource(dummyAudio);

    expect(mockCtx.createdNodes).toHaveLength(3);

    const [bass, mid, treble] = mockCtx.createdNodes;

    // 1. Bajos: LowShelf a 80 Hz
    expect(bass.type).toBe('lowshelf');
    expect(bass.frequency.value).toBe(80);
    expect(bass.connectedTo).toBe(mid);

    // 2. Medios: Peaking a 1000 Hz, Q = 1.0
    expect(mid.type).toBe('peaking');
    expect(mid.frequency.value).toBe(1000);
    expect(mid.Q.value).toBe(1.0);
    expect(mid.connectedTo).toBe(treble);

    // 3. Altos: HighShelf a 8000 Hz
    expect(treble.type).toBe('highshelf');
    expect(treble.frequency.value).toBe(8000);
    expect(treble.connectedTo).toBe(mockCtx.destination);
  });

  it('[P0] Clampea estrictamente las ganancias en el rango legal de -12 a +12 dB', async () => {
    const { equalizerService } = await import('../src/core/audio/equalizer-service');
    equalizerService.connectSource({} as HTMLMediaElement);

    // Caso exceso positivo (+20 dB -> +12 dB)
    equalizerService.setGain('bass', 20);
    expect(equalizerService.getGains().bass).toBe(12);

    // Caso exceso negativo (-30 dB -> -12 dB)
    equalizerService.setGain('mid', -30);
    expect(equalizerService.getGains().mid).toBe(-12);

    // Caso con decimales (redondeo matemático)
    equalizerService.setGain('treble', 5.7);
    expect(equalizerService.getGains().treble).toBe(6);

    // El preset debe pasar a 'custom' al cambiar manualmente
    expect(equalizerService.getPreset()).toBe('custom');
  });

  it('[P0] Aplica presets oficiales (Bass Boost, Subwoofer, Vocal, etc.) con sus ganancias exactas', async () => {
    const { equalizerService } = await import('../src/core/audio/equalizer-service');
    equalizerService.connectSource({} as HTMLMediaElement);

    // 1. Subwoofer Extremo (Planta): bass 12, mid -2, treble 1
    equalizerService.applyPreset('subwoofer');
    expect(equalizerService.getPreset()).toBe('subwoofer');
    expect(equalizerService.getGains()).toEqual(EQ_PRESETS.subwoofer.gains);
    expect(mockCtx.createdNodes[0].gain.value).toBe(12);
    expect(mockCtx.createdNodes[1].gain.value).toBe(-2);
    expect(mockCtx.createdNodes[2].gain.value).toBe(1);

    // 2. Bass Boost: bass 8, mid 0, treble 2
    equalizerService.applyPreset('bass_boost');
    expect(equalizerService.getPreset()).toBe('bass_boost');
    expect(equalizerService.getGains()).toEqual(EQ_PRESETS.bass_boost.gains);

    // 3. Voz Clara: bass -2, mid 6, treble 3
    equalizerService.applyPreset('vocal');
    expect(equalizerService.getPreset()).toBe('vocal');
    expect(equalizerService.getGains()).toEqual(EQ_PRESETS.vocal.gains);

    // 4. Plano: bass 0, mid 0, treble 0
    equalizerService.applyPreset('flat');
    expect(equalizerService.getPreset()).toBe('flat');
    expect(equalizerService.getGains()).toEqual({ bass: 0, mid: 0, treble: 0 });
  });

  it('[P1] Persistencia y restauración íntegra en localStorage', async () => {
    const { equalizerService } = await import('../src/core/audio/equalizer-service');
    equalizerService.applyPreset('subwoofer');

    // Verificar que se guardó en localStorage bajo 'carbeat_equalizer_v1'
    const raw = memStorage.get('carbeat_equalizer_v1');
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!);
    expect(stored.preset).toBe('subwoofer');
    expect(stored.gains).toEqual({ bass: 12, mid: -2, treble: 1 });
  });

  it('[P1] Notifica a los suscriptores cuando cambian las ganancias o preset', async () => {
    const { equalizerService } = await import('../src/core/audio/equalizer-service');
    const subscriber = vi.fn();
    const unsubscribe = equalizerService.subscribe(subscriber);

    equalizerService.applyPreset('rock');
    expect(subscriber).toHaveBeenCalledTimes(1);

    equalizerService.setGain('bass', 4);
    expect(subscriber).toHaveBeenCalledTimes(2);

    unsubscribe();
    equalizerService.applyPreset('flat');
    expect(subscriber).toHaveBeenCalledTimes(2); // no debe llamarse tras desuscribir
  });
});

// ---------------------------------------------------------------------------
// SUITE 3: HostSession - Aceptación de Canciones Locales, data:audio y Pasajeros
// ---------------------------------------------------------------------------

describe('HostSession - Aceptación de Canciones Locales y de Pasajeros', () => {
  let playerState: PlayerState;
  let playerEvents: { onEnded?: () => void };
  let mockPlayer: PlayerPort;
  let localLibrary: Track[];

  beforeEach(() => {
    memStorage.clear();
    playerEvents = {};
    playerState = {
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      buffering: false,
      error: null,
    };

    mockPlayer = {
      load: vi.fn((track: Track, autoplay: boolean, startAt?: number) => {
        playerState.currentTrack = track;
        playerState.isPlaying = autoplay;
        playerState.currentTime = startAt ?? 0;
        playerState.duration = track.duration || 210;
      }),
      toggle: vi.fn(() => {
        playerState.isPlaying = !playerState.isPlaying;
      }),
      pause: vi.fn(() => {
        playerState.isPlaying = false;
      }),
      seek: vi.fn((sec: number) => {
        playerState.currentTime = sec;
      }),
      getState: vi.fn(() => playerState),
      subscribe: vi.fn((cb: (s: PlayerState) => void) => {
        cb(playerState);
        return () => {};
      }),
      onEnded: vi.fn((cb: () => void) => {
        playerEvents.onEnded = cb;
      }),
    };

    localLibrary = [
      makeTrack('car_mp3_1', {
        title: 'Salsa Baúl USB',
        artist: 'Orquesta Local',
        source: 'local_car',
        audioUrl: 'blob:http://localhost/uuid-car-1',
      }),
    ];

    Object.assign(globalThis, {
      localStorage: mockLocalStorage,
    });
  });

  it('[P0] Resuelve una pista local_car existente en la biblioteca del carro', () => {
    const session = new HostSession({
      room: ROOM_ID,
      name: 'Carro DJ',
      player: mockPlayer,
      channels: { p2p: false, lan: false, local: false, http: false },
      getLocalLibrary: () => localLibrary,
    });

    // Pasajero pide la canción local_car referenciándola por ID
    const passengerEnv = makeEnv('rider_1', {
      kind: 'request',
      track: {
        id: 'track_car_mp3_1',
        title: 'Salsa Baúl USB',
        artist: 'Orquesta Local',
        duration: 180,
        source: 'local_car',
        audioUrl: '', // los pasajeros la ven sin URL
      },
    });

    // Simular recepción a través del método privado/link de receive
    (session as any).receive(passengerEnv, 'local');

    const view = session.getView();
    // Como no había nada sonando, debe comenzar a reproducir inmediatamente
    expect(mockPlayer.load).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'track_car_mp3_1',
        audioUrl: 'blob:http://localhost/uuid-car-1', // ¡Resuelto con la URL local real!
      }),
      true
    );
    expect(view.now?.track.id).toBe('track_car_mp3_1');
    session.dispose();
  });

  it('[P0] Acepta canciones de pasajeros con URLs data:audio/ aunque no estén en el carro', () => {
    const session = new HostSession({
      room: ROOM_ID,
      name: 'Carro DJ',
      player: mockPlayer,
      channels: { p2p: false, lan: false, local: false, http: false },
      getLocalLibrary: () => localLibrary,
    });

    const dataAudioUrl = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2...';
    const passengerTrack = makeTrack('passenger_song_1', {
      title: 'Canción Compartida por Pasajero',
      artist: 'DJ Pasajero',
      source: 'local_car',
      audioUrl: dataAudioUrl,
    });

    const passengerEnv = makeEnv('rider_dj', {
      kind: 'request',
      track: passengerTrack,
      playNow: true,
    });

    (session as any).receive(passengerEnv, 'local');

    expect(mockPlayer.load).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'track_passenger_song_1',
        audioUrl: dataAudioUrl,
      }),
      true
    );
    session.dispose();
  });

  it('[P1] Rechaza una canción local_car si ya no existe en el carro y no tiene audio data:', () => {
    const session = new HostSession({
      room: ROOM_ID,
      name: 'Carro DJ',
      player: mockPlayer,
      channels: { p2p: false, lan: false, local: false, http: false },
      getLocalLibrary: () => [], // biblioteca vacía
    });

    const passengerEnv = makeEnv('rider_2', {
      kind: 'request',
      track: {
        id: 'track_inexistente',
        title: 'Canción Borrada',
        artist: 'Desconocido',
        duration: 120,
        source: 'local_car',
        audioUrl: '',
      },
    });

    (session as any).receive(passengerEnv, 'local');

    const view = session.getView();
    expect(mockPlayer.load).not.toHaveBeenCalled();
    expect(view.notices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          to: 'rider_2',
          text: 'Esa canción ya no está en el carro',
        }),
      ])
    );
    session.dispose();
  });

  it('[P0] session.playNow(queueId) extrae la pista de la cola y la reproduce de inmediato', () => {
    const session = new HostSession({
      room: ROOM_ID,
      name: 'Carro DJ',
      player: mockPlayer,
      channels: { p2p: false, lan: false, local: false, http: false },
    });

    // Poner algo a sonar para que la siguiente vaya a la cola
    session.playTrackNow(makeTrack('current_playing'));

    // Pedir dos canciones que van a la cola
    session.request(makeTrack('queue_1', { title: 'Cola 1' }));
    session.request(makeTrack('queue_2', { title: 'Cola 2' }));

    const viewBefore = session.getView();
    expect(viewBefore.engine.queue).toHaveLength(2);
    const targetQueueId = viewBefore.engine.queue[1].queueId; // Cola 2

    // Ejecutar playNow sobre la segunda canción de la cola
    session.playNow(targetQueueId);

    const viewAfter = session.getView();
    // La canción actual debe ser ahora Cola 2
    expect(mockPlayer.load).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'track_queue_2' }),
      true
    );
    // Y la cola debe tener solo 1 elemento (Cola 1)
    expect(viewAfter.engine.queue).toHaveLength(1);
    expect(viewAfter.engine.queue[0].track.id).toBe('track_queue_1');
    session.dispose();
  });
});

// ---------------------------------------------------------------------------
// SUITE 4: CarLibrary - Gestión de Favoritos Locales y Remotos
// ---------------------------------------------------------------------------

describe('CarLibrary (carLibrary.toggleFavorite) - Favoritos Locales y Remotos', () => {
  beforeEach(() => {
    memStorage.clear();
    Object.assign(globalThis, {
      localStorage: mockLocalStorage,
    });
    // Limpiar favoritos en el store de carLibrary
    (carLibrary as any).state.favorites = [];
  });

  it('[P0] Guarda y elimina canciones remotas de favoritos', () => {
    const remoteTrack = makeTrack('remote_hit', {
      title: 'Mega Hit Remoto',
      artist: 'Top Artist',
      videoId: 'AbCdEf12345',
      source: 'stream',
    });

    // 1. Guardar en favoritos
    const added = carLibrary.toggleFavorite(remoteTrack);
    expect(added).toBe(true);
    expect(carLibrary.isFavorite(remoteTrack)).toBe(true);
    expect(carLibrary.getState().favorites).toHaveLength(1);
    expect(carLibrary.getState().favorites[0].id).toBe('track_remote_hit');

    // Verificar persistencia en localStorage
    const savedJson = memStorage.get('carbeat.favorites.v2');
    expect(savedJson).not.toBeNull();
    const parsed = JSON.parse(savedJson!);
    expect(parsed[0].id).toBe('track_remote_hit');

    // 2. Retirar de favoritos
    const removed = carLibrary.toggleFavorite(remoteTrack);
    expect(removed).toBe(false);
    expect(carLibrary.isFavorite(remoteTrack)).toBe(false);
    expect(carLibrary.getState().favorites).toHaveLength(0);

    const savedAfter = JSON.parse(memStorage.get('carbeat.favorites.v2')!);
    expect(savedAfter).toHaveLength(0);
  });

  it('[P0] Guarda y elimina canciones locales (USB/MP3) de favoritos', () => {
    const localTrack = makeTrack('usb_track_01', {
      title: 'Canción USB Disco Duro',
      artist: 'Grupo Niche',
      source: 'local_car',
      audioUrl: 'blob:http://localhost/local-file-uuid',
    });

    // Guardar favorita local
    const added = carLibrary.toggleFavorite(localTrack);
    expect(added).toBe(true);
    expect(carLibrary.isFavorite(localTrack)).toBe(true);
    expect(carLibrary.getState().favorites).toHaveLength(1);
    expect(carLibrary.getState().favorites[0].id).toBe('track_usb_track_01');

    // Retirar favorita local
    const removed = carLibrary.toggleFavorite(localTrack);
    expect(removed).toBe(false);
    expect(carLibrary.isFavorite(localTrack)).toBe(false);
    expect(carLibrary.getState().favorites).toHaveLength(0);
  });

  it('[P1] Identifica la misma canción en favoritos independientemente de mayúsculas o sufijos', () => {
    const trackOriginal = makeTrack('id_1', {
      title: 'Vivir Mi Vida',
      artist: 'Marc Anthony',
      source: 'stream',
    });
    const trackVariant = makeTrack('id_2', {
      title: 'vivir mi vida (Official Video)',
      artist: 'Marc Anthony',
      source: 'stream',
    });

    carLibrary.toggleFavorite(trackOriginal);
    // Debe reconocerla como favorita por normalización trackKey / sameTrack
    expect(carLibrary.isFavorite(trackVariant)).toBe(true);

    // Alternar sobre la variante debe retirarla
    const removed = carLibrary.toggleFavorite(trackVariant);
    expect(removed).toBe(false);
    expect(carLibrary.isFavorite(trackOriginal)).toBe(false);
    expect(carLibrary.getState().favorites).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SUITE 5: Protocol Wire Parsing & Edge Cases (Análisis de Anomalías)
// ---------------------------------------------------------------------------

describe('Protocolo v2 - Detección de Anomalías de Serialización Wire', () => {
  it('[QA-AUDIT] Verifica si parseEnvelope preserva el flag playNow en intenciones de tipo "request"', () => {
    const rawEnvelope = {
      id: 'env_test_01',
      room: ROOM_ID,
      from: 'rider_phone',
      name: 'Carlos',
      at: 1700000000000,
      intent: {
        kind: 'request',
        track: {
          id: 'track_net_1',
          title: 'Tema Red',
          artist: 'Banda',
          duration: 200,
          source: 'stream',
          audioUrl: 'https://audio.example.com/song.mp3',
        },
        playNow: true,
      },
    };

    const parsed = parseEnvelope(rawEnvelope);
    expect(parsed).not.toBeNull();
    expect(parsed?.intent.kind).toBe('request');

    // AUDITORÍA: El tipo Intent contempla playNow?: boolean, pero ¿lo preserva parseIntent?
    const reqIntent = parsed?.intent as { kind: 'request'; track: Track; playNow?: boolean };
    
    // Este test registra formalmente el comportamiento actual del parser
    // Si parseIntent no incluye playNow, este expect fallará o detectará la discrepancia.
    const preservesPlayNow = reqIntent.playNow === true;
    
    // Dejamos constancia documentada:
    if (!preservesPlayNow) {
      console.warn('[QA-ANOMALÍA DETECTADA] parseEnvelope / parseIntent descarta el atributo playNow durante la deserialización');
    }
    expect(preservesPlayNow).toBe(true);
  });
});
