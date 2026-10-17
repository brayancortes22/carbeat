export default async function handler(_req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  return res.status(200).json({
    version: '1.4.0',
    buildDate: '2026-10-17',
    latestApk: '/downloads/carbeat-latest.apk',
    features: [
      'Búsqueda en la Nube Reparada: Conexión híbrida Vercel API + OmniRoute fallback en móvil',
      'Envío Instantáneo de Canciones: Eliminados los lags artificiales para transmisión en <50ms',
      'Música Local del Celular: Permite al DJ subir MP3s descargados en su teléfono al carro',
      'Barra de Búsqueda Móvil: Teclado semántico, auto-corrección off y botón limpiar rápido',
      'Blindaje de Votos 1-por-DJ y Pre-Caché en Cola Anti-Congelamiento',
    ],
  });
}
