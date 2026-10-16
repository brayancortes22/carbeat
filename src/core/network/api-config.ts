/**
 * Configuración dinámica de endpoints de red para CarBeat
 * Compatible con:
 * - Desarrollo Local (Vite dev server en localhost:5173 / ws 5174)
 * - Navegador Web en Producción (https://carbeat-pi.vercel.app)
 * - Aplicación Nativa Android / Tablet (Capacitor WebView)
 */
export const PROD_ORIGIN = 'https://carbeat-pi.vercel.app';

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  const { hostname, port, protocol } = window.location;
  const isDevVite = (hostname === 'localhost' || hostname === '127.0.0.1') && port === '5173';

  // Si estamos dentro de la APK de Android (Capacitor usa capacitor:// o https://localhost sin puerto 5173)
  if (protocol === 'capacitor:' || (!isDevVite && (hostname === 'localhost' || hostname === '127.0.0.1'))) {
    return PROD_ORIGIN;
  }

  // En la web de producción o Vite dev server, usar URLs relativas estándar
  return '';
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
