export default async function handler(_req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  return res.status(200).json({
    version: '1.5.1',
    buildDate: '2026-10-17',
    latestApk: '/downloads/carbeat-latest.apk',
    features: [
      'Watchdog de Auto-Transición de Fin de Pista (sin pausas ni congelamientos al acabar canciones de YouTube o locales)',
      'Botón Táctil Ergonómico "Guardar en Mi Música" directo en la pantalla del vehículo para conducción segura',
      'Auto-Detección y Vigilancia Persistente de Carpeta de Música del Chofer (File System Watcher)',
      'Búsqueda en la Nube DJ Reparada con endpoint apiUrl y fallback OmniRoute',
      'Envío Instantáneo de canciones (<50ms) y carga de MP3s desde el celular del pasajero',
    ],
  });
}
