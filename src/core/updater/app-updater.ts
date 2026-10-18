import { CARBEAT_VERSION } from '../version';
import { apiUrl, getApiBaseUrl, isNativeApp } from '../network/api-config';

export interface RemoteVersionInfo {
  version: string;
  buildDate: string;
  latestApk: string;
  features: string[];
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  apkUrl: string;
  features: string[];
}

export class AppUpdaterService {
  private static cachedResult: UpdateCheckResult | null = null;
  private static lastCheckTime = 0;

  /**
   * Compara dos versiones semánticas (ej: '1.2.1' vs '1.2.0')
   * Retorna > 0 si v1 > v2, < 0 si v1 < v2, 0 si son iguales
   */
  public static compareSemver(v1: string, v2: string): number {
    const parts1 = v1.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = v2.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  /**
   * Consulta el endpoint /api/version en la nube para verificar si hay una versión superior
   */
  public static async checkForUpdates(force = false): Promise<UpdateCheckResult> {
    const now = Date.now();
    if (!force && this.cachedResult && now - this.lastCheckTime < 60000) {
      return this.cachedResult;
    }

    try {
      const res = await fetch(apiUrl('/api/version'), {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RemoteVersionInfo;

      const hasUpdate = this.compareSemver(data.version, CARBEAT_VERSION) > 0;
      const apkFullUrl = data.latestApk.startsWith('http')
        ? data.latestApk
        : `${getApiBaseUrl()}${data.latestApk.startsWith('/') ? '' : '/'}${data.latestApk}`;

      this.cachedResult = {
        hasUpdate,
        currentVersion: CARBEAT_VERSION,
        latestVersion: data.version,
        apkUrl: apkFullUrl,
        features: data.features || [],
      };
      this.lastCheckTime = now;
      return this.cachedResult;
    } catch {
      return {
        hasUpdate: false,
        currentVersion: CARBEAT_VERSION,
        latestVersion: CARBEAT_VERSION,
        apkUrl: 'https://carbeat-pi.vercel.app/downloads/carbeat-latest.apk',
        features: [],
      };
    }
  }

  /**
   * Inicia la descarga directa de la APK y delega la instalación
   */
  public static triggerApkDownload(apkUrl: string): void {
    if (typeof window === 'undefined') return;
    // En el APK el WebView no gestiona descargas: navegar a una URL externa hace que
    // Capacitor la abra en el navegador del sistema, que sí descarga e instala.
    if (isNativeApp()) {
      window.location.assign(apkUrl);
      return;
    }
    const a = document.createElement('a');
    a.href = apkUrl;
    a.download = 'carbeat-latest.apk';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
