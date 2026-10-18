import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CYAN,
  GLSL_BEND,
  ICE,
  ROAD_FAR,
  ROAD_HALF,
  ROAD_LEN,
  ROAD_NEAR,
  bendSlope,
  bendX,
  radialTexture,
  setInstance,
  type DriveState,
  type SharedUniforms,
} from './shared';

/*
 * El mundo de la portada: cielo, cordillera, carretera con curvas, postes, tráfico y lluvia.
 *
 * Asfalto mojado barato: la calzada NO escribe profundidad, y cada luz (faros, farolas) tiene
 * un "gemelo" reflejado en y = −altura, estirado hacia abajo. Un plano espejo es exacto para
 * cualquier punto de vista, así que el reflejo cae donde debe tanto desde la cabina como desde
 * la grúa, sin render a textura ni pasada extra.
 *
 * Orden de dibujo: cielo (−10) → suelo y calzada (−5, sin profundidad) → el resto.
 */

// ------------------------------------------------------------------ cielo

export function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {},
        vertexShader: /* glsl */ `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        // Degradado nocturno con resplandor de ciudad en el horizonte (cian del sistema, apagado).
        fragmentShader: /* glsl */ `varying vec3 vPos;
          void main(){
            float h = vPos.y;
            vec3 top = vec3(0.004,0.008,0.016);
            vec3 mid = vec3(0.012,0.04,0.062);
            vec3 glow = vec3(0.03,0.2,0.26);
            vec3 col = mix(mid, top, smoothstep(0.0, 0.5, h));
            col += glow * exp(-abs(h) * 16.0) * 0.85;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-10}>
      <sphereGeometry args={[420, 32, 16]} />
    </mesh>
  );
}

export function Stars({ count = 700 }: { count?: number }) {
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const y = 0.06 + Math.pow(Math.random(), 0.8) * 0.92;
      const r = 380;
      pos[i * 3] = Math.cos(theta) * r * Math.sqrt(1 - y * y);
      pos[i * 3 + 1] = y * r;
      pos[i * 3 + 2] = Math.sin(theta) * r * Math.sqrt(1 - y * y);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);
  return (
    <points geometry={geo} renderOrder={-9}>
      <pointsMaterial size={1.4} sizeAttenuation={false} color="#c8f3ff" transparent opacity={0.8} depthWrite={false} fog={false} />
    </points>
  );
}

/** Luna baja con halo: la única luz "natural"; el bloom hace el resto. */
export function Moon() {
  const tex = useMemo(
    () =>
      radialTexture(256, [
        [0, 'rgba(255,255,255,1)'],
        [0.16, 'rgba(235,252,255,1)'],
        [0.19, 'rgba(160,230,245,0.35)'],
        [0.45, 'rgba(60,170,200,0.08)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
    [],
  );
  return (
    <mesh position={[170, 92, -300]} renderOrder={-8}>
      <planeGeometry args={[70, 70]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} color={new THREE.Color(1.3, 1.3, 1.3)} toneMapped={false} />
    </mesh>
  );
}

/** Cordillera: siluetas en capas, más azuladas cuanto más lejos, con un filo de luz arriba. */
export function Mountains() {
  const layers = useMemo(() => {
    return [
      { z: -250, h: 34, color: '#0a1a23', seed: 1.3 },
      { z: -205, h: 22, color: '#06121a', seed: 2.7 },
      { z: -175, h: 12, color: '#040b10', seed: 4.1 },
    ].map(({ z, h, color, seed }) => {
      const shape = new THREE.Shape();
      const w = 760;
      shape.moveTo(-w / 2, -1);
      for (let x = -w / 2; x <= w / 2; x += 5) {
        const y = h * (0.42 + 0.32 * Math.sin(x * 0.019 + seed) + 0.18 * Math.sin(x * 0.061 + seed * 3) + 0.08 * Math.sin(x * 0.17 + seed));
        shape.lineTo(x, Math.max(0.5, y));
      }
      shape.lineTo(w / 2, -1);
      return { geo: new THREE.ShapeGeometry(shape), z, color };
    });
  }, []);
  return (
    <>
      {layers.map((l, i) => (
        <mesh key={i} geometry={l.geo} position={[0, 0, l.z]}>
          <meshBasicMaterial color={l.color} fog={false} />
        </mesh>
      ))}
    </>
  );
}

// -------------------------------------------------------------- carretera

/** Tiras a lo largo de z (calzada, líneas continuas) que se doblan en CPU con la curva. */
function makeStrips(strips: [number, number][], segs: number) {
  const n = strips.length * (segs + 1) * 2;
  const pos = new Float32Array(n * 3);
  const normal = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const baseX = new Float32Array(n);
  const zs = new Float32Array(n);
  const idx: number[] = [];
  let v = 0;
  for (const [cx, w] of strips) {
    const start = v;
    for (let i = 0; i <= segs; i++) {
      const z = ROAD_NEAR - ROAD_LEN * (i / segs);
      for (const side of [-1, 1]) {
        const x = cx + (side * w) / 2;
        pos[v * 3] = x;
        pos[v * 3 + 2] = z;
        normal[v * 3 + 1] = 1;
        uv[v * 2] = side < 0 ? 0 : 1;
        uv[v * 2 + 1] = (i / segs) * 60;
        baseX[v] = x;
        zs[v] = z;
        v++;
      }
      if (i < segs) {
        const a = start + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return { geo, baseX, zs };
}

function bendStrips(s: { geo: THREE.BufferGeometry; baseX: Float32Array; zs: Float32Array }, curve: number) {
  const attr = s.geo.attributes.position as THREE.BufferAttribute;
  const p = attr.array as Float32Array;
  for (let i = 0; i < s.baseX.length; i++) p[i * 3] = s.baseX[i] + curve * s.zs[i] * s.zs[i];
  attr.needsUpdate = true;
}

/** Textura de asfalto: grano fino y manchas de humedad, dibujada una vez. */
function asphaltTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b0f13';
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 8 + Math.random() * 22;
    g.fillStyle = `rgb(${v},${v + 3},${v + 6})`;
    g.fillRect(Math.random() * 128, Math.random() * 256, 1, 1);
  }
  for (let i = 0; i < 14; i++) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(Math.random() * 128, Math.random() * 256, 6 + Math.random() * 18, 14 + Math.random() * 40, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const DASH_GAP = 10;
const DASHES = Math.ceil(ROAD_LEN / DASH_GAP);
const STUD_GAP = 12;
const STUDS = Math.ceil(ROAD_LEN / STUD_GAP);
export const POLES_PER_SIDE = 9;
const POLE_X = ROAD_HALF + 0.9;
export const LAMP_X = ROAD_HALF - 0.55;
export const LAMP_Y = 6.25;

/** z en el mundo de algo fijo al suelo, para una fase 0..1 y la distancia recorrida. */
export const groundZ = (phase: number, dist: number) => -ROAD_FAR + ((((phase * ROAD_LEN + dist) % ROAD_LEN) + ROAD_LEN) % ROAD_LEN);

export function Road({ drive }: { drive: DriveState }) {
  const surface = useMemo(() => makeStrips([[0, ROAD_HALF * 2 + 0.5]], 150), []);
  // Doble línea central y bordes: una sola malla, un solo draw call.
  const lines = useMemo(
    () =>
      makeStrips(
        [
          [-0.11, 0.1],
          [0.11, 0.1],
          [-(ROAD_HALF - 0.22), 0.13],
          [ROAD_HALF - 0.22, 0.13],
        ],
        150,
      ),
    [],
  );
  const asphalt = useMemo(asphaltTexture, []);
  const dashes = useRef<THREE.InstancedMesh>(null);
  const studs = useRef<THREE.InstancedMesh>(null);
  const poles = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);
  const pools = useRef<THREE.InstancedMesh>(null);
  const poolTex = useMemo(() => radialTexture(128), []);
  // Plano ya tumbado sobre el suelo: setInstance sólo aplica el giro en Y de la curva.
  const poolGeo = useMemo(() => new THREE.PlaneGeometry(5, 9).rotateX(-Math.PI / 2), []);

  useFrame(() => {
    const k = drive.curve;
    bendStrips(surface, k);
    bendStrips(lines, k);
    const d = drive.dist;

    // Líneas discontinuas entre carriles (x = ±2,7)
    if (dashes.current) {
      const a = dashes.current.instanceMatrix.array as Float32Array;
      for (let i = 0; i < DASHES; i++) {
        const z = groundZ(i / DASHES, d);
        const yaw = Math.atan(bendSlope(k, z));
        setInstance(a, i * 2, -2.7 + bendX(k, z), 0.012, z, yaw);
        setInstance(a, i * 2 + 1, 2.7 + bendX(k, z), 0.012, z, yaw);
      }
      dashes.current.instanceMatrix.needsUpdate = true;
    }
    // Ojos de gato: bordes en cian y centro en blanco hielo (el bloom los hace brillar)
    if (studs.current) {
      const a = studs.current.instanceMatrix.array as Float32Array;
      for (let i = 0; i < STUDS; i++) {
        const z = groundZ(i / STUDS, d + 3);
        const bx = bendX(k, z);
        setInstance(a, i * 2, -(ROAD_HALF - 0.42) + bx, 0.03, z);
        setInstance(a, i * 2 + 1, ROAD_HALF - 0.42 + bx, 0.03, z);
      }
      studs.current.instanceMatrix.needsUpdate = true;
    }
    if (poles.current && arms.current && pools.current) {
      const pa = poles.current.instanceMatrix.array as Float32Array;
      const aa = arms.current.instanceMatrix.array as Float32Array;
      const la = pools.current.instanceMatrix.array as Float32Array;
      for (let i = 0; i < POLES_PER_SIDE * 2; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const z = groundZ(poleP(i), d);
        const bx = bendX(k, z);
        const yaw = Math.atan(bendSlope(k, z));
        setInstance(pa, i, side * POLE_X + bx, 3.2, z, yaw);
        setInstance(aa, i, side * (POLE_X - 0.85) + bx, LAMP_Y + 0.12, z, yaw);
        // Charco de luz bajo la farola, alargado a lo largo de la vía
        setInstance(la, i, side * (LAMP_X - 0.6) + bx, 0.015, z, yaw);
      }
      poles.current.instanceMatrix.needsUpdate = true;
      arms.current.instanceMatrix.needsUpdate = true;
      pools.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Terreno fuera de la vía */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, -150]} renderOrder={-5}>
        <planeGeometry args={[1400, 700]} />
        <meshStandardMaterial color="#020405" roughness={1} depthWrite={false} />
      </mesh>
      {/* Calzada mojada: pulida y metálica para que el entorno la haga brillar */}
      <mesh geometry={surface.geo} renderOrder={-5} frustumCulled={false}>
        <meshStandardMaterial map={asphalt} color="#7d8b96" roughness={0.34} metalness={0.55} envMapIntensity={0.55} depthWrite={false} />
      </mesh>
      <mesh geometry={lines.geo} frustumCulled={false}>
        <meshStandardMaterial color="#cfe6ee" roughness={0.5} emissive="#9ad7e6" emissiveIntensity={0.25} />
      </mesh>
      <instancedMesh ref={dashes} args={[undefined, undefined, DASHES * 2]} frustumCulled={false}>
        <boxGeometry args={[0.13, 0.012, 3.4]} />
        <meshStandardMaterial color="#d6ecf2" roughness={0.5} emissive="#9ad7e6" emissiveIntensity={0.3} />
      </instancedMesh>
      <instancedMesh ref={studs} args={[undefined, undefined, STUDS * 2]} frustumCulled={false}>
        <boxGeometry args={[0.1, 0.04, 0.07]} />
        <meshBasicMaterial color={CYAN.clone().multiplyScalar(3.2)} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={poles} args={[undefined, undefined, POLES_PER_SIDE * 2]} frustumCulled={false}>
        <boxGeometry args={[0.14, 6.4, 0.14]} />
        <meshStandardMaterial color="#121a20" roughness={0.45} metalness={0.6} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, POLES_PER_SIDE * 2]} frustumCulled={false}>
        <boxGeometry args={[1.9, 0.09, 0.26]} />
        <meshStandardMaterial color="#0f161b" roughness={0.4} metalness={0.7} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[poolGeo, undefined, POLES_PER_SIDE * 2]} frustumCulled={false}>
        <meshBasicMaterial
          map={poolTex}
          color={ICE.clone().multiplyScalar(0.1)}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}

/** Fase de cada poste: los dos lados alternados medio vano. */
export const poleP = (i: number) => {
  const k = i >> 1;
  return (k + (i % 2 === 0 ? 0 : 0.5)) / POLES_PER_SIDE;
};

// ------------------------------------------------------------- tráfico y luces

/*
 * Todas las luces "puntuales" de la carretera en UNA malla instanciada con shader propio:
 * faros de los carros que vienen, pilotos de los que adelantamos y las farolas. La posición se
 * calcula en la GPU (fase + distancia + velocidad propia), así que no cuesta CPU por fotograma.
 * Con uTrail > 0 cada luz se convierte en una estela de exposición larga.
 */

const RIBBON_SEGS = 10;

function ribbonGeometry(): THREE.InstancedBufferGeometry {
  const geo = new THREE.InstancedBufferGeometry();
  const n = (RIBBON_SEGS + 1) * 2;
  const pos = new Float32Array(n * 3);
  const aEnd = new Float32Array(n);
  const aSide = new Float32Array(n);
  const idx: number[] = [];
  for (let i = 0; i <= RIBBON_SEGS; i++) {
    for (let s = 0; s < 2; s++) {
      const v = i * 2 + s;
      aEnd[v] = i / RIBBON_SEGS;
      aSide[v] = s === 0 ? -1 : 1;
    }
    if (i < RIBBON_SEGS) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 1));
  geo.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
  geo.setIndex(idx);
  return geo;
}

type LightSpec = { lane: number; height: number; phase: number; own: number; size: number; trailK: number; color: [number, number, number] };

/**
 * Un vehículo del tráfico: las mismas fase, carril y velocidad que sus luces, para que la
 * carrocería (TrafficCars.tsx) vaya pegada a sus faros o pilotos.
 * flip = 1: viene de frente (el morro mira a +z). flip = 0: va en nuestro sentido.
 */
export type CarSpec = { lane: number; phase: number; own: number; flip: number; kind: 'sedan' | 'truck' };

function buildLights(lite: boolean, cars: CarSpec[] = []): LightSpec[] {
  const out: LightSpec[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Carros que vienen de frente (carriles de la izquierda): pares de faros.
  const oncoming = lite ? 8 : 13;
  for (let i = 0; i < oncoming; i++) {
    const lane = rnd() < 0.55 ? -1.35 : -4.05;
    const phase = (i + rnd() * 0.6) / oncoming;
    const own = 15 + rnd() * 9;
    const led = rnd() < 0.5;
    const color: [number, number, number] = led ? [0.82, 0.94, 1] : [1, 0.9, 0.74];
    for (const off of [-0.68, 0.68]) out.push({ lane: lane + off, height: 0.66, phase, own, size: 0.13, trailK: 1, color });
    cars.push({ lane, phase, own, flip: 1, kind: 'sedan' });
  }
  // Camiones y carros lentos en el carril derecho exterior: pilotos rojos que vamos alcanzando.
  const slow = lite ? 3 : 6;
  for (let i = 0; i < slow; i++) {
    const phase = (i + rnd() * 0.5) / slow;
    const own = -(9 + rnd() * 4);
    for (const off of [-0.72, 0.72]) out.push({ lane: 4.05 + off, height: 0.86, phase, own, size: 0.11, trailK: 1, color: [1, 0.09, 0.17] });
    cars.push({ lane: 4.05, phase, own, flip: 0, kind: 'truck' });
  }
  // Los que nos adelantan por el carril exterior (nunca por el nuestro: no atraviesan el carro).
  const fast = lite ? 2 : 4;
  for (let i = 0; i < fast; i++) {
    const phase = (i + 0.3 + rnd() * 0.4) / fast;
    const own = -(27 + rnd() * 6);
    for (const off of [-0.72, 0.72]) out.push({ lane: 4.05 + off, height: 0.84, phase, own, size: 0.11, trailK: 1, color: [1, 0.12, 0.2] });
    cars.push({ lane: 4.05, phase, own, flip: 0, kind: 'sedan' });
  }
  // Farolas (fijas al suelo, mismas fases que los postes de la CPU).
  for (let i = 0; i < POLES_PER_SIDE * 2; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    out.push({ lane: side * LAMP_X, height: LAMP_Y, phase: poleP(i), own: 0, size: 0.3, trailK: 0, color: [0.72, 0.95, 1] });
  }
  return out;
}

/** Los vehículos del tráfico, generados con la misma semilla que sus luces. */
export function trafficCars(lite: boolean): CarSpec[] {
  const cars: CarSpec[] = [];
  buildLights(lite, cars);
  return cars;
}

const LIGHT_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uTravel;
  uniform float uSpeed;
  uniform float uTrail;
  uniform float uMirror;
  uniform float uExterior;
  attribute float aEnd;
  attribute float aSide;
  attribute float aLane;
  attribute float aHeight;
  attribute float aPhase;
  attribute float aOwn;
  attribute float aSize;
  attribute float aTrailK;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAcross;
  varying float vAlong;
  varying float vLen;
  varying float vSize;
  varying float vFade;
  ${GLSL_BEND}
  const float FAR = ${ROAD_FAR.toFixed(1)};
  const float LEN = ${ROAD_LEN.toFixed(1)};
  void main() {
    float rel = uSpeed + aOwn;                 // velocidad relativa hacia +z (hacia el carro)
    float dirZ = rel >= 0.0 ? 1.0 : -1.0;
    float z = -FAR + mod(aPhase * LEN + uTravel + aOwn * uTime, LEN);
    float len = abs(rel) * uTrail * aTrailK;   // exposición larga: metros de estela
    bool mirror = uMirror > 0.5;
    // En el asfalto mojado el reflejo se estira hacia el que mira: más cuanto más alta la luz.
    float wet = mirror ? 1.6 + aHeight * 0.7 : 0.0;
    float total = len + wet + 2.0 * aSize;
    float along = aEnd * total - aSize;        // metros detrás de la cabeza (negativo: tapa)
    float hA = mirror ? min(along, len) : along;
    float vA = mirror ? max(along - len, 0.0) : 0.0;
    float zz = z - dirZ * hA;
    float y = mirror ? -aHeight - vA : aHeight;
    vec3 P = vec3(aLane + bendX(zz), y, zz);
    // Dirección local de la cinta: a lo largo de la estela o, en el reflejo, hacia abajo.
    vec3 dir = (mirror && along > len) ? vec3(0.0, -1.0, 0.0) : normalize(vec3(-dirZ * bendSlope(zz), 0.0, -dirZ));
    vec3 toCam = normalize(cameraPosition - P);
    vec3 side = normalize(cross(dir, toCam));
    P += side * aSide * aSize * (mirror ? 1.6 : 1.0);
    vec4 mv = modelViewMatrix * vec4(P, 1.0);
    float dist = -mv.z;
    vFade = (1.0 - smoothstep(150.0, 250.0, dist)) * smoothstep(0.4, 2.5, dist);
    // Las luces de un vehículo se apagan junto con su carrocería (TrafficCars) cuando pasa al
    // lado del protagonista en las vistas exteriores; si no, quedaban luces flotando sin carro.
    // Las farolas (aTrailK = 0) no se tocan.
    if (aTrailK > 0.5) vFade *= 1.0 - uExterior * (1.0 - smoothstep(9.0, 18.0, abs(z - 2.4)));
    vColor = aColor;
    vAcross = aSide;
    vAlong = along;
    vLen = len + wet;
    vSize = aSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const LIGHT_FRAG = /* glsl */ `
  uniform float uGain;
  uniform float uMirror;
  varying vec3 vColor;
  varying float vAcross;
  varying float vAlong;
  varying float vLen;
  varying float vSize;
  varying float vFade;
  void main() {
    float cap = vAlong < 0.0 ? vAlong / vSize : (vAlong > vLen ? (vAlong - vLen) / vSize : 0.0);
    float core = exp(-(vAcross * vAcross + cap * cap) * mix(3.2, 4.5, uMirror));
    float head = exp(-(vAlong * vAlong) / (vSize * vSize) * 1.2);
    float tail = vLen > 0.02 ? pow(clamp(1.0 - vAlong / vLen, 0.0, 1.0), 1.3) : 0.0;
    // En el reflejo la cola cae deprisa: una veta que se apaga, no un poste.
    float tailK = uMirror > 0.5 ? pow(clamp(1.0 - vAlong / max(vLen, 0.01), 0.0, 1.0), 2.6) * 0.45 : tail * 0.75;
    float k = core * max(head * mix(1.0, 0.55, uMirror), tailK) * vFade * mix(1.0, 0.18, uMirror);
    gl_FragColor = vec4(vColor * uGain, k);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Traffic({ u, lite }: { u: SharedUniforms; lite: boolean }) {
  const { geo, direct, mirror } = useMemo(() => {
    const specs = buildLights(lite);
    const geo = ribbonGeometry();
    const n = specs.length;
    const f = (k: keyof LightSpec) => new THREE.InstancedBufferAttribute(new Float32Array(specs.map((s) => s[k] as number)), 1);
    geo.setAttribute('aLane', f('lane'));
    geo.setAttribute('aHeight', f('height'));
    geo.setAttribute('aPhase', f('phase'));
    geo.setAttribute('aOwn', f('own'));
    geo.setAttribute('aSize', f('size'));
    geo.setAttribute('aTrailK', f('trailK'));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(specs.flatMap((s) => s.color)), 3));
    geo.instanceCount = n;
    const mk = (mirrorMode: number) =>
      new THREE.ShaderMaterial({
        uniforms: { ...u, uMirror: { value: mirrorMode }, uGain: { value: mirrorMode ? 2.2 : 3.4 } },
        vertexShader: LIGHT_VERT,
        fragmentShader: LIGHT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    return { geo, direct: mk(0), mirror: mk(1) };
  }, [u, lite]);

  useEffect(
    () => () => {
      geo.dispose();
      direct.dispose();
      mirror.dispose();
    },
    [geo, direct, mirror],
  );

  return (
    <>
      <mesh geometry={geo} material={mirror} frustumCulled={false} />
      <mesh geometry={geo} material={direct} frustumCulled={false} />
    </>
  );
}

// ------------------------------------------------------------------ lluvia

/*
 * Lluvia ligera: segmentos de 1 px movidos sólo en el shader. Las gotas viven en una caja que
 * acompaña a la cámara pero están ancladas al mundo (no se arrastran al mover la cámara), y
 * se apagan dentro del habitáculo para que no llueva en la cabina.
 */
export function Rain({ u, count, carX }: { u: SharedUniforms; count: number; carX: number }) {
  const { camera } = useThree();
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const seed = new Float32Array(count * 2 * 3);
    const end = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const sx = Math.random();
      const sy = Math.random();
      const sz = Math.random();
      for (let e = 0; e < 2; e++) {
        const v = i * 2 + e;
        seed[v * 3] = sx;
        seed[v * 3 + 1] = sy;
        seed[v * 3 + 2] = sz;
        end[v] = e;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(seed, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...u, uCam: { value: new THREE.Vector3() }, uCarX: { value: carX } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uTravel;
        uniform float uSpeed;
        uniform vec3 uCam;
        uniform float uCarX;
        attribute float aEnd;
        varying float vA;
        void main() {
          vec3 box = vec3(34.0, 16.0, 44.0);
          vec3 motion = vec3(uTime * 1.2, -uTime * 11.0, uTravel);
          vec3 p = mod(position * box + motion - uCam + box * 0.5, box) - box * 0.5 + uCam;
          vec3 vel = vec3(1.2, -11.0, uSpeed);
          p -= normalize(vel) * aEnd * 0.45;
          vec3 local = p - vec3(uCarX, 0.0, 0.0);
          bool inCar = abs(local.x) < 1.0 && local.y < 1.55 && local.z > -2.7 && local.z < 2.2;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = inCar ? 0.0 : (1.0 - smoothstep(4.0, 16.0, d)) * smoothstep(0.25, 1.2, d) * 0.3 * (1.0 - 0.75 * smoothstep(3.0, 9.0, uCam.y));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          if (vA < 0.01) discard;
          gl_FragColor = vec4(0.62, 0.9, 1.0, vA);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat };
  }, [u, count, carX]);

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  useFrame(() => {
    (mat.uniforms.uCam.value as THREE.Vector3).copy(camera.position);
  });

  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />;
}

// ------------------------------------------------------------- entorno (reflejos)

/**
 * Mapa de entorno procedural (una vez, al montar): cielo nocturno y unas tiras de luz como de
 * farolas. Da reflejos creíbles a la pintura, al cristal y al asfalto sin descargar un HDRI.
 */
export function NightEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = new THREE.Scene();
    const disposables: { dispose: () => void }[] = [];
    const skyGeo = new THREE.SphereGeometry(10, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `varying vec3 vP; void main(){
        float h = vP.y;
        vec3 c = mix(vec3(0.01,0.035,0.05), vec3(0.002,0.006,0.012), smoothstep(0.0,0.6,h));
        c += vec3(0.03,0.16,0.2) * exp(-abs(h)*10.0);
        c *= h < -0.02 ? 0.25 : 1.0;
        gl_FragColor = vec4(c,1.0); }`,
    });
    env.add(new THREE.Mesh(skyGeo, skyMat));
    disposables.push(skyGeo, skyMat);
    const strip = (x: number, y: number, z: number, w: number, h: number, color: THREE.Color) => {
      const g = new THREE.PlaneGeometry(w, h);
      const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.lookAt(0, 0, 0);
      env.add(mesh);
      disposables.push(g, m);
    };
    strip(0, 6, -4, 7, 0.35, ICE.clone().multiplyScalar(1.5));
    strip(-6, 5, 1, 0.4, 6, CYAN.clone().multiplyScalar(1.6));
    strip(6, 5, -1, 0.4, 6, CYAN.clone().multiplyScalar(1.2));
    strip(0, 7, 5, 9, 0.5, ICE.clone().multiplyScalar(1.4));
    strip(-4, 2, -7, 3, 0.25, new THREE.Color(0.9, 0.85, 0.8));
    const rt = pmrem.fromScene(env, 0.035);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.85;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
      disposables.forEach((d) => d.dispose());
    };
  }, [gl, scene]);
  return null;
}
