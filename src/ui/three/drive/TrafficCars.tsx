import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLSL_BEND, ROAD_FAR, ROAD_LEN, type SharedUniforms } from './shared';
import { trafficCars, type CarSpec } from './World';

/*
 * Carrocerías del tráfico. Antes sólo se veían las luces (lo señaló Diego: "no se ven los otros
 * carros, sólo luces"). Cada vehículo usa la MISMA fase, carril y velocidad que sus faros o
 * pilotos (World.tsx → trafficCars) y su posición se calcula en el vertex shader con la misma
 * fórmula y los mismos uniforms: la carrocería va pegada a sus luces sin un fotograma de retraso
 * y sin coste de CPU por fotograma.
 *
 * Cada carrocería tiene su gemelo reflejado en el asfalto mojado (como las luces), tenue.
 */

const SEDAN_LEN = 4.5;
const TRUCK_LEN = 9.0;

// Remolques: colores neutros. Un remolque rojo vino de 7 m se leía como una mancha roja en la
// vista de grúa (captura del capítulo 3).
const TRUCK_PAINTS: [number, number, number][] = [
  [0.55, 0.58, 0.6],
  [0.2, 0.22, 0.25],
  [0.72, 0.74, 0.74],
  [0.1, 0.16, 0.26],
];

// Colores de pintura reales (de noche se leen por los reflejos, no por el color plano).
const PAINTS: [number, number, number][] = [
  [0.62, 0.66, 0.7], // plata
  [0.86, 0.88, 0.9], // blanco
  [0.1, 0.11, 0.12], // negro
  [0.24, 0.26, 0.29], // gris grafito
  [0.42, 0.06, 0.07], // rojo vino
  [0.06, 0.13, 0.3], // azul noche
  [0.5, 0.52, 0.5], // champaña
];

// ------------------------------------------------------------- geometrías

function extrudeProfile(points: [number, number][], width: number, bevel = 0.05): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 1,
  });
  // El perfil está en (largo, alto) con el morro en +x; se centra el ancho y se gira para que
  // el largo vaya en z con el morro hacia −z (sentido de la marcha del carro protagonista).
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function wheelSet(positions: [number, number, number][], r: number, w: number): THREE.BufferGeometry {
  return mergeGeometries(
    positions.map(([x, y, z]) => {
      const c = new THREE.CylinderGeometry(r, r, w, 14, 1);
      c.rotateZ(Math.PI / 2);
      c.translate(x, y, z);
      return c;
    }),
  )!;
}

function sedanGeometries() {
  // Perfil lateral: paragolpes, capó, parabrisas, techo, luneta, maletero.
  const body = extrudeProfile(
    [
      [2.25, 0.3],
      [2.25, 0.74],
      [2.06, 0.86],
      [1.05, 0.99],
      [-1.72, 1.03],
      [-2.18, 0.98],
      [-2.25, 0.74],
      [-2.25, 0.3],
    ],
    1.8,
  );
  // Habitáculo de cristal tintado, un poco más estrecho (caída de las ventanas).
  const glass = extrudeProfile(
    [
      [1.02, 0.99],
      [0.32, 1.41],
      [-0.86, 1.44],
      [-1.7, 1.03],
    ],
    1.58,
    0.04,
  );
  const wheels = wheelSet(
    [
      [-0.8, 0.33, -1.42],
      [0.8, 0.33, -1.42],
      [-0.8, 0.33, 1.42],
      [0.8, 0.33, 1.42],
    ],
    0.33,
    0.24,
  );
  return { body, glass, wheels, len: SEDAN_LEN };
}

function truckGeometries() {
  // Cabina (morro en −z) y remolque alto detrás.
  const cab = new THREE.BoxGeometry(2.3, 2.3, 1.9);
  cab.translate(0, 1.55, -3.55);
  const hood = new THREE.BoxGeometry(2.3, 0.9, 0.55);
  hood.translate(0, 0.95, -4.22);
  const trailer = new THREE.BoxGeometry(2.46, 3.0, 6.7);
  trailer.translate(0, 2.15, 1.15);
  const chassis = new THREE.BoxGeometry(2.1, 0.3, 8.6);
  chassis.translate(0, 0.62, 0.2);
  const body = mergeGeometries([cab, hood, trailer, chassis])!;
  const glass = new THREE.BoxGeometry(2.1, 0.9, 0.05);
  glass.translate(0, 2.15, -4.51);
  // Luces de gálibo ámbar a lo largo del remolque y en las esquinas altas, como las de los
  // camiones reales: de noche son lo que dibuja su silueta.
  const marks: THREE.BufferGeometry[] = [];
  for (const x of [-1.24, 1.24]) {
    for (const z of [-2.0, -0.4, 1.2, 2.8, 4.3]) {
      const m = new THREE.BoxGeometry(0.04, 0.07, 0.16);
      m.translate(x, 0.78, z);
      marks.push(m);
    }
    for (const z of [-2.2, 4.48]) {
      const top = new THREE.BoxGeometry(0.05, 0.07, 0.07);
      top.translate(x * 0.92, 3.62, z);
      marks.push(top);
    }
  }
  const markers = mergeGeometries(marks)!;
  const wheels = wheelSet(
    [
      [-1.0, 0.48, -3.6],
      [1.0, 0.48, -3.6],
      [-1.0, 0.48, 2.6],
      [1.0, 0.48, 2.6],
      [-1.0, 0.48, 3.7],
      [1.0, 0.48, 3.7],
    ],
    0.48,
    0.36,
  );
  return { body, glass, wheels, markers, len: TRUCK_LEN };
}

// ---------------------------------------------------------- instanciado

function instanced(base: THREE.BufferGeometry, cars: CarSpec[], len: number, palette = PAINTS): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  for (const [name, attr] of Object.entries(base.attributes)) g.setAttribute(name, attr);
  const one = (f: (c: CarSpec, i: number) => number) => new THREE.InstancedBufferAttribute(new Float32Array(cars.map(f)), 1);
  g.setAttribute('aLane', one((c) => c.lane));
  g.setAttribute('aPhase', one((c) => c.phase));
  g.setAttribute('aOwn', one((c) => c.own));
  g.setAttribute('aFlip', one((c) => c.flip));
  g.setAttribute('aLen', one(() => len));
  g.setAttribute('aPaint', new THREE.InstancedBufferAttribute(new Float32Array(cars.flatMap((_, i) => palette[(i * 3 + 1) % palette.length])), 3));
  g.instanceCount = cars.length;
  return g;
}

/**
 * Inyecta en un material estándar la posición del tráfico (misma fórmula que las luces en
 * World.tsx: z = −FAR + mod(fase·LEN + recorrido + velocidad·t, LEN)). La carrocería va detrás
 * de sus luces medio largo: los faros están en el morro de los que vienen y los pilotos en la
 * cola de los que van delante, y en ambos casos eso queda hacia +z.
 */
function trafficMaterial(params: THREE.MeshStandardMaterialParameters, u: SharedUniforms, opts: { paint: boolean; mirror: boolean }) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uTravel = u.uTravel;
    shader.uniforms.uCurve = u.uCurve;
    shader.uniforms.uExterior = u.uExterior;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uTime;
        uniform float uTravel;
        uniform float uExterior;
        varying float vHide;
        ${GLSL_BEND}
        attribute float aLane;
        attribute float aPhase;
        attribute float aOwn;
        attribute float aFlip;
        attribute float aLen;
        attribute vec3 aPaint;
        varying vec3 vPaint;
        const float CB_FAR = ${ROAD_FAR.toFixed(1)};
        const float CB_LEN = ${ROAD_LEN.toFixed(1)};`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        float cbHead = -CB_FAR + mod(aPhase * CB_LEN + uTravel + aOwn * uTime, CB_LEN);
        // 12 cm detrás del plano de las luces: si coincidieran, faro y carrocería parpadearían
        // por empate de profundidad.
        float cbZ = cbHead - aLen * 0.5 - 0.12;
        // Giro con la curva de la vía; los que vienen de frente, media vuelta.
        float cbYaw = atan(bendSlope(cbZ)) + aFlip * 3.14159265;
        float cbC = cos(cbYaw);
        float cbS = sin(cbYaw);
        mat3 cbR = mat3(cbC, 0.0, -cbS, 0.0, 1.0, 0.0, cbS, 0.0, cbC);
        vec3 cbT = vec3(aLane + bendX(cbZ), 0.0, cbZ);
        vPaint = aPaint;
        // En las vistas exteriores el protagonista es el carro de CarBeat: los vehículos que
        // pasan a su lado se disuelven para no taparlo (un remolque de 7 m lo cubría entero).
        // (Centrado en el protagonista, z≈0: ±9 m invisibles, fundido hasta 18 m.)
        vHide = uExterior * (1.0 - smoothstep(9.0, 18.0, abs(cbZ)));
        #include <beginnormal_vertex>
        objectNormal = cbR * objectNormal;
        ${opts.mirror ? 'objectNormal.y = -objectNormal.y;' : ''}`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        transformed = cbR * transformed + cbT;
        ${opts.mirror ? 'transformed.y = -transformed.y;' : ''}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaint;\nvarying float vHide;')
      // Fundido suave. (Primero fue un tramado sin transparencia, pero cuando el vehículo pasaba
      // junto a la cámara se veía como ruido de televisor sobre media pantalla.)
      .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\ndiffuseColor.a *= 1.0 - vHide;\nif (diffuseColor.a < 0.01) discard;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n${opts.paint ? 'diffuseColor.rgb *= vPaint;' : ''}`);
  };
  // Cada combinación (pintura / espejo) compila su propio programa.
  m.customProgramCacheKey = () => `traffic-${opts.paint ? 'p' : 'n'}-${opts.mirror ? 'm' : 'd'}`;
  if (!opts.mirror) {
    // Transparente sólo para poder desvanecerse: sigue escribiendo profundidad y dibuja sólo
    // caras frontales, así durante el fundido no se ven las caras internas.
    m.transparent = true;
    m.depthWrite = true;
  }
  if (opts.mirror) {
    // El reflejo invierte el sentido de las caras; tenue y sin escribir profundidad, como un
    // reflejo sobre asfalto mojado (la calzada tampoco escribe profundidad).
    m.side = THREE.BackSide;
    m.transparent = true;
    m.opacity = 0.32;
    m.depthWrite = false;
  }
  return m;
}

type Built = { geo: THREE.InstancedBufferGeometry; mat: THREE.MeshStandardMaterial }[];

export function TrafficCars({ u, lite }: { u: SharedUniforms; lite: boolean }) {
  const parts = useMemo<Built>(() => {
    const cars = trafficCars(lite);
    const sedans = cars.filter((c) => c.kind === 'sedan');
    const trucks = cars.filter((c) => c.kind === 'truck');
    const s = sedanGeometries();
    const t = truckGeometries();
    const out: Built = [];
    const add = (base: THREE.BufferGeometry, list: CarSpec[], len: number, params: THREE.MeshStandardMaterialParameters, paint: boolean, palette = PAINTS) => {
      if (!list.length) return;
      const geo = instanced(base, list, len, palette);
      out.push({ geo, mat: trafficMaterial(params, u, { paint, mirror: false }) });
      if (!lite) out.push({ geo, mat: trafficMaterial({ ...params, envMapIntensity: (params.envMapIntensity ?? 1) * 0.6 }, u, { paint, mirror: true }) });
    };
    const paint: THREE.MeshStandardMaterialParameters = { color: '#ffffff', metalness: 0.72, roughness: 0.3, envMapIntensity: 1.6 };
    const glass: THREE.MeshStandardMaterialParameters = { color: '#04080b', metalness: 0.95, roughness: 0.06, envMapIntensity: 2.4 };
    const rubber: THREE.MeshStandardMaterialParameters = { color: '#050607', metalness: 0.1, roughness: 0.85, envMapIntensity: 0.3 };
    const truckPaint: THREE.MeshStandardMaterialParameters = { color: '#ffffff', metalness: 0.35, roughness: 0.55, envMapIntensity: 1.0 };
    const amber: THREE.MeshStandardMaterialParameters = { color: '#000000', emissive: new THREE.Color(1.0, 0.55, 0.08), emissiveIntensity: 2.4, toneMapped: false };
    add(s.body, sedans, s.len, paint, true);
    add(s.glass, sedans, s.len, glass, false);
    add(s.wheels, sedans, s.len, rubber, false);
    add(t.body, trucks, t.len, truckPaint, true, TRUCK_PAINTS);
    add(t.glass, trucks, t.len, glass, false);
    add(t.wheels, trucks, t.len, rubber, false);
    add(t.markers, trucks, t.len, amber, false);
    for (const g of [s.body, s.glass, s.wheels, t.body, t.glass, t.wheels, t.markers]) g.dispose();
    return out;
  }, [u, lite]);

  useEffect(
    () => () => {
      for (const p of parts) {
        p.geo.dispose();
        p.mat.dispose();
      }
    },
    [parts],
  );

  return (
    <>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geo} material={p.mat} frustumCulled={false} />
      ))}
    </>
  );
}
