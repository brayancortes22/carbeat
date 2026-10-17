export default async function handler(_req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  return res.status(200).json({
    version: '1.5.0',
    buildDate: '2026-10-17',
    latestApk: '/downloads/carbeat-latest.apk',
    features: [
      'Auto-Detección de Carpeta de Música: Vigilancia en segundo plano de nuevas descargas en la tablet/USB',
      'Persistencia de Directorio: Guarda el handle en IndexedDB y restaura el escaneo sin intervención',
      'Búsqueda en la Nube DJ Reparada con endpoint apiUrl y fallback OmniRoute',
      'Envío Instantáneo de canciones (<50ms) y carga de MP3s desde el celular del pasajero',
    ],
  });
}
