import { useEffect } from 'react';

/**
 * Mantiene la pantalla encendida mientras la cabina está activa (Screen Wake Lock API).
 * El sistema lo suelta al cambiar de pestaña: se vuelve a pedir al regresar.
 * En el APK lo hace el plugin nativo; esto cubre la web.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* sin permiso o batería baja: se vive sin él */
      }
      if (cancelled) void lock?.release();
    };
    const onVisible = () => document.visibilityState === 'visible' && void request();
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
