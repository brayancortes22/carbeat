import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * «Autopista de la cola»: la cola de canciones es la carretera que tienes delante.
 * Cada una de las próximas canciones es un letrero de pórtico colgado sobre la autopista;
 * cuando empieza la siguiente, su letrero pasa por encima de la cámara y los demás avanzan.
 *
 * Por qué una curva: con la carretera recta los letreros se tapan unos a otros (están todos
 * sobre el eje de la vía). En una curva amplia a la derecha cada pórtico queda un poco más a
 * la derecha y más abajo que el anterior, y los tres se leen a la vez, como en la vida real.
 * Además la vía baja hacia un valle: los pórticos lejanos quedan más abajo en la imagen y no
 * los tapa el primero, y se ve más asfalto (que es lo que da la sensación de avanzar).
 * La curva es un arco de radio constante: así la vista es estable aunque «avancemos» y la
 * cámara no tiene que girar nunca.
 *
 * Rendimiento: todo es MeshBasicMaterial (sin luces que calcular) e InstancedMesh para lo que
 * se repite (rayas, postes, farolas, reflectores); los brillos son planos aditivos con una
 * textura de degradado, no posprocesado. Se detiene fuera de pantalla (frameloop).
 */

export interface HighwaySign {
  /** queueId de la entrada, o 'vacia' para el letrero de cola libre. */
  id: string;
  title: string;
  artist: string;
  /** Quién la pidió (no se usa en las del piloto automático). */
  by?: string;
  autopilot?: boolean;
  /** Llegada estimada ya formateada («EN 3 MIN»), calculada con duraciones reales. */
  eta?: string;
  empty?: boolean;
}

// ----------------------------------------------------------------- geometría de la vía

const R = 62; // radio de la curva, m
const LANE = 3.6;
const HALF = LANE * 1.5; // tres carriles
const CRUISE = 17; // m/s ≈ 60 km/h
const SLOTS = [14, 28, 46]; // distancia de cada pórtico a la cámara, m
const GRADE = 0.085; // pendiente de bajada (8,5 %)
const ENTER_AT = 88; // los letreros nuevos salen de la niebla
const LEAVE_BACK = 104;
const PASS_TO = -18; // detrás de la cámara

const tmp = new THREE.Vector3();

/** Cota de la vía: llana junto a la cámara y bajando después, sin quiebro (derivada continua). */
function elev(s: number): number {
  return -Math.sign(s) * GRADE * (Math.sqrt(s * s + 100) - 10);
}

/** Punto de la carretera a `s` metros por delante, desplazado `lat` a la derecha y a altura `y` sobre el asfalto. */
function along(s: number, lat = 0, y = 0, out = new THREE.Vector3()): THREE.Vector3 {
  const th = s / R;
  const c = Math.cos(th);
  const n = Math.sin(th);
  return out.set(R - R * c + lat * c, y + elev(s), -R * n + lat * n);
}

/** Cinta a lo largo de la curva entre dos desplazamientos laterales (o dos alturas). */
function ribbon(from: number, to: number, step: number, a: [number, number], b: [number, number]): THREE.BufferGeometry {
  const n = Math.ceil((to - from) / step) + 1;
  const pos = new Float32Array(n * 6);
  const uv = new Float32Array(n * 4);
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = from + i * step;
    along(s, a[0], a[1], tmp).toArray(pos, i * 6);
    along(s, b[0], b[1], tmp).toArray(pos, i * 6 + 3);
    uv.set([0, i / (n - 1), 1, i / (n - 1)], i * 4);
    if (i < n - 1) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const mod = (x: number, m: number) => ((x % m) + m) % m;

// La cámara no se mueve (sólo vibra): el fondo y los montes se colocan una vez respecto a ella.
// Mira un poco a la derecha (hacia donde gira la curva) y un poco arriba (a los pórticos).
const CAM = along(-1.5, 0.3, 1.35);
const YAW = 0.16;
const PITCH = 0.052;
const LOOK = CAM.clone().add(new THREE.Vector3(Math.sin(YAW) * Math.cos(PITCH), Math.sin(PITCH), -Math.cos(YAW) * Math.cos(PITCH)).multiplyScalar(40));

// ----------------------------------------------------------------- texturas procedurales

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ----------------------------------------------------------------- letreros

const SIGN_W = 1024;
const SIGN_H = 312;
const SLOT_LABEL = ['SIGUIENTE', 'DESPUÉS', 'MÁS ADELANTE'];
const FONT = '"Anybody Variable", "Arial Narrow", sans-serif';
const CRUISE_PATHS = ['M5.2 16.5A8 8 0 1 1 18.8 16.5', 'M12 12l3.5-3', 'M16.5 18.5h4m-2-2v4'];

type Ctx = CanvasRenderingContext2D;
// El ancho va DENTRO del atajo `font` (medido: asignar fontStretch y después font lo devuelve a
// «normal», y el letrero salía siempre con el ancho normal de Anybody).
// Hasta «extra-condensed» (62,5 %): más estrecha ya no se lee a distancia; a partir de ahí se
// reduce el tamaño.
const STRETCHES = ['normal', 'semi-condensed', 'condensed', 'extra-condensed'] as const;
type Stretch = (typeof STRETCHES)[number] | 'semi-expanded' | 'expanded';

function setFont(g: Ctx, stretch: Stretch, weight: number, px: number) {
  g.font = `${stretch} ${weight} ${px}px ${FONT}`;
}

/** Ajusta el texto al ancho: primero estrecha la letra (eje wdth de Anybody), luego la achica y al final corta. */
function fit(g: Ctx, text: string, maxW: number, weight: number, size: number, minSize: number): string {
  for (const st of STRETCHES) {
    setFont(g, st, weight, size);
    if (g.measureText(text).width <= maxW) return text;
  }
  for (let px = size - 4; px >= minSize; px -= 4) {
    setFont(g, 'extra-condensed', weight, px);
    if (g.measureText(text).width <= maxW) return text;
  }
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawSign(c: HTMLCanvasElement, d: HighwaySign, slot: number) {
  const g = c.getContext('2d') as Ctx;
  g.clearRect(0, 0, SIGN_W, SIGN_H);
  const green = !!d.autopilot;
  // Fondo: azul petróleo para lo que pidió alguien; verde de autopista (como el testigo de
  // crucero) para lo que eligió el piloto automático.
  const grd = g.createLinearGradient(0, 0, 0, SIGN_H);
  if (d.empty) {
    grd.addColorStop(0, '#0c1d26');
    grd.addColorStop(1, '#061017');
  } else if (green) {
    grd.addColorStop(0, '#0f6046');
    grd.addColorStop(1, '#073a2a');
  } else {
    grd.addColorStop(0, '#0d4a5c');
    grd.addColorStop(1, '#062b37');
  }
  roundRect(g, 3, 3, SIGN_W - 6, SIGN_H - 6, 28);
  g.fillStyle = grd;
  g.fill();
  // Borde retrorreflectante, como el de los letreros de verdad.
  g.lineWidth = 7;
  g.strokeStyle = d.empty ? 'rgba(103,232,249,0.65)' : 'rgba(240,253,255,0.95)';
  roundRect(g, 18, 18, SIGN_W - 36, SIGN_H - 36, 18);
  g.stroke();

  const accent = d.empty ? '#67e8f9' : green ? '#8ef5c9' : '#7deefc';
  const pad = 52;
  g.textBaseline = 'alphabetic';
  g.letterSpacing = '6px';

  // Icono de crucero delante del rótulo en las del piloto automático.
  let x = pad;
  if (green && !d.empty) {
    g.save();
    g.translate(pad - 4, 38);
    g.scale(2.1, 2.1);
    g.strokeStyle = accent;
    g.lineWidth = 2;
    g.lineCap = 'round';
    for (const p of CRUISE_PATHS) g.stroke(new Path2D(p));
    g.restore();
    x += 60;
  }
  // Fila superior: posición en la cola y quién la pidió a la izquierda; llegada a la derecha.
  let etaW = 0;
  setFont(g, 'semi-expanded', 700, 40);
  if (d.eta && !d.empty) {
    etaW = g.measureText(d.eta).width + 36;
    g.textAlign = 'right';
    g.fillStyle = '#f0fdff';
    g.fillText(d.eta, SIGN_W - pad, 86);
    g.textAlign = 'left';
  }
  const slotLabel = SLOT_LABEL[slot] ?? '';
  const who = d.empty ? 'AUTOPISTA DE LA COLA' : green ? `${slotLabel} · PILOTO AUTOMÁTICO` : d.by ? `${slotLabel} · PIDIÓ ${d.by.toUpperCase()}` : slotLabel;
  g.fillStyle = accent;
  g.letterSpacing = '5px';
  setFont(g, 'semi-expanded', 700, 40);
  const room = SIGN_W - pad - x - etaW;
  // Ancha si cabe (rótulo de autopista); si no, se estrecha antes de cortar.
  const label = g.measureText(who).width <= room ? who : fit(g, who, room, 700, 40, 30);
  g.fillText(label, x, 86);

  // Título: lo más grande que quepa.
  g.letterSpacing = '0px';
  g.fillStyle = '#f5feff';
  const title = fit(g, (d.empty ? 'COLA LIBRE' : d.title).toUpperCase(), SIGN_W - pad * 2, 800, 108, 72);
  g.fillText(title, pad, 196);

  // Línea inferior: artista.
  g.letterSpacing = '2px';
  g.fillStyle = d.empty ? '#a5e9f3' : green ? '#c4f5df' : '#b6eef7';
  const sub = d.empty ? 'PIDE DESDE TU CELULAR' : d.artist;
  const subFit = fit(g, sub.toUpperCase(), SIGN_W - pad * 2, 600, 48, 34);
  g.fillText(subFit, pad, 266);
}

interface SignObj {
  id: string;
  group: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  tex: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  s: number;
  v: number;
  target: number;
  slot: number;
  leave: 'front' | 'back' | null;
  drawn: string;
  data: HighwaySign;
}

interface Shared {
  /** Postes, celosía y colgadores del pórtico fundidos en una sola malla (una llamada de dibujo). */
  frame: THREE.BufferGeometry;
  panel: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
  lampBar: THREE.BufferGeometry;
  halo: THREE.BufferGeometry;
  struct: THREE.MeshBasicMaterial;
  backMat: THREE.MeshBasicMaterial;
  lamp: THREE.MeshBasicMaterial;
  haloCyan: THREE.MeshBasicMaterial;
  haloGreen: THREE.MeshBasicMaterial;
}

const SPAN = HALF + 1.6; // los postes quedan fuera del arcén
const SIGN_X = 0.9; // el letrero cuelga sobre los carriles centrales y derecho
const SIGN_Y = 5.0;
const PANEL_W = 8.2;
const PANEL_H = PANEL_W * (SIGN_H / SIGN_W);

/** Pórtico de celosía: dos postes, dos cordones (delante y detrás) con montantes y diagonales. */
function gantryFrame(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, rotZ = 0) => parts.push(new THREE.BoxGeometry(w, h, d).rotateZ(rotZ).translate(x, y, z));
  const lo = 6.4;
  const hi = 7.0;
  for (const side of [-1, 1]) {
    box(0.36, 7.7, 0.36, side * SPAN, 3.85, 0);
    box(0.5, 0.12, 0.9, side * SPAN, 0.06, 0); // zapata
  }
  for (const z of [-0.32, 0.32]) {
    box(SPAN * 2 + 0.4, 0.16, 0.16, 0, hi, z);
    box(SPAN * 2 + 0.4, 0.16, 0.16, 0, lo, z);
    const n = 10;
    const step = (SPAN * 2) / n;
    for (let i = 0; i <= n; i++) {
      const x = -SPAN + i * step;
      box(0.07, hi - lo, 0.07, x, (hi + lo) / 2, z);
      if (i < n) {
        const dx = step;
        const dy = hi - lo;
        const dir = i % 2 ? 1 : -1;
        box(Math.hypot(dx, dy), 0.06, 0.06, x + dx / 2, (hi + lo) / 2, z, dir * Math.atan2(dy, dx));
      }
    }
  }
  for (const hx of [-PANEL_W * 0.32, PANEL_W * 0.32]) box(0.08, lo - (SIGN_Y + PANEL_H / 2) + 0.05, 0.08, SIGN_X + hx, (lo + SIGN_Y + PANEL_H / 2) / 2, 0.05);
  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  parts.forEach((g) => g.dispose());
  return merged;
}

function makeShared(glow: THREE.Texture): Shared {
  const additive = (color: string, opacity: number) =>
    new THREE.MeshBasicMaterial({ map: glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  return {
    frame: gantryFrame(),
    panel: new THREE.PlaneGeometry(PANEL_W, PANEL_H),
    back: new THREE.BoxGeometry(PANEL_W + 0.16, PANEL_H + 0.16, 0.1),
    lampBar: new THREE.BoxGeometry(PANEL_W * 0.8, 0.07, 0.22),
    halo: new THREE.PlaneGeometry(PANEL_W * 1.9, PANEL_H * 2.6),
    struct: new THREE.MeshBasicMaterial({ color: '#1a2731' }),
    backMat: new THREE.MeshBasicMaterial({ color: '#0b1218' }),
    lamp: new THREE.MeshBasicMaterial({ color: '#dffbff', toneMapped: false }),
    haloCyan: additive('#22d3ee', 0.22),
    haloGreen: additive('#34d399', 0.2),
  };
}

function buildSign(d: HighwaySign, sh: Shared, anisotropy: number): SignObj {
  const canvas = document.createElement('canvas');
  canvas.width = SIGN_W;
  canvas.height = SIGN_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const group = new THREE.Group();

  group.add(new THREE.Mesh(sh.frame, sh.struct));
  const halo = new THREE.Mesh(sh.halo, d.autopilot ? sh.haloGreen : sh.haloCyan);
  halo.position.set(SIGN_X, SIGN_Y, 0.02);
  group.add(halo);
  const back = new THREE.Mesh(sh.back, sh.backMat);
  back.position.set(SIGN_X, SIGN_Y, 0.08);
  group.add(back);
  const panel = new THREE.Mesh(sh.panel, mat);
  panel.position.set(SIGN_X, SIGN_Y, 0.14);
  group.add(panel);
  // Barra de luces que ilumina el letrero desde arriba.
  const lamp = new THREE.Mesh(sh.lampBar, sh.lamp);
  lamp.position.set(SIGN_X, SIGN_Y + PANEL_H / 2 + 0.16, 0.42);
  group.add(lamp);

  return { id: d.id, group, mat, tex, canvas, s: ENTER_AT, v: 0, target: ENTER_AT, slot: -1, leave: null, drawn: '', data: d };
}

function disposeSign(o: SignObj) {
  o.group.removeFromParent();
  o.tex.dispose();
  o.mat.dispose();
}

function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    // Sin esto el primer letrero se dibuja con la fuente de reserva: Anybody se carga perezosa.
    Promise.all([document.fonts.load(`800 100px ${FONT}`), document.fonts.load(`700 40px ${FONT}`)])
      .catch(() => undefined)
      .then(() => document.fonts.ready)
      .then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

function Signs({ signs, calm }: { signs: HighwaySign[]; calm: boolean }) {
  const root = useRef<THREE.Group>(null);
  const objs = useRef(new Map<string, SignObj>());
  const { gl, invalidate } = useThree();
  const glow = useMemo(() => glowTexture(), []);
  const sh = useMemo(() => makeShared(glow), [glow]);
  const fonts = useFontsReady();

  useEffect(
    () => () => {
      objs.current.forEach(disposeSign);
      objs.current.clear();
    },
    [],
  );
  useEffect(
    () => () => {
      for (const v of Object.values(sh)) v.dispose();
      glow.dispose();
    },
    [sh, glow],
  );

  useEffect(() => {
    const map = objs.current;
    const parent = root.current;
    if (!parent) return;
    const ids = new Set(signs.map((s) => s.id));
    for (const o of map.values()) {
      if (ids.has(o.id) || o.leave) continue;
      // La que se va desde el primer pórtico es la que empieza a sonar: pasa por encima.
      // Las demás (quitadas o desplazadas por votos) se pierden carretera adelante.
      o.leave = o.slot === 0 && !o.data.empty ? 'front' : 'back';
      o.target = o.leave === 'front' ? PASS_TO : LEAVE_BACK;
      o.v = 3;
      o.slot = -1;
    }
    signs.forEach((d, i) => {
      let o = map.get(d.id);
      if (o?.leave) {
        disposeSign(o);
        o = undefined;
      }
      if (!o) {
        o = buildSign(d, sh, Math.min(8, gl.capabilities.getMaxAnisotropy()));
        if (calm) o.s = SLOTS[i];
        map.set(d.id, o);
        parent.add(o.group);
      }
      o.data = d;
      o.slot = i;
      o.target = SLOTS[i];
      const key = `${i}|${d.title}|${d.artist}|${d.by ?? ''}|${d.eta ?? ''}|${d.autopilot ? 1 : 0}|${fonts ? 1 : 0}`;
      if (key !== o.drawn) {
        drawSign(o.canvas, d, i);
        o.tex.needsUpdate = true;
        o.drawn = key;
      }
    });
    invalidate();
  }, [signs, calm, fonts, sh, gl, invalidate]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    let removed = false;
    for (const o of objs.current.values()) {
      if (calm) o.s = o.target;
      else if (o.leave === 'front') {
        // Acelera al pasar por debajo, como cuando uno cruza bajo el pórtico.
        o.v += dt * 34;
        o.s = Math.max(o.target, o.s - o.v * dt);
      } else {
        o.s += (o.target - o.s) * (1 - Math.exp(-dt * (o.leave ? 1.4 : 2.1)));
      }
      if (o.leave && Math.abs(o.s - o.target) < 0.6) {
        disposeSign(o);
        objs.current.delete(o.id);
        removed = true;
        continue;
      }
      along(o.s, 0, 0, o.group.position);
      o.group.rotation.y = -o.s / R;
    }
    if (removed && calm) invalidate();
  });

  return <group ref={root} />;
}

// ----------------------------------------------------------------- la vía en movimiento

const DASH_P = 12;
const DASH_N = 10;
const POST_P = 9;
const POST_N = 13;
const LIGHT_P = 31;
const LIGHT_N = 4;

function Road({ moving, calm }: { moving: boolean; calm: boolean }) {
  const dashes = useRef<THREE.InstancedMesh>(null);
  const posts = useRef<THREE.InstancedMesh>(null);
  const refl = useRef<THREE.InstancedMesh>(null);
  const eyes = useRef<THREE.InstancedMesh>(null);
  const poles = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const glows = useRef<THREE.InstancedMesh>(null);
  const pools = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offset = useRef(0);
  const speed = useRef(moving && !calm ? CRUISE : 0);
  const glow = useMemo(() => glowTexture(), []);
  const { camera } = useThree();

  const geo = useMemo(() => {
    const road = ribbon(-16, 120, 1.5, [-HALF - 0.6, 0], [HALF + 0.6, 0]);
    const edgeL = ribbon(-16, 120, 1.5, [-HALF + 0.05, 0.012], [-HALF + 0.22, 0.012]);
    const edgeR = ribbon(-16, 120, 1.5, [HALF - 0.22, 0.012], [HALF - 0.05, 0.012]);
    const shoulderL = ribbon(-16, 120, 1.5, [-HALF - 9, -0.02], [-HALF - 0.6, -0.02]);
    const shoulderR = ribbon(-16, 120, 1.5, [HALF + 0.6, -0.02], [HALF + 9, -0.02]);
    const rail = ribbon(-16, 120, 1.5, [HALF + 1.15, 0.45], [HALF + 1.15, 0.85]);
    const railLine = ribbon(-16, 120, 1.5, [HALF + 1.1, 0.66], [HALF + 1.1, 0.71]);
    const dash = new THREE.PlaneGeometry(0.16, 3.2).rotateX(-Math.PI / 2);
    const post = new THREE.BoxGeometry(0.1, 0.95, 0.1).translate(0, 0.47, 0);
    const reflector = new THREE.PlaneGeometry(0.12, 0.16);
    const eye = new THREE.PlaneGeometry(0.14, 0.22).rotateX(-Math.PI / 2);
    const pole = new THREE.BoxGeometry(0.2, 9.5, 0.2).translate(0, 4.75, 0);
    const head = new THREE.BoxGeometry(3.4, 0.16, 0.5).translate(1.5, 9.4, 0);
    const glowPlane = new THREE.PlaneGeometry(2.6, 2.6);
    const pool = new THREE.PlaneGeometry(9, 14).rotateX(-Math.PI / 2);
    return { road, edgeL, edgeR, shoulderL, shoulderR, rail, railLine, dash, post, reflector, eye, pole, head, glowPlane, pool };
  }, []);

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      glow.dispose();
    },
    [geo, glow],
  );

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    // En pausa el carro se detiene: la carretera frena y arranca con suavidad, no de golpe.
    const want = moving && !calm ? CRUISE : 0;
    speed.current += (want - speed.current) * (1 - Math.exp(-dt * 1.3));
    offset.current += speed.current * dt;
    const o = offset.current;
    const put = (m: THREE.InstancedMesh | null, i: number, s: number, lat: number, y: number, face = false) => {
      if (!m) return;
      along(s, lat, y, dummy.position);
      if (face) dummy.lookAt(camera.position);
      else dummy.rotation.set(0, -s / R, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    };
    for (let i = 0; i < DASH_N; i++) {
      const s = mod(i * DASH_P - o, DASH_N * DASH_P) - 8;
      put(dashes.current, i * 2, s, -LANE / 2, 0.01);
      put(dashes.current, i * 2 + 1, s, LANE / 2, 0.01);
      put(eyes.current, i * 2, s + DASH_P / 2, -LANE / 2, 0.02);
      put(eyes.current, i * 2 + 1, s + DASH_P / 2, LANE / 2, 0.02);
    }
    for (let i = 0; i < POST_N; i++) {
      const s = mod(i * POST_P - o, POST_N * POST_P) - 6;
      put(posts.current, i * 2, s, -HALF - 1.0, 0);
      put(posts.current, i * 2 + 1, s + POST_P / 2, HALF + 1.6, 0);
      put(refl.current, i * 2, s, -HALF - 1.0, 0.82);
      put(refl.current, i * 2 + 1, s + POST_P / 2, HALF + 1.6, 0.82);
    }
    for (let i = 0; i < LIGHT_N; i++) {
      const s = mod(i * LIGHT_P - o, LIGHT_N * LIGHT_P) - 4;
      put(poles.current, i, s, -HALF - 2.4, 0);
      put(heads.current, i, s, -HALF - 2.4, 0);
      put(glows.current, i, s, -HALF + 0.4, 9.2, true);
      put(pools.current, i, s, -HALF + 1.8, 0.02);
    }
    for (const m of [dashes, eyes, posts, refl, poles, heads, glows, pools]) if (m.current) m.current.instanceMatrix.needsUpdate = true;
  });

  const add = (color: string, opacity: number) => ({ map: glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

  return (
    <group>
      <mesh geometry={geo.road}>
        <meshBasicMaterial color="#0e151b" />
      </mesh>
      <mesh geometry={geo.shoulderL}>
        <meshBasicMaterial color="#05090c" />
      </mesh>
      <mesh geometry={geo.shoulderR}>
        <meshBasicMaterial color="#05090c" />
      </mesh>
      <mesh geometry={geo.edgeL}>
        <meshBasicMaterial color="#9ff3ff" transparent opacity={0.7} toneMapped={false} />
      </mesh>
      <mesh geometry={geo.edgeR}>
        <meshBasicMaterial color="#9ff3ff" transparent opacity={0.7} toneMapped={false} />
      </mesh>
      <mesh geometry={geo.rail}>
        <meshBasicMaterial color="#141d24" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.railLine}>
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.55} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <instancedMesh ref={dashes} args={[geo.dash, undefined, DASH_N * 2]} frustumCulled={false}>
        <meshBasicMaterial color="#e6fbff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={eyes} args={[geo.eye, undefined, DASH_N * 2]} frustumCulled={false}>
        <meshBasicMaterial color="#7ff0ff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={posts} args={[geo.post, undefined, POST_N * 2]} frustumCulled={false}>
        <meshBasicMaterial color="#1b252d" />
      </instancedMesh>
      <instancedMesh ref={refl} args={[geo.reflector, undefined, POST_N * 2]} frustumCulled={false}>
        <meshBasicMaterial color="#c9f7ff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={poles} args={[geo.pole, undefined, LIGHT_N]} frustumCulled={false}>
        <meshBasicMaterial color="#16202a" />
      </instancedMesh>
      <instancedMesh ref={heads} args={[geo.head, undefined, LIGHT_N]} frustumCulled={false}>
        <meshBasicMaterial color="#1d2a35" />
      </instancedMesh>
      <instancedMesh ref={glows} args={[geo.glowPlane, undefined, LIGHT_N]} frustumCulled={false}>
        <meshBasicMaterial {...add('#bdf6ff', 0.95)} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[geo.pool, undefined, LIGHT_N]} frustumCulled={false}>
        <meshBasicMaterial {...add('#1f6f80', 0.55)} />
      </instancedMesh>
    </group>
  );
}

// ----------------------------------------------------------------- horizonte

/** Puntos fijos en el fondo (estrellas o luces del valle), con semilla para que no cambien. */
function scatter(n: number, seed: number, fn: (rnd: () => number) => [number, number, number]): THREE.BufferGeometry {
  let x = seed;
  const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set(fn(rnd), i * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

function Horizon() {
  const geo = useMemo(() => {
    const stars = scatter(240, 7, (r) => {
      const az = -1.3 + r() * 2.9;
      const el = 0.05 + Math.pow(r(), 1.5) * 0.55;
      return [Math.sin(az) * 400, Math.sin(el) * 400, -Math.cos(az) * 400];
    });
    // Ciudad en el fondo del valle: luces en racimos (barrios), bajo la línea del horizonte.
    const city = (seed: number, n: number, spread: number) => {
      let y = seed * 97;
      const r2 = () => (y = (y * 48271) % 2147483647) / 2147483647;
      const hubs = Array.from({ length: 9 }, () => ({ az: -0.5 + r2() * 1.8, d: 150 + r2() * 200, depth: 0.015 + r2() * 0.045 }));
      return scatter(n, seed, (r) => {
        const h = hubs[Math.floor(r() * hubs.length)];
        const az = h.az + (r() - 0.5) * spread;
        const d = h.d + (r() - 0.5) * 60;
        const depth = Math.max(0.008, h.depth + (r() - 0.5) * 0.02);
        return [CAM.x + Math.sin(az) * d, CAM.y - d * depth, CAM.z - Math.cos(az) * d];
      });
    };
    const ridges = [
      { d: 300, h: 30, seed: 1.7 },
      { d: 240, h: 17, seed: 4.1 },
    ].map(({ d, h, seed }) => {
      const shape = new THREE.Shape();
      const w = 1400;
      shape.moveTo(-w / 2, -60);
      for (let x = -w / 2; x <= w / 2; x += 8) shape.lineTo(x, h * (0.45 + 0.35 * Math.sin(x * 0.012 + seed) + 0.2 * Math.sin(x * 0.041 + seed * 2.3)));
      shape.lineTo(w / 2, -60);
      return { geo: new THREE.ShapeGeometry(shape), d };
    });
    return { stars, cityA: city(11, 260, 0.22), cityB: city(11, 50, 0.16), ridges };
  }, []);

  useEffect(
    () => () => {
      geo.stars.dispose();
      geo.cityA.dispose();
      geo.cityB.dispose();
      geo.ridges.forEach((r) => r.geo.dispose());
    },
    [geo],
  );

  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        // Cielo nocturno; el resplandor de la ciudad (cian, la luz de la marca) pegado al
        // horizonte y el valle oscuro debajo, del color de la niebla para que la vía se funda.
        fragmentShader: `varying vec3 vDir;
          void main(){
            float h = vDir.y;
            vec3 top = vec3(0.006,0.012,0.022);
            vec3 low = vec3(0.028,0.075,0.1);
            vec3 col = mix(low, top, smoothstep(0.0, 0.32, h));
            col += vec3(0.05,0.24,0.3) * exp(-abs(h + 0.01) * 30.0) * 0.85;
            col = mix(col, vec3(0.027,0.09,0.13), smoothstep(0.0, -0.08, h));
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [],
  );
  useEffect(() => () => skyMat.dispose(), [skyMat]);

  const dir = useMemo(() => LOOK.clone().sub(CAM).setY(0).normalize(), []);

  return (
    <>
      <mesh material={skyMat} renderOrder={-3}>
        <sphereGeometry args={[600, 32, 16]} />
      </mesh>
      <points geometry={geo.stars} renderOrder={-2}>
        <pointsMaterial size={1.4} sizeAttenuation={false} color="#c8f3ff" transparent opacity={0.65} depthWrite={false} fog={false} />
      </points>
      {geo.ridges.map((r, i) => (
        <mesh key={i} geometry={r.geo} position={[CAM.x + dir.x * r.d, CAM.y - 18, CAM.z + dir.z * r.d]} rotation-y={Math.atan2(-dir.x, -dir.z)} renderOrder={-2}>
          <meshBasicMaterial color={i === 0 ? '#0a1b24' : '#071319'} fog={false} />
        </mesh>
      ))}
      <points geometry={geo.cityA} renderOrder={-1}>
        <pointsMaterial size={1.5} sizeAttenuation={false} color="#8fe6f7" transparent opacity={0.55} depthWrite={false} fog={false} toneMapped={false} />
      </points>
      <points geometry={geo.cityB} renderOrder={-1}>
        <pointsMaterial size={2.2} sizeAttenuation={false} color="#e8fbff" transparent opacity={0.75} depthWrite={false} fog={false} toneMapped={false} />
      </points>
    </>
  );
}

/** Haz de los faros sobre el asfalto: lo que hace que la vía se lea de noche. */
function Headlights() {
  const geo = useMemo(() => ribbon(0, 40, 1, [-2.4, 0.03], [3.0, 0.03]), []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv;
          void main(){
            float along = smoothstep(0.0, 0.06, vUv.y) * pow(1.0 - vUv.y, 1.7);
            float across = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
            gl_FragColor = vec4(vec3(0.42, 0.62, 0.68) * along * across * 0.55, 1.0);
          }`,
      }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  return <mesh geometry={geo} material={mat} />;
}

// ----------------------------------------------------------------- cámara

function CameraRig({ calm }: { calm: boolean }) {
  const { camera, size } = useThree();
  const t = useRef(0);
  const aspect = size.width / Math.max(1, size.height);
  // Franja muy ancha (APK en horizontal): campo vertical cerrado para que los letreros sean
  // grandes; en franjas menos anchas (celular) se abre. La inclinación se ajusta para que el
  // borde superior quede siempre justo encima del primer pórtico.
  const fov = aspect > 6 ? 22 : aspect > 3.6 ? 28 : aspect > 2.2 ? 32 : 38;
  // En la franja más estrecha se recorta un poco la viga de arriba para que quepa el tercer letrero.
  const top = aspect > 6 ? 16.6 : 17.5;
  const look = useMemo(() => {
    const pitch = THREE.MathUtils.degToRad(top - fov / 2);
    return CAM.clone().add(new THREE.Vector3(Math.sin(YAW) * Math.cos(pitch), Math.sin(pitch), -Math.cos(YAW) * Math.cos(pitch)).multiplyScalar(40));
  }, [fov, top]);
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    persp.fov = fov;
    persp.updateProjectionMatrix();
  }, [camera, fov]);
  useFrame((_, dt) => {
    t.current += calm ? 0 : Math.min(dt, 0.05);
    const s = t.current;
    // Vibración mínima de la carretera: sin ella la escena parece una foto.
    camera.position.set(CAM.x, CAM.y + Math.sin(s * 7.1) * 0.006 + Math.sin(s * 1.3) * 0.01, CAM.z);
    camera.lookAt(look);
  });
  return null;
}

// ----------------------------------------------------------------- lienzo

export default function QueueHighway({ signs, moving, calm = false, className = '' }: { signs: HighwaySign[]; moving: boolean; calm?: boolean; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let inView = true;
    const update = () => setVisible(inView && !document.hidden);
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      update();
    });
    io.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    <div ref={host} className={className} aria-hidden="true">
      <Canvas
        flat
        dpr={[1, 1.5]}
        frameloop={!visible ? 'never' : calm ? 'demand' : 'always'}
        camera={{ fov: 40, near: 0.3, far: 700, position: [CAM.x, CAM.y, CAM.z] }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      >
        <color attach="background" args={['#03080c']} />
        <fog attach="fog" args={['#071722', 24, 98]} />
        <CameraRig calm={calm} />
        <Horizon />
        <Road moving={moving} calm={calm} />
        <Headlights />
        <Signs signs={signs} calm={calm} />
      </Canvas>
    </div>
  );
}
