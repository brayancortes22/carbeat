import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { bendX, damp, smooth, type DriveState } from './shared';

/*
 * Cámara guiada por capítulos. Cada capítulo tiene un encuadre (posición, punto de mira, FOV y
 * alabeo) en coordenadas del carro; entre capítulos se interpola con curva suave. El paso del
 * cuadro a la vista exterior es una Bézier que sube por el techo: un plano continuo, sin corte.
 *
 *   0 cabina · 1 cuadro (placa) · 2 persecución (pasajeros) · 3 autopista (votos)
 */

type V3 = [number, number, number];
type Key = { p: V3; l: V3; fov: number; roll: number };
type Path = { keys: Key[]; rise: V3; crane: V3 };

// Horizontal: el texto va a un lado y el sujeto al otro (cap. 1 y 3 texto a la derecha).
const WIDE: Path = {
  keys: [
    { p: [-0.08, 1.18, 0.32], l: [0.04, 0.98, -12], fov: 56, roll: 0 },
    { p: [-0.33, 0.99, -0.29], l: [-0.255, 0.948, -0.6], fov: 50, roll: -0.02 },
    { p: [3.1, 2.25, 7.4], l: [-2.4, 1.0, -2.2], fov: 44, roll: 0.012 },
    { p: [7.5, 10, 16], l: [-6, 0, -34], fov: 52, roll: 0 },
  ],
  rise: [-0.2, 2.05, 0.75],
  crane: [7, 3.6, 14],
};

// Vertical (celular): el sujeto arriba, la tarjeta abajo.
const TALL: Path = {
  keys: [
    { p: [-0.36, 1.18, 0.34], l: [-0.26, 0.98, -12], fov: 74, roll: 0 },
    { p: [-0.36, 0.995, -0.25], l: [-0.36, 0.81, -0.64], fov: 70, roll: 0 },
    // En vertical la cámara mira a un punto ANTES del carro: así el carro queda en la mitad
    // de arriba y la tarjeta no lo tapa.
    { p: [1.8, 3.4, 12], l: [0.0, -1.5, 3], fov: 62, roll: 0 },
    { p: [2.0, 9.0, 26], l: [0.0, -3.0, 6], fov: 66, roll: 0 },
  ],
  rise: [-0.25, 2.1, 0.8],
  crane: [2.5, 4.5, 20],
};

const ease = (x: number) => x * x * x * (x * (x * 6 - 15) + 10); // smootherstep

function lerp3(out: THREE.Vector3, a: V3, b: V3, t: number) {
  return out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}
function bezier3(out: THREE.Vector3, a: V3, c: V3, b: V3, t: number) {
  const u = 1 - t;
  return out.set(u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]);
}

export function Rig({ drive, carX, calm }: { drive: DriveState; carX: number; calm: boolean }) {
  const { camera, size } = useThree();
  const persp = camera as THREE.PerspectiveCamera;
  const tall = size.width / size.height < 0.9;
  const path = tall ? TALL : WIDE;
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });

  useEffect(() => {
    drive.tall = tall;
  }, [drive, tall]);

  // El lienzo queda detrás del HTML: el puntero se lee en la ventana, sólo con ratón.
  useEffect(() => {
    if (calm) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [calm]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const ch = Math.min(3, Math.max(0, drive.chapter));
    const i = Math.min(2, Math.floor(ch));
    const e = ease(ch - i);
    const a = path.keys[i];
    const b = path.keys[i + 1];
    if (i === 1) {
      // Del cuadro a la persecución: subir por dentro y salir por el techo.
      bezier3(pos, a.p, path.rise, b.p, e);
    } else if (i === 2) {
      // Grúa: se eleva en arco hasta abrir la autopista.
      bezier3(pos, a.p, path.crane, b.p, e);
    } else {
      lerp3(pos, a.p, b.p, e);
    }
    lerp3(look, a.l, b.l, e);
    const fov = a.fov + (b.fov - a.fov) * e;
    const roll = a.roll + (b.roll - a.roll) * e;

    const t = drive.t;
    const inside = 1 - smooth(1.15, 1.45, ch);
    const out = 1 - inside;
    // Dentro: vibración de carretera; fuera: deriva lenta de cámara en mano.
    if (!calm) {
      pos.y += inside * (Math.sin(t * 7.3) * 0.0022 + Math.sin(t * 1.1) * 0.0035);
      pos.x += out * Math.sin(t * 0.21) * 0.22;
      pos.y += out * Math.sin(t * 0.17 + 1) * 0.12;
      const p = pointer.current;
      p.sx = damp(p.sx, p.x, 2.5, dt);
      p.sy = damp(p.sy, p.y, 2.5, dt);
      const amt = inside * 0.018 * (1 - smooth(0.4, 1, ch)) + out * 0.45;
      pos.x += p.sx * amt;
      pos.y -= p.sy * amt * 0.5;
    }
    // Mirar hacia dentro de la curva, como hace un conductor.
    look.x += bendX(drive.curve, -45) * 0.32 * (1 - smooth(0.2, 0.9, ch));

    camera.position.set(pos.x + carX, pos.y, pos.z);
    camera.lookAt(look.x + carX, look.y, look.z);
    if (roll) camera.rotateZ(roll);
    if (Math.abs(persp.fov - fov) > 0.01) {
      persp.fov = fov;
      persp.updateProjectionMatrix();
    }
  }, -0.5); // después del director (−1) y antes que el carro: los celulares miran a la cámara de ESTE fotograma
  return null;
}
