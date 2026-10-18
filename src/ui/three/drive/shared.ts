import * as THREE from 'three';

/*
 * Piezas comunes de la escena de portada (NightDrive). Todo lo que cambia cada fotograma vive
 * en un objeto mutable (DriveState) y en uniforms compartidos: así el scroll mueve la escena
 * sin un solo re-render de React.
 */

export const CYAN = new THREE.Color('#22d3ee');
export const ICE = new THREE.Color('#cffafe');
export const NEEDLE = new THREE.Color('#ff5a36');
export const TAIL = new THREE.Color('#ff1f3d');
export const DARK = '#05080b';

/** Carril interior derecho: en Colombia se conduce por la derecha y el carro va junto a la línea central. */
export const LANE_X = 1.35;
export const ROAD_HALF = 5.4;
/** La carretera sigue 40 m por detrás del carro: la cámara de persecución la necesita. */
export const ROAD_NEAR = 40;
export const ROAD_FAR = 260;
export const ROAD_LEN = ROAD_NEAR + ROAD_FAR;

export type DriveState = {
  /** Reloj de la escena (se congela con movimiento reducido). */
  t: number;
  /** Metros recorridos por el carro. */
  dist: number;
  /** m/s; sube en el último capítulo para que las estelas se alarguen. */
  speed: number;
  /** Curvatura de la carretera: x = curve·z². Cerca del carro (z≈0) siempre es recta. */
  curve: number;
  /** Capítulo amortiguado, 0..3 (cabina, cuadro, persecución, autopista). */
  chapter: number;
  /** 0..1: intensidad de los "votos" (pulsos de los haces). */
  vote: number;
  /** 0..1: exposición larga de las luces de los otros carros. */
  trails: number;
  /** Diseño vertical (celular): otros encuadres de cámara. */
  tall: boolean;
};

export function makeDrive(): DriveState {
  return { t: 0, dist: 0, speed: 19, curve: 0, chapter: 0, vote: 0, trails: 0, tall: false };
}

/** Uniforms compartidos por todos los shaders propios: se actualizan una vez por fotograma. */
export type SharedUniforms = {
  uTime: { value: number };
  uTravel: { value: number };
  uSpeed: { value: number };
  uCurve: { value: number };
  uTrail: { value: number };
  uVote: { value: number };
  /** 0 en la cabina → 1 en las vistas exteriores (capítulos 2 y 3). */
  uExterior: { value: number };
};

export function makeUniforms(): SharedUniforms {
  return {
    uTime: { value: 0 },
    uTravel: { value: 0 },
    uSpeed: { value: 19 },
    uCurve: { value: 0 },
    uTrail: { value: 0 },
    uVote: { value: 0 },
    uExterior: { value: 0 },
  };
}

export const bendX = (curve: number, z: number) => curve * z * z;
export const bendSlope = (curve: number, z: number) => 2 * curve * z;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Amortiguación independiente de los FPS (a 60 o a 165 Hz se mueve igual). */
export const damp = (cur: number, target: number, lambda: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

/** La misma curva que bendX, para los shaders. */
export const GLSL_BEND = /* glsl */ `
  uniform float uCurve;
  float bendX(float z) { return uCurve * z * z; }
  float bendSlope(float z) { return 2.0 * uCurve * z; }
`;

/** Textura de brillo radial (para charcos de luz y halos) dibujada una vez en canvas. */
export function radialTexture(size = 128, stops: [number, string][] = [
  [0, 'rgba(255,255,255,1)'],
  [0.35, 'rgba(255,255,255,0.45)'],
  [1, 'rgba(255,255,255,0)'],
]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Degradado lineal a lo largo de V (1 arriba → 0 abajo): reflejos alargados en el asfalto mojado. */
export function streakTexture(): THREE.CanvasTexture {
  const w = 32;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  for (let x = 0; x < w; x++) {
    const across = 1 - Math.abs((x + 0.5) / w - 0.5) * 2;
    const grad = g.createLinearGradient(0, 0, 0, h);
    const a = Math.pow(across, 1.6);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.25, `rgba(255,255,255,${a * 0.55})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x, 0, 1, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Escribe directamente la matriz de una instancia: posición + giro en Y. Evita
 * Object3D.updateMatrix (compone cuaterniones) en bucles de cientos de instancias por fotograma.
 */
export function setInstance(arr: ArrayLike<number> & { [i: number]: number }, i: number, x: number, y: number, z: number, yaw = 0, sx = 1, sy = 1, sz = 1) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const o = i * 16;
  arr[o] = c * sx;
  arr[o + 1] = 0;
  arr[o + 2] = -s * sx;
  arr[o + 3] = 0;
  arr[o + 4] = 0;
  arr[o + 5] = sy;
  arr[o + 6] = 0;
  arr[o + 7] = 0;
  arr[o + 8] = s * sz;
  arr[o + 9] = 0;
  arr[o + 10] = c * sz;
  arr[o + 11] = 0;
  arr[o + 12] = x;
  arr[o + 13] = y;
  arr[o + 14] = z;
  arr[o + 15] = 1;
}
