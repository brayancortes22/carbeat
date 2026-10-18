/**
 * Dónde está la API de CarBeat según desde dónde se abra la interfaz:
 * - Web en Vercel o Vite: misma origen (URLs relativas).
 * - App Android (Capacitor sirve desde https://localhost): la web publicada.
 * Se puede forzar con VITE_API_ORIGIN (por ejemplo para probar el APK contra un servidor LAN).
 */
export const PROD_ORIGIN: string = import.meta.env.VITE_API_ORIGIN || 'https://carbeat-pi.vercel.app';

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  if (import.meta.env.VITE_API_ORIGIN) return import.meta.env.VITE_API_ORIGIN;
  if (isNativeApp()) return PROD_ORIGIN;
  return '';
}

export function apiUrl(path: string): string {
  return `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Origen para los enlaces y QR que se comparten con los pasajeros. */
export function getWebOrigin(): string {
  if (typeof window === 'undefined' || isNativeApp()) return PROD_ORIGIN;
  return window.location.origin;
}

/**
 * El relé WebSocket sólo existe en desarrollo y en el servidor de red local (http:).
 * En Vercel (https) no hay WebSocket propio: ahí van P2P + HTTP.
 */
export function getRoomWsUrl(): string | null {
  if (typeof window === 'undefined' || isNativeApp()) return null;
  if (window.location.protocol !== 'http:') return null;
  return `ws://${window.location.host}/ws-room`;
}
