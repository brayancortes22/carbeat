// Detector seguro y no intrusivo de aceleración gráfica WebGL y pantallas de auto.
// Esencial para evitar caídas fatales (crash) en radios táctiles Android antiguas con GPUs básicas (Mali, PowerVR).

const STORAGE_KEY = 'carbeat_graphics_mode';
export type GraphicsMode = 'auto' | '2d' | '3d';

let cachedSupport: boolean | null = null;

/**
 * Prueba síncrona y protegida para verificar si el navegador puede crear un contexto WebGL real.
 * Libera el contexto de inmediato para no consumir slots de GPU en dispositivos embebidos.
 */
export function isWebGLAvailable(): boolean {
  if (cachedSupport !== null) return cachedSupport;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    cachedSupport = false;
    return false;
  }

  // 1. Verificar soporte de API básica
  if (!window.WebGLRenderingContext) {
    cachedSupport = false;
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const gl =
      (canvas.getContext('webgl', { powerPreference: 'low-power' }) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) {
      cachedSupport = false;
      return false;
    }

    // 2. Liberar el contexto de inmediato para no agotar el límite de contextos del navegador
    const loseExt = gl.getExtension('WEBGL_lose_context');
    if (loseExt) {
      loseExt.loseContext();
    }

    cachedSupport = true;
    return true;
  } catch {
    cachedSupport = false;
    return false;
  }
}

/** Devuelve la preferencia guardada por el usuario o 'auto'. */
export function getGraphicsPreference(): GraphicsMode {
  if (typeof localStorage === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '2d' || saved === '3d' || saved === 'auto') return saved;
  } catch {
    /* localStorage bloqueado */
  }
  return 'auto';
}

/** Guarda la preferencia manual de gráficos (2D ligero o 3D). */
export function setGraphicsPreference(mode: GraphicsMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignorar */
  }
}

/**
 * Determina si la aplicación debe renderizar escenas 3D pesadas (Three.js).
 * Retorna false si no hay WebGL, si se forzó modo 2D o si la red pide ahorro de datos.
 */
export function canRender3D(): boolean {
  const pref = getGraphicsPreference();
  if (pref === '2d') return false;
  if (pref === '3d') return isWebGLAvailable();

  // Modo auto:
  if (!isWebGLAvailable()) return false;

  // Red de datos lenta o ahorro de datos
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData) return false;
  if (c?.effectiveType && ['slow-2g', '2g', '3g'].includes(c.effectiveType)) return false;

  return true;
}
