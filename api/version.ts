export default async function handler(_req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  return res.status(200).json({
    version: '1.2.1',
    buildDate: '2026-10-16',
    latestApk: '/downloads/carbeat-latest.apk',
    features: [
      'Conexión Ultra Rápida con caché L1 en caliente (<50ms)',
      'Sondeo acelerado en cabina (700ms) con sincronización reactiva',
      'Auto-actualizador autónomo con modal de instalación rápida',
      'Autopilot DJ con IA y Cola compartida en vivo',
    ],
  });
}
