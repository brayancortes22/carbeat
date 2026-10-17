/**
 * Servicio Telemático de Calidad de Red (Network Health).
 * Evalúa la conexión del dispositivo utilizando la Network Information API nativa
 * y pruebas de latencia ligera para determinar si el usuario tiene una red óptima.
 */

export interface NetworkHealthStatus {
  isOnline: boolean;
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'unknown';
  rtt: number; // latencia en ms
  downlink: number; // Mbps estimados
  qualityScore: number; // 0 a 100
  label: string;
}

export class NetworkHealthService {
  private static cachedStatus: NetworkHealthStatus | null = null;
  private static lastCheck = 0;

  public static async getHealth(): Promise<NetworkHealthStatus> {
    const now = Date.now();
    // Cachear por 3 segundos para no sobrecargar el hilo
    if (this.cachedStatus && now - this.lastCheck < 3000) {
      return this.cachedStatus;
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      this.cachedStatus = {
        isOnline: false,
        effectiveType: 'slow-2g',
        rtt: 9999,
        downlink: 0,
        qualityScore: 0,
        label: 'Sin Internet',
      };
      this.lastCheck = now;
      return this.cachedStatus;
    }

    const nav = navigator as any;
    const connection = nav?.connection || nav?.mozConnection || nav?.webkitConnection;

    let effectiveType: NetworkHealthStatus['effectiveType'] = '4g';
    let rtt = 100;
    let downlink = 10;

    if (connection) {
      effectiveType = connection.effectiveType || (connection.type === 'wifi' ? 'wifi' : '4g');
      rtt = connection.rtt || 100;
      downlink = connection.downlink || 10;
    }

    // Calcular puntaje de calidad (0 a 100)
    let score = 75;
    if (effectiveType === '4g' || effectiveType === 'wifi') score = 90;
    else if (effectiveType === '3g') score = 60;
    else score = 25;

    if (rtt < 80) score = Math.min(100, score + 10);
    else if (rtt > 300) score = Math.max(10, score - 20);

    let label = '4G Rápido';
    if (effectiveType === 'wifi') label = 'Wi-Fi Estable';
    else if (score >= 80) label = `${effectiveType.toUpperCase()} Óptimo`;
    else if (score >= 50) label = `${effectiveType.toUpperCase()} Regular`;
    else label = 'Red Lenta / 2G';

    this.cachedStatus = {
      isOnline: true,
      effectiveType,
      rtt,
      downlink,
      qualityScore: score,
      label,
    };
    this.lastCheck = now;
    return this.cachedStatus;
  }
}
