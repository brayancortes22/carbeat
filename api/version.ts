export default async function handler(_req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  return res.status(200).json({
    version: '1.3.0',
    buildDate: '2026-10-16',
    latestApk: '/downloads/carbeat-latest.apk',
    features: [
      'Blindaje Estricto de Votación: 1 solo voto por DJ/Dispositivo por canción',
      'Pre-Caché en Cola en Segundo Plano (cero congelamientos al pasar a streaming)',
      'Separación clara de Carpetas: Música Local del Carro vs Aportadas por Pasajeros',
      'Selector de Origen de Datos: Pantalla del Carro vs Celular del Pasajero',
      'Interfaz 100% Responsiva adaptada a pantallas de carro (1024x600) y móviles',
    ],
  });
}
