import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CARBEAT_FORCE_2D_KEY,
  _resetGraphicsCache,
  canRender3D,
  getGraphicsPreference,
  isWebGLAvailable,
  setGraphicsPreference,
} from '../src/core/device/graphics-detector';
import { generateLocalId, isAudioFile } from '../src/core/audio/local-audio-db';
import { ThreeErrorBoundary } from '../src/ui/three/ThreeErrorBoundary';

// Mock en memoria para localStorage
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => storageMap.set(k, String(v)),
  removeItem: (k: string) => storageMap.delete(k),
  clear: () => storageMap.clear(),
};

// Guardar descriptores originales de Node.js
const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalCryptoDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

function setMockNavigator(props: Record<string, unknown>) {
  Object.defineProperty(globalThis, 'navigator', {
    value: props,
    configurable: true,
    writable: true,
  });
}

function setMockWindow(props: Record<string, unknown>) {
  Object.defineProperty(globalThis, 'window', {
    value: props,
    configurable: true,
    writable: true,
  });
}

function setMockDocument(props: Record<string, unknown>) {
  Object.defineProperty(globalThis, 'document', {
    value: props,
    configurable: true,
    writable: true,
  });
}

describe('QA Resiliencia de Hardware y Gráficos (CarBeat v2.1.0)', () => {
  beforeEach(() => {
    storageMap.clear();
    _resetGraphicsCache();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
      writable: true,
    });
    setMockWindow({});
    setMockDocument({});
    setMockNavigator({});
  });

  afterEach(() => {
    _resetGraphicsCache();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
    }
    if (originalCryptoDesc) {
      Object.defineProperty(globalThis, 'crypto', originalCryptoDesc);
    }
  });

  // =========================================================================
  // 1. graphics-detector.ts: Detección y Conmutación WebGL en Radios Chinas
  // =========================================================================
  describe('Detector de gráficos y GPU embebida (graphics-detector.ts)', () => {
    it('P0: Retorna false si window.WebGLRenderingContext no existe (simulación de radio china sin GPU)', () => {
      // Simular navegador Android Legacy sin WebGLRenderingContext en window
      setMockWindow({});
      _resetGraphicsCache();

      const available = isWebGLAvailable();
      expect(available).toBe(false);
    });

    it('P0: Retorna false si getContext("webgl") retorna null', () => {
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(null),
      };
      setMockWindow({ WebGLRenderingContext: class {} });
      setMockDocument({ createElement: vi.fn().mockReturnValue(mockCanvas) });
      _resetGraphicsCache();

      const available = isWebGLAvailable();
      expect(available).toBe(false);
      expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl', { powerPreference: 'low-power' });
    });

    it('P0: Retorna false si getContext("webgl") arroja una excepción fatal de driver/GPU', () => {
      const mockCanvas = {
        getContext: vi.fn().mockImplementation(() => {
          throw new Error('GPU context initialization failed: driver crash');
        }),
      };
      setMockWindow({ WebGLRenderingContext: class {} });
      setMockDocument({ createElement: vi.fn().mockReturnValue(mockCanvas) });
      _resetGraphicsCache();

      expect(() => isWebGLAvailable()).not.toThrow();
      expect(isWebGLAvailable()).toBe(false);
    });

    it('P1: Retorna true y libera el contexto con WEBGL_lose_context si el soporte es real', () => {
      const mockLoseContext = vi.fn();
      const mockGl = {
        getExtension: vi.fn().mockImplementation((ext: string) => {
          if (ext === 'WEBGL_lose_context') {
            return { loseContext: mockLoseContext };
          }
          return null;
        }),
      };
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockGl),
      };
      setMockWindow({ WebGLRenderingContext: class {} });
      setMockDocument({ createElement: vi.fn().mockReturnValue(mockCanvas) });
      _resetGraphicsCache();

      const available = isWebGLAvailable();
      expect(available).toBe(true);
      expect(mockLoseContext).toHaveBeenCalledTimes(1);
    });

    it('P1: Activación de preferencia manual CARBEAT_FORCE_2D_KEY y persistencia', () => {
      expect(CARBEAT_FORCE_2D_KEY).toBe('carbeat_graphics_mode');
      expect(getGraphicsPreference()).toBe('auto');

      setGraphicsPreference('2d');
      expect(mockLocalStorage.getItem(CARBEAT_FORCE_2D_KEY)).toBe('2d');
      expect(getGraphicsPreference()).toBe('2d');

      setGraphicsPreference('3d');
      expect(mockLocalStorage.getItem(CARBEAT_FORCE_2D_KEY)).toBe('3d');
      expect(getGraphicsPreference()).toBe('3d');

      setGraphicsPreference('auto');
      expect(getGraphicsPreference()).toBe('auto');
    });

    it('P1: canRender3D() respeta la preferencia forzada 2D de inmediato', () => {
      // Simular que WebGL sí está disponible
      const mockGl = { getExtension: vi.fn().mockReturnValue(null) };
      const mockCanvas = { getContext: vi.fn().mockReturnValue(mockGl) };
      setMockWindow({ WebGLRenderingContext: class {} });
      setMockDocument({ createElement: vi.fn().mockReturnValue(mockCanvas) });
      _resetGraphicsCache();

      // En modo 2D forzado, canRender3D DEBE retornar false sin importar WebGL
      setGraphicsPreference('2d');
      expect(canRender3D()).toBe(false);

      // En modo 3D forzado con WebGL disponible, debe retornar true
      setGraphicsPreference('3d');
      expect(canRender3D()).toBe(true);
    });

    it('P2: canRender3D() en modo "auto" desactiva 3D ante ahorro de datos o redes móviles lentas', () => {
      const mockGl = { getExtension: vi.fn().mockReturnValue(null) };
      const mockCanvas = { getContext: vi.fn().mockReturnValue(mockGl) };
      setMockWindow({ WebGLRenderingContext: class {} });
      setMockDocument({ createElement: vi.fn().mockReturnValue(mockCanvas) });
      _resetGraphicsCache();
      setGraphicsPreference('auto');

      // Caso 1: Red 4G normal sin ahorro de datos -> canRender3D: true
      setMockNavigator({
        connection: { saveData: false, effectiveType: '4g' },
      });
      expect(canRender3D()).toBe(true);

      // Caso 2: saveData activo (ahorro de datos de red móvil del auto)
      setMockNavigator({
        connection: { saveData: true, effectiveType: '4g' },
      });
      expect(canRender3D()).toBe(false);

      // Caso 3: Red lenta 2g o 3g
      setMockNavigator({
        connection: { saveData: false, effectiveType: '3g' },
      });
      expect(canRender3D()).toBe(false);

      setMockNavigator({
        connection: { saveData: false, effectiveType: '2g' },
      });
      expect(canRender3D()).toBe(false);
    });
  });

  // =========================================================================
  // 2. local-audio-db.ts: Blindaje de ID y Filtro Robusto de Audio
  // =========================================================================
  describe('Base de datos y utilidades de audio local (local-audio-db.ts)', () => {
    it('P0: generateLocalId() genera 10,000 IDs con CERO colisiones sin crypto.randomUUID (radio china)', () => {
      // Simular entorno legado sin crypto.randomUUID
      Object.defineProperty(globalThis, 'crypto', {
        value: { randomUUID: undefined },
        configurable: true,
        writable: true,
      });

      const TOTAL_IDS = 10_000;
      const ids = new Set<string>();

      for (let i = 0; i < TOTAL_IDS; i++) {
        const id = generateLocalId();
        expect(id.startsWith('car_')).toBe(true);
        ids.add(id);
      }

      // Validación estricta de cero colisiones: el Set debe tener exactamente 10,000 elementos únicos
      expect(ids.size).toBe(TOTAL_IDS);
    });

    it('P1: generateLocalId() usa crypto.randomUUID cuando está disponible', () => {
      const mockUuid = '12345678-abcd-ef01-2345-6789abcdef01';
      Object.defineProperty(globalThis, 'crypto', {
        value: { randomUUID: vi.fn().mockReturnValue(mockUuid) },
        configurable: true,
        writable: true,
      });

      const id = generateLocalId();
      expect(id).toBe('car_12345678-abc');
      expect(id.length).toBe(16);
    });

    it('P0: isAudioFile detecta extensiones de audio en mayúsculas, minúsculas y MIME types', () => {
      const validAudioFiles = [
        { name: 'soda_stereo.mp3' },
        { name: 'SODA_STEREO.MP3' },
        { name: 'pista_auto.m4a' },
        { name: 'PISTA_AUTO.M4A' },
        { name: 'grabacion.wav' },
        { name: 'GRABACION.WAV' },
        { name: 'lossless.flac' },
        { name: 'LOSSLESS.FLAC' },
        { name: 'audio_stream.aac' },
        { name: 'AUDIO_STREAM.AAC' },
        { name: 'sound.ogg' },
        { name: 'voice.opus' },
        { name: 'car_radio.wma' },
        { name: 'podcast.mp4' },
        // Detección por MIME type sin importar nombre
        { name: 'desconocido_stream', type: 'audio/mpeg' },
        { name: 'grabacion_raw', type: 'audio/wav' },
        { name: 'transmision_p2p', type: 'audio/flac' },
      ];

      for (const file of validAudioFiles) {
        expect(isAudioFile(file)).toBe(true);
      }
    });

    it('P0: isAudioFile rechaza con total seguridad archivos no musicales (.exe, .jpg, .pdf)', () => {
      const rejectedFiles = [
        { name: 'actualizacion_trucada.exe' },
        { name: 'MALWARE.EXE' },
        { name: 'caratula.jpg' },
        { name: 'CARATULA.JPEG' },
        { name: 'manual_carro.pdf' },
        { name: 'MANUAL_CARRO.PDF' },
        { name: 'foto_tablero.png' },
        { name: 'firmware.bin' },
        { name: 'install.sh' },
        { name: 'datos.zip' },
        { name: 'archivo_sin_extension' },
        { name: 'documento.txt', type: 'text/plain' },
        { name: 'video_mkv.mkv', type: 'video/x-matroska' },
      ];

      for (const file of rejectedFiles) {
        expect(isAudioFile(file)).toBe(false);
      }
    });
  });

  // =========================================================================
  // 3. ThreeErrorBoundary.tsx: Conmutación Automática y Resguardo de Sesión
  // =========================================================================
  describe('Manejador de fallos 3D (ThreeErrorBoundary.tsx)', () => {
    it('P0: Conmuta al fallback 2D y activa CARBEAT_FORCE_2D_KEY en localStorage ante error WebGL', () => {
      const onErrorSpy = vi.fn();
      const boundary = new ThreeErrorBoundary({
        children: '3D_SCENE_ACTIVE',
        fallback: '2D_FALLBACK_RENDERED',
        onError: onErrorSpy,
      });

      // 1. Estado inicial sin error: renderiza la escena 3D hija
      expect(boundary.render()).toBe('3D_SCENE_ACTIVE');

      // 2. Simulación de crash WebGL lanzado por R3F o la GPU de la radio
      const webglError = new Error('WebGL: CONTEXT_LOST_WEBGL or could not create context');
      const componentStack = '\n    in Canvas\n    in ThreeScene\n    in App';

      // 3. getDerivedStateFromError actualiza el estado reactivo
      const derivedState = ThreeErrorBoundary.getDerivedStateFromError(webglError);
      expect(derivedState).toEqual({ hasError: true, error: webglError });

      // 4. componentDidCatch registra modo 2D de resguardo y ejecuta el callback
      boundary.componentDidCatch(webglError, { componentStack });

      // Verifica que guardó la preferencia en localStorage con la clave correcta
      expect(mockLocalStorage.getItem(CARBEAT_FORCE_2D_KEY)).toBe('2d');
      expect(getGraphicsPreference()).toBe('2d');

      // Verifica notificación a listeners
      expect(onErrorSpy).toHaveBeenCalledTimes(1);
      expect(onErrorSpy).toHaveBeenCalledWith(webglError);

      // 5. Tras el error, el render conmuta al fallback 2D seguro
      boundary.state = derivedState;
      expect(boundary.render()).toBe('2D_FALLBACK_RENDERED');
    });
  });
});
