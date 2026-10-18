import type { CSSProperties } from 'react';

/**
 * Estilo de un tornillo de placa (.plate-screw). Con Object.assign porque un literal con la
 * variable CSS --screw-angle no pasa la comprobación de propiedades de CSSProperties.
 */
export function screwStyle(pos: { left?: number; right?: number }, size: number, angle: string): CSSProperties {
  return Object.assign({ width: size, height: size, marginTop: -size / 2 }, pos, { '--screw-angle': angle });
}
