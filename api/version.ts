export default async function handler(_req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  return res.status(200).json({
    version: '1.2.0',
    buildDate: '2026-10-16',
    latestApk: '/downloads/carbeat-latest.apk',
    features: [
      'Doble flujo: Música del Chofer vs Peticiones de Pasajeros',
      'Cierre de Sala con detención de audio y expulsión en vivo',
      'Biblioteca del Conductor y Purga de un Tacazo',
      'Autopilot IA (DJ Autónomo de 1 en 1)',
      'Auto-actualización dinámica de versión en caliente',
    ],
  });
}
