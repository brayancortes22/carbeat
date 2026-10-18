import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CYAN, DARK, ICE, NEEDLE, TAIL, clamp01, radialTexture, smooth, streakTexture, type DriveState } from './shared';
import { canvasTexture, drawConsole, drawPhone, drawPlate, drawRearPlate, drawStandby } from './screens';

/*
 * El carro, en coordenadas propias (metros; −z hacia delante; el ojo del conductor a 1,18 m):
 *  - Cabina: salpicadero, cuadro con dos agujas y pantalla central, volante, puertas, techo.
 *  - Carrocería exterior: perfil extruido con pasos de rueda, cabina de cristal, ruedas, faros
 *    y una barra de pilotos a lo ancho.
 * La carrocería sólo dibuja caras frontales: desde dentro es invisible y desde fuera tapa la
 * cabina. Así la cámara puede salir por el techo en un solo plano continuo, sin cortes.
 */

const hdr = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k);

/** Caja orientada entre dos puntos (pilares, haces). */
function placeBetween(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, thick: number) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  obj.position.copy(a).addScaledVector(dir, 0.5);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  obj.scale.set(thick, len, thick);
}

// ------------------------------------------------------------------- formas

const W_BODY = 1.78;
const W_GLASS = 1.46;

function bodyGeometry(): THREE.BufferGeometry {
  // Perfil lateral: u hacia delante, v hacia arriba.
  const s = new THREE.Shape();
  s.moveTo(-2.0, 0.34);
  s.lineTo(-2.07, 0.62);
  s.quadraticCurveTo(-2.1, 0.92, -1.9, 0.99);
  s.lineTo(-1.45, 1.02);
  s.lineTo(0.92, 1.0);
  s.quadraticCurveTo(1.75, 0.96, 2.3, 0.84);
  s.quadraticCurveTo(2.52, 0.8, 2.53, 0.6);
  s.lineTo(2.45, 0.3);
  s.lineTo(1.88, 0.28);
  s.absarc(1.42, 0.34, 0.42, 0, Math.PI, false);
  s.lineTo(-0.9, 0.28);
  s.absarc(-1.32, 0.34, 0.42, 0, Math.PI, false);
  s.lineTo(-1.95, 0.3);
  s.closePath();
  const bevel = 0.07;
  const g = new THREE.ExtrudeGeometry(s, { depth: W_BODY - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.06, bevelSegments: 3, curveSegments: 12 });
  g.translate(0, 0, -(W_BODY - bevel * 2) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function glassGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0.95, 0.98);
  s.lineTo(0.18, 1.41);
  s.quadraticCurveTo(-0.3, 1.48, -0.82, 1.43);
  s.lineTo(-1.5, 1.02);
  s.closePath();
  const bevel = 0.045;
  const g = new THREE.ExtrudeGeometry(s, { depth: W_GLASS - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -(W_GLASS - bevel * 2) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function roofGeometry(): THREE.BufferGeometry {
  // Techo pintado sobre el cristal: deja ver parabrisas, ventanillas y luneta.
  const s = new THREE.Shape();
  s.moveTo(0.12, 1.425);
  s.quadraticCurveTo(-0.3, 1.5, -0.76, 1.445);
  s.lineTo(-0.72, 1.4);
  s.quadraticCurveTo(-0.3, 1.45, 0.1, 1.39);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: W_GLASS - 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -(W_GLASS - 0.16) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** Marcas de una esfera de reloj fusionadas en una sola geometría (un draw call por esfera). */
function ticksGeometry(major: boolean, r: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i <= 16; i++) {
    if ((i % 4 === 0) !== major) continue;
    const a = -2.27 + (i / 16) * 4.54;
    const p = new THREE.PlaneGeometry(major ? 0.0028 : 0.0018, major ? 0.014 : 0.0075);
    p.rotateZ(-a);
    p.translate(Math.sin(a) * r, Math.cos(a) * r, 0.0005);
    parts.push(p);
  }
  return mergeGeometries(parts)!;
}

// ------------------------------------------------------------------- cabina

function Dial({ x, needle }: { x: number; needle: React.RefObject<THREE.Mesh | null> }) {
  const major = useMemo(() => ticksGeometry(true, 0.06), []);
  const minor = useMemo(() => ticksGeometry(false, 0.06), []);
  return (
    <group position={[x, 0, 0]}>
      <mesh>
        <torusGeometry args={[0.071, 0.0032, 8, 72]} />
        <meshBasicMaterial color={hdr(CYAN, 2.2)} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.001]}>
        <circleGeometry args={[0.07, 48]} />
        <meshBasicMaterial color="#01080b" />
      </mesh>
      <mesh geometry={major}>
        <meshBasicMaterial color={hdr(ICE, 1.6)} toneMapped={false} />
      </mesh>
      <mesh geometry={minor}>
        <meshBasicMaterial color="#4f9fb0" toneMapped={false} />
      </mesh>
      <mesh ref={needle} position={[0, 0, 0.0015]}>
        <planeGeometry args={[0.0034, 0.112]} />
        <meshBasicMaterial color={hdr(NEEDLE, 2.4)} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.0025]}>
        <circleGeometry args={[0.009, 20]} />
        <meshBasicMaterial color="#1a242c" />
      </mesh>
    </group>
  );
}

const MFD_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const MFD_FRAG = /* glsl */ `
  uniform sampler2D uA;
  uniform sampler2D uB;
  uniform float uMix;
  uniform float uGain;
  varying vec2 vUv;
  void main() {
    // La placa "barre" la pantalla de arriba abajo con una línea de luz, como al encender.
    float yy = 1.0 - vUv.y;
    float s = uMix * 1.24 - 0.12;
    float m = smoothstep(s + 0.012, s - 0.012, yy);
    vec3 col = mix(texture2D(uA, vUv).rgb, texture2D(uB, vUv).rgb, m);
    // x*x y no pow(x, 2.0): en D3D pow con base negativa da NaN y el bloom lo esparce.
    float dl = (yy - s) * 70.0;
    float line = exp(-dl * dl) * step(0.002, uMix) * step(uMix, 0.998);
    col += vec3(0.45, 0.95, 1.0) * line * 2.0;
    col *= 0.9 + 0.1 * sin(vUv.y * 480.0);
    gl_FragColor = vec4(col * uGain, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function Cockpit({ drive, calm }: { drive: DriveState; calm: boolean }) {
  const needleL = useRef<THREE.Mesh>(null);
  const needleR = useRef<THREE.Mesh>(null);
  const consoleTex = useMemo(() => canvasTexture(drawConsole), []);
  const mfd = useMemo(() => {
    const a = canvasTexture(drawStandby);
    const b = canvasTexture((c) => drawPlate(c));
    return new THREE.ShaderMaterial({
      uniforms: { uA: { value: a }, uB: { value: b }, uMix: { value: 0 }, uGain: { value: 1.45 } },
      vertexShader: MFD_VERT,
      fragmentShader: MFD_FRAG,
    });
  }, []);
  useEffect(() => () => mfd.dispose(), [mfd]);

  const pillars = useMemo(() => {
    const out: { a: THREE.Vector3; b: THREE.Vector3 }[] = [];
    for (const side of [-1, 1]) out.push({ a: new THREE.Vector3(side * 0.74, 0.98, -0.93), b: new THREE.Vector3(side * 0.66, 1.41, -0.19) });
    return out;
  }, []);

  useFrame(() => {
    const ch = drive.chapter;
    mfd.uniforms.uMix.value = smooth(0.25, 0.85, ch);
    if (calm) {
      if (needleL.current) needleL.current.rotation.z = 2.27 - 4.54 * 0.32;
      if (needleR.current) needleR.current.rotation.z = 2.27 - 4.54 * 0.42;
      return;
    }
    const s = drive.t;
    // Aguja izquierda: avanza como el tiempo de una canción. Derecha: "baila" a ~100 BPM y
    // salta más cuando llegan los votos (decorativo: la portada no muestra datos reales).
    const beat = Math.pow(Math.max(0, Math.sin(s * Math.PI * 1.66)), 6);
    const sub = Math.pow(Math.max(0, Math.sin(s * Math.PI * 3.32 + 0.6)), 10) * 0.35;
    if (needleL.current) needleL.current.rotation.z = 2.27 - 4.54 * (0.12 + ((s * 0.018) % 0.78));
    if (needleR.current) needleR.current.rotation.z = 2.27 - 4.54 * (0.28 + (0.3 + 0.12 * drive.vote) * (beat + sub));
  });

  return (
    <group>
      {/* Salpicadero: tapa bajo el parabrisas (detrás del cuadro) y frente hacia el conductor,
          por debajo del cuadro para no taparlo. Mate y sin metal: de noche apenas se ve. */}
      <mesh position={[0, 0.93, -0.86]}>
        <boxGeometry args={[1.64, 0.08, 0.36]} />
        <meshStandardMaterial color={DARK} roughness={1} envMapIntensity={0.15} />
      </mesh>
      <mesh position={[0, 0.58, -0.47]} rotation-x={0.35}>
        <boxGeometry args={[1.64, 0.5, 0.06]} />
        <meshStandardMaterial color="#040608" roughness={1} envMapIntensity={0.15} />
      </mesh>
      {/* Repisa entre el frente y la tapa */}
      <mesh position={[0, 0.83, -0.6]} rotation-x={0.5}>
        <boxGeometry args={[1.64, 0.02, 0.3]} />
        <meshStandardMaterial color="#05080a" roughness={1} envMapIntensity={0.15} />
      </mesh>
      {/* Tira de luz ambiente a lo largo del salpicadero y de las puertas */}
      <mesh position={[0, 0.818, -0.44]}>
        <boxGeometry args={[1.5, 0.005, 0.005]} />
        <meshBasicMaterial color={hdr(CYAN, 3)} toneMapped={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.845, 0.72, 0.02]}>
            <boxGeometry args={[0.06, 0.52, 1.7]} />
            <meshStandardMaterial color="#05080a" roughness={1} envMapIntensity={0.15} />
          </mesh>
          <mesh position={[side * 0.81, 0.93, 0.02]}>
            <boxGeometry args={[0.005, 0.005, 1.5]} />
            <meshBasicMaterial color={hdr(CYAN, 2.4)} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Cuadro de instrumentos con visera */}
      <group position={[-0.36, 0.95, -0.585]} rotation-x={-0.18}>
        <mesh position={[0, 0, -0.012]}>
          <planeGeometry args={[0.56, 0.21]} />
          <meshBasicMaterial color="#010305" />
        </mesh>
        <Dial x={-0.168} needle={needleL} />
        <Dial x={0.168} needle={needleR} />
        <mesh position={[0, -0.002, 0]} material={mfd}>
          <planeGeometry args={[0.16, 0.1]} />
        </mesh>
        {/* Marco fino de la pantalla central */}
        <mesh position={[0, -0.002, -0.0008]}>
          <planeGeometry args={[0.168, 0.108]} />
          <meshBasicMaterial color={hdr(CYAN, 0.55)} toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[-0.36, 1.062, -0.63]} rotation-x={-0.25}>
        <boxGeometry args={[0.62, 0.025, 0.22]} />
        <meshStandardMaterial color={DARK} roughness={1} envMapIntensity={0.15} />
      </mesh>
      <pointLight position={[-0.36, 0.96, -0.42]} color={CYAN} intensity={0.6} distance={1.2} decay={2} />

      {/* Pantalla del radio "flotante", girada hacia el conductor */}
      <mesh position={[0.06, 0.9, -0.6]} rotation-x={-0.22} rotation-y={-0.2}>
        <planeGeometry args={[0.25, 0.156]} />
        <meshBasicMaterial map={consoleTex} color={new THREE.Color(1.25, 1.25, 1.25)} toneMapped={false} />
      </mesh>
      <mesh position={[0.06, 0.9, -0.606]} rotation-x={-0.22} rotation-y={-0.2}>
        <planeGeometry args={[0.262, 0.168]} />
        <meshBasicMaterial color="#020406" />
      </mesh>

      {/* Volante: 38 cm de diámetro, inclinado hacia el conductor */}
      <group position={[-0.36, 0.86, -0.36]} rotation-x={-0.42}>
        <mesh>
          <torusGeometry args={[0.19, 0.017, 14, 80]} />
          <meshStandardMaterial color="#141b22" roughness={0.38} metalness={0.45} envMapIntensity={1.4} />
        </mesh>
        {/* Marca de las 12 en cian, como en los volantes deportivos */}
        <mesh position={[0, 0.19, 0.004]}>
          <boxGeometry args={[0.014, 0.022, 0.03]} />
          <meshBasicMaterial color={hdr(CYAN, 2.2)} toneMapped={false} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.1, -0.02, 0]} rotation-z={side * 0.25}>
            <boxGeometry args={[0.17, 0.028, 0.02]} />
            <meshStandardMaterial color="#0a0e12" roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[0, -0.03, 0.005]}>
          <cylinderGeometry args={[0.055, 0.06, 0.03, 24]} />
          <meshStandardMaterial color="#0c1116" roughness={0.55} metalness={0.3} />
        </mesh>
        {/* Botones retroiluminados del volante */}
        {[-1, 1].map((side) => (
          <mesh key={`b${side}`} position={[side * 0.105, -0.012, 0.012]} rotation-z={side * 0.25}>
            <planeGeometry args={[0.03, 0.012]} />
            <meshBasicMaterial color={hdr(CYAN, 1.3)} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* Pilares A y techo interior */}
      {pillars.map((p, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) placeBetween(m, p.a, p.b, 0.075);
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#010203" />
        </mesh>
      ))}
      <mesh position={[0, 1.4, 0.47]}>
        <boxGeometry args={[1.48, 0.04, 1.32]} />
        <meshBasicMaterial color="#010203" />
      </mesh>

      {/* Asientos (se ven a contraluz desde fuera) */}
      {[-0.36, 0.36].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.86, 0.68]} rotation-x={-0.12}>
            <boxGeometry args={[0.5, 0.62, 0.12]} />
            <meshStandardMaterial color="#06090c" roughness={0.9} />
          </mesh>
          <mesh position={[x, 1.26, 0.74]}>
            <boxGeometry args={[0.26, 0.16, 0.1]} />
            <meshStandardMaterial color="#06090c" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// -------------------------------------------------------- carrocería y luces

const CONE_VERT = /* glsl */ `
  varying float vAlong;
  varying float vEdge;
  void main() {
    vAlong = 1.0 - uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vEdge = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const CONE_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vAlong;
  varying float vEdge;
  void main() {
    float k = pow(clamp(1.0 - vAlong, 0.0, 1.0), 2.2) * pow(clamp(vEdge, 0.0, 1.0), 1.6) * uOpacity;
    gl_FragColor = vec4(0.8, 0.95, 1.0, k);
    #include <colorspace_fragment>
  }
`;

function Body({ drive, x }: { drive: DriveState; x: number }) {
  const body = useMemo(bodyGeometry, []);
  const gl = useThree((st) => st.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  // El perfil extruido es un sólido: su tapa a la altura de la cintura cerraría la cabina.
  // Se recorta una caja (intersección de 5 semiespacios) sobre el habitáculo: desde dentro
  // se ve el salpicadero y desde fuera la tapa la cubre el cristal.
  const clip = useMemo(
    () => [
      new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.97),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -1.45),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), -0.92),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -(x + 0.8)),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), x - 0.8),
    ],
    [x],
  );
  const glass = useMemo(glassGeometry, []);
  const roof = useMemo(roofGeometry, []);
  // Aristas del cristal: un filo de luz que dibuja las ventanillas sobre la luna tintada.
  const glassEdges = useMemo(() => new THREE.EdgesGeometry(glass, 28), [glass]);
  const plateTex = useMemo(() => canvasTexture(drawRearPlate), []);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const spin = useRef(0);
  const tailRefl = useRef<THREE.Mesh>(null);
  const halo = useMemo(() => radialTexture(128), []);
  const streak = useMemo(streakTexture, []);
  const cone = useMemo(() => {
    const g = new THREE.ConeGeometry(1.7, 14, 24, 1, true);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -7);
    return g;
  }, []);
  const coneMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: CONE_VERT,
        fragmentShader: CONE_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => coneMat.dispose(), [coneMat]);

  useFrame((_, dt) => {
    spin.current += (drive.speed * Math.min(dt, 0.05)) / 0.34;
    for (const w of wheels.current) if (w) w.rotation.x = -spin.current;
    // Los conos de luz sólo se ven desde fuera: desde la cabina lavarían la escena.
    const ch = drive.chapter;
    // Conos y reflejo rojo sólo con la cámara baja detrás del carro: desde la grúa parecen niebla.
    coneMat.uniforms.uOpacity.value = 0.03 * smooth(1.25, 1.85, ch) * (1 - smooth(2.2, 2.7, ch));
    if (tailRefl.current) tailRefl.current.visible = ch < 2.5;
  });

  const paint = <meshStandardMaterial color="#101a22" metalness={0.75} roughness={0.26} envMapIntensity={1.7} />;

  return (
    <group>
      <mesh geometry={body}>
        <meshStandardMaterial color="#101a22" metalness={0.75} roughness={0.26} envMapIntensity={1.7} clippingPlanes={clip} clipIntersection />
      </mesh>
      {/* Lunas tintadas: casi opacas y muy reflectantes, como un carro de noche */}
      <mesh geometry={glass} renderOrder={2}>
        <meshStandardMaterial color="#04090d" metalness={0.95} roughness={0.04} transparent opacity={0.82} envMapIntensity={2.6} depthWrite={false} />
      </mesh>
      <lineSegments geometry={glassEdges}>
        <lineBasicMaterial color={hdr(ICE, 0.35)} transparent opacity={0.5} toneMapped={false} />
      </lineSegments>
      <mesh geometry={roof}>{paint}</mesh>
      {/* Placa trasera: el código de la sala, como en la interfaz */}
      <mesh position={[0, 0.6, 2.145]}>
        <planeGeometry args={[0.52, 0.13]} />
        <meshBasicMaterial map={plateTex} color={new THREE.Color(1.15, 1.15, 1.15)} toneMapped={false} />
      </mesh>
      {/* Aleta de tiburón: aquí "llegan" los haces de los celulares */}
      <mesh position={[0, 1.5, 0.62]} scale={[0.05, 0.07, 0.16]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#0a1117" metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Ruedas */}
      {[
        [-0.8, -1.42],
        [0.8, -1.42],
        [-0.8, 1.32],
        [0.8, 1.32],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.34, z]} ref={(g) => void (wheels.current[i] = g)}>
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.34, 0.34, 0.24, 28]} />
            <meshStandardMaterial color="#040506" roughness={0.9} />
          </mesh>
          <mesh rotation-z={Math.PI / 2} position={[x < 0 ? -0.125 : 0.125, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.01, 6]} />
            <meshStandardMaterial color="#6f7d89" metalness={0.95} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* Faros: tiras LED hielo + barra cian (firma de CarBeat) */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.6, 0.7, -2.5]} rotation-y={side * -0.18}>
            <boxGeometry args={[0.44, 0.04, 0.03]} />
            <meshBasicMaterial color={hdr(ICE, 5)} toneMapped={false} />
          </mesh>
          <mesh position={[side * 0.6, 0.7, -2.55]} rotation-y={Math.PI}>
            <planeGeometry args={[1.3, 0.7]} />
            <meshBasicMaterial map={halo} color={hdr(ICE, 0.9)} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position={[side * 0.6, 0.75, -2.5]} geometry={cone} material={coneMat} />
          {/* Reflejo del faro en el asfalto mojado (gemelo bajo el suelo) */}
          <mesh position={[side * 0.6, -1.35, -2.5]}>
            <planeGeometry args={[0.45, 1.4]} />
            <meshBasicMaterial map={streak} color={hdr(ICE, 0.3)} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.64, -2.52]}>
        <boxGeometry args={[0.9, 0.012, 0.02]} />
        <meshBasicMaterial color={hdr(CYAN, 3)} toneMapped={false} />
      </mesh>
      {/* Charco de luz de los faros sobre la vía */}
      <mesh position={[0, 0.02, -11]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[4.5, 14]} />
        <meshBasicMaterial map={halo} color={hdr(ICE, 0.16)} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      {/* Pilotos: barra roja a lo ancho, extremos y tercera luz de freno */}
      <mesh position={[0, 0.93, 2.05]}>
        <boxGeometry args={[1.5, 0.05, 0.03]} />
        <meshBasicMaterial color={hdr(TAIL, 6)} toneMapped={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.78, 0.89, 2.03]}>
          <boxGeometry args={[0.06, 0.14, 0.04]} />
          <meshBasicMaterial color={hdr(TAIL, 6)} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 1.4, 0.9]}>
        <boxGeometry args={[0.32, 0.018, 0.02]} />
        <meshBasicMaterial color={hdr(TAIL, 4)} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.93, 2.09]}>
        <planeGeometry args={[2.0, 0.42]} />
        <meshBasicMaterial map={halo} color={hdr(TAIL, 0.5)} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* Reflejo rojo de los pilotos en el asfalto */}
      <mesh ref={tailRefl} position={[0, -1.7, 2.05]}>
        <planeGeometry args={[1.5, 1.6]} />
        <meshBasicMaterial map={streak} color={hdr(TAIL, 0.3)} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* Sombra de contacto */}
      <mesh position={[0, 0.012, -0.2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.3, 5.2]} />
        <meshBasicMaterial map={halo} color="#000000" transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------- celulares de los pasajeros

/*
 * Cuatro celulares flotan sobre el carro, cada uno unido a la aleta del techo por un haz fino.
 * En el capítulo "se suben" aparecen uno a uno y el haz se dibuja del celular al carro; en
 * "piden y votan" los pulsos viajan por los haces y al llegar abren un anillo en el techo.
 */

const HUB = new THREE.Vector3(0, 1.56, 0.62);
const PHONES = [
  new THREE.Vector3(-1.75, 2.6, 0.95),
  new THREE.Vector3(1.8, 2.9, -0.35),
  new THREE.Vector3(-0.95, 3.3, -1.9),
  new THREE.Vector3(1.1, 2.45, 2.0),
];

const BEAM_VERT = /* glsl */ `
  varying float vAlong;
  varying float vEdge;
  void main() {
    vAlong = uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vEdge = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const BEAM_FRAG = /* glsl */ `
  uniform float uDraw;
  uniform float uHead;
  uniform float uPulse;
  uniform float uBoost;
  varying float vAlong;
  varying float vEdge;
  void main() {
    if (vAlong > uDraw) discard;
    float base = 0.5;
    float dp = (vAlong - uHead) * 10.0;
    float dt = (vAlong - uDraw) * 28.0;
    float pulse = exp(-dp * dp) * uPulse;
    float tip = exp(-dt * dt) * step(uDraw, 0.995);
    float k = (base + pulse * 6.0 + tip * 5.0) * (0.35 + 0.65 * vEdge) * uBoost;
    gl_FragColor = vec4(vec3(0.35, 0.9, 1.0) * 2.4, k);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function Passengers({ drive, calm }: { drive: DriveState; calm: boolean }) {
  const phoneTex = useMemo(() => canvasTexture(drawPhone), []);
  const halo = useMemo(() => radialTexture(128), []);
  const group = useRef<THREE.Group>(null);
  const phones = useRef<(THREE.Group | null)[]>([]);
  const beams = useRef<(THREE.Mesh | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const ripples = useRef<(THREE.Mesh | null)[]>([]);
  const hubGlow = useRef<THREE.Mesh>(null);
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const beamGeo = useMemo(() => {
    // Cilindro unitario con el origen (uv.y = 0) en la base: la base va en el celular.
    const g = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const beamMats = useMemo(
    () =>
      PHONES.map(
        () =>
          new THREE.ShaderMaterial({
            uniforms: { uDraw: { value: 0 }, uHead: { value: -1 }, uPulse: { value: 0 }, uBoost: { value: 1 } },
            vertexShader: BEAM_VERT,
            fragmentShader: BEAM_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
      ),
    [],
  );
  const screenMats = useMemo(
    () => PHONES.map(() => new THREE.MeshBasicMaterial({ map: phoneTex, color: new THREE.Color(1.4, 1.4, 1.4), toneMapped: false })),
    [phoneTex],
  );
  const ringMats = useMemo(
    () => PHONES.map(() => new THREE.MeshBasicMaterial({ color: hdr(CYAN, 2.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })),
    [],
  );
  const rippleMats = useMemo(
    () => PHONES.map(() => new THREE.MeshBasicMaterial({ color: hdr(CYAN, 2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })),
    [],
  );
  useEffect(
    () => () => {
      beamMats.forEach((m) => m.dispose());
      screenMats.forEach((m) => m.dispose());
      ringMats.forEach((m) => m.dispose());
      rippleMats.forEach((m) => m.dispose());
    },
    [beamMats, screenMats, ringMats, rippleMats],
  );

  // Los primeros fotogramas se dibuja todo (a escala casi nula) para compilar sus shaders al
  // cargar y no a mitad del scroll, donde el primer dibujo costaba un tirón visible.
  const warm = useRef(0);
  useFrame(({ camera }) => {
    const ch = drive.chapter;
    const warming = warm.current < 3;
    warm.current++;
    const show = ch > 1.35 || warming;
    if (group.current) group.current.visible = show;
    if (!show) return;
    const t = drive.t;
    const vote = drive.vote;
    const far = smooth(2.2, 2.9, ch);
    let hub = 0;
    for (let i = 0; i < PHONES.length; i++) {
      const appear = smooth(1.42 + i * 0.09, 1.6 + i * 0.09, ch);
      const draw = smooth(1.55 + i * 0.09, 1.82 + i * 0.09, ch);
      const p = phones.current[i];
      if (p) {
        const bob = calm ? 0 : Math.sin(t * 1.3 + i * 1.7) * 0.07;
        // Desde la grúa se verían diminutos: crecen y se separan para seguir leyéndose.
        p.position.set(PHONES[i].x * (1 + far * 0.6), PHONES[i].y + bob + far * 1.6, PHONES[i].z * (1 + far * 0.4));
        p.scale.setScalar(Math.max(0.001, appear * (1.25 + far * 1.1)));
        p.lookAt(camera.position);
      }
      // Ciclo de voto: el pulso sale del celular (fase 0), llega al carro (0,5) y abre el anillo.
      const rate = 0.32 + 0.4 * vote;
      const cycle = calm ? 0.25 : (((t * rate + i * 0.29) % 1) + 1) % 1;
      const amp = draw >= 0.999 ? 0.3 + 0.7 * vote : 0;
      const beam = beams.current[i];
      if (beam && p) {
        tmpA.copy(p.position);
        tmpA.y -= 0.17 * appear;
        placeBetween(beam, tmpA, HUB, 0.006 + 0.012 * far);
        const m = beamMats[i];
        m.uniforms.uDraw.value = draw;
        m.uniforms.uHead.value = clamp01(cycle * 2);
        m.uniforms.uPulse.value = cycle < 0.5 ? amp : 0;
        m.uniforms.uBoost.value = 1 + far * 0.8;
      }
      screenMats[i].color.setScalar(1.2 + 2.2 * Math.exp(-cycle * 9) * amp);
      const ring = rings.current[i];
      if (ring) {
        const age = cycle >= 0.5 ? (cycle - 0.5) * 2 : 1;
        ring.scale.setScalar(0.12 + age * 0.75);
        ringMats[i].opacity = Math.pow(1 - age, 2) * amp;
        // Cada voto que llega abre una onda sobre el asfalto mojado (se ve desde la grúa).
        const rip = ripples.current[i];
        if (rip) {
          rip.visible = vote > 0.02 || warming;
          rip.scale.setScalar(0.6 + age * 7.5);
          rippleMats[i].opacity = Math.pow(1 - age, 1.6) * amp * vote * 0.9;
        }
        hub = Math.max(hub, (1 - age) * amp);
      }
    }
    if (hubGlow.current) hubGlow.current.scale.setScalar(0.035 + hub * 0.03);
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={hubGlow} position={HUB}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color={hdr(CYAN, 4)} toneMapped={false} />
      </mesh>
      {PHONES.map((_, i) => (
        <group key={i}>
          <group ref={(g) => void (phones.current[i] = g)}>
            {/* Cuerpo, pantalla y halo (el halo da brillo también sin posprocesado) */}
            <mesh position={[0, 0, -0.008]}>
              <boxGeometry args={[0.17, 0.33, 0.014]} />
              <meshStandardMaterial color="#0a1015" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh material={screenMats[i]}>
              <planeGeometry args={[0.15, 0.3]} />
            </mesh>
            <mesh position={[0, 0, -0.02]}>
              <planeGeometry args={[0.6, 0.78]} />
              <meshBasicMaterial map={halo} color={hdr(CYAN, 0.4)} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </mesh>
          </group>
          <mesh ref={(m) => void (beams.current[i] = m)} geometry={beamGeo} material={beamMats[i]} frustumCulled={false} />
          <mesh ref={(m) => void (rings.current[i] = m)} position={HUB} rotation-x={-Math.PI / 2} material={ringMats[i]}>
            <ringGeometry args={[0.92, 1, 48]} />
          </mesh>
          <mesh ref={(m) => void (ripples.current[i] = m)} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} material={rippleMats[i]} visible={false}>
            <ringGeometry args={[0.95, 1, 72]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------- carro

export function Car({ drive, calm, x }: { drive: DriveState; calm: boolean; x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <Body drive={drive} x={x} />
      <Cockpit drive={drive} calm={calm} />
      <Passengers drive={drive} calm={calm} />
    </group>
  );
}
