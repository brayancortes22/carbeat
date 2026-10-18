import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { MotionValue } from 'motion/react';
import { Car } from './drive/Car';
import { Rig } from './drive/Rig';
import { Moon, Mountains, NightEnvironment, Rain, Road, Sky, Stars, Traffic } from './drive/World';
import { TrafficCars } from './drive/TrafficCars';
import { LANE_X, ROAD_LEN, damp, makeDrive, makeUniforms, smooth } from './drive/shared';

/*
 * Escena de portada: conducir de noche. La página le pasa el capítulo de la historia (0..3,
 * un MotionValue del scroll) y la cámara viaja por él: cabina → cuadro con la placa → vista
 * exterior con los celulares conectados → autopista con estelas mientras llegan los votos.
 *
 * Todo es geometría procedural: ni modelos ni texturas que descargar.
 * Rendimiento: tráfico, lluvia y haces calculados en la GPU; postes y líneas instanciados;
 * DPR ≤ 1,5; posprocesado en un trozo aparte que el modo ligero (celular) no descarga; y el
 * bucle se detiene fuera de pantalla, con la pestaña oculta o con movimiento reducido.
 */

const Effects = lazy(() => import('./drive/Effects'));

/*
 * three r186 guarda la LUT DFG de los materiales PBR en un singleton de módulo, y cada renderer
 * que la sube le cuelga un listener de «dispose» que renderer.dispose() no quita. Ese listener
 * retenía el renderer entero (contexto, lienzo y texturas de canvas): uno más por cada ida y
 * vuelta a la cabina (medido en heap snapshots). Liberar la LUT al desmontar dispara el listener,
 * que se quita solo; el siguiente renderer la vuelve a subir. No es exportada: se lee del uniform.
 */
let dfgLUT: THREE.Texture | null = null;

function ReleaseDFGLUT() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  // De layout y primer hijo del lienzo: su limpieza corre antes de que React saque (y libere)
  // los materiales de la escena, que es de donde se lee la LUT.
  useLayoutEffect(
    () => () => {
      if (!dfgLUT) {
        scene.traverse((o) => {
          const m = (o as THREE.Mesh).material;
          for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
            if (dfgLUT || !gl.properties.has(mat)) continue;
            const p = gl.properties.get(mat) as { uniforms?: { dfgLUT?: { value: THREE.Texture | null } } };
            dfgLUT = p.uniforms?.dfgLUT?.value ?? null;
          }
        });
      }
      dfgLUT?.dispose();
    },
    [gl, scene],
  );
  return null;
}

function Scene({ chapter, lite, calm }: { chapter?: MotionValue<number>; lite: boolean; calm: boolean }) {
  const drive = useMemo(makeDrive, []);
  const u = useMemo(makeUniforms, []);
  const invalidate = useThree((s) => s.invalidate);

  // Con movimiento reducido no hay bucle: cada cambio de capítulo pide un único fotograma
  // (la cámara salta de encuadre en encuadre, sin desplazarse).
  useEffect(() => {
    if (!calm || !chapter) return;
    let last = -1;
    return chapter.on('change', (v) => {
      const r = Math.round(v);
      if (r !== last) {
        last = r;
        invalidate();
      }
    });
  }, [calm, chapter, invalidate]);

  // Director: corre antes que el resto (prioridad −1) y deja el estado listo para el fotograma.
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    // En desarrollo: window.__nightDrive.chapter fija el capítulo (capturas y depuración) y
    // window.__nightDriveFrames cuenta fotogramas dibujados (para medir FPS de la escena y no
    // sólo de la página). En producción import.meta.env.DEV es false y esto desaparece.
    const w = window as unknown as { __nightDrive?: { chapter?: number }; __nightDriveFrames?: number };
    if (import.meta.env.DEV) w.__nightDriveFrames = (w.__nightDriveFrames ?? 0) + 1;
    const dbg = import.meta.env.DEV ? w.__nightDrive : undefined;
    const target = dbg?.chapter ?? (chapter ? chapter.get() : 0);
    drive.chapter = calm ? Math.round(target) : damp(drive.chapter, target, 5, dt);
    if (!calm) drive.t += dt;
    drive.vote = smooth(2.25, 2.9, drive.chapter);
    drive.trails = smooth(2.3, 2.95, drive.chapter);
    drive.speed = 19 + 7 * drive.trails;
    if (!calm) drive.dist = (drive.dist + drive.speed * dt) % (ROAD_LEN * 1000);
    const t = drive.t;
    // Curvas suaves que cambian despacio; junto al carro la vía siempre es recta (x = k·z²).
    // En la historia la curva se asienta para el encuadre: a la derecha en la persecución
    // (la tarjeta va a la izquierda) y a la izquierda en la autopista (tarjeta a la derecha).
    const free = 0.0007 * Math.sin(t * 0.085 + 0.6) + 0.00035 * Math.sin(t * 0.031 + 1.3);
    const toChase = smooth(1.35, 2.0, drive.chapter);
    const toHighway = smooth(2.2, 2.9, drive.chapter);
    const curveTarget = (free * (1 - toChase) + 0.00045 * toChase) * (1 - toHighway) - 0.0006 * toHighway;
    drive.curve = calm ? curveTarget : damp(drive.curve, curveTarget, 1.6, dt);
    u.uTime.value = t;
    u.uTravel.value = drive.dist;
    u.uSpeed.value = drive.speed;
    u.uCurve.value = drive.curve;
    u.uTrail.value = drive.trails * 0.8;
    u.uVote.value = drive.vote;
    u.uExterior.value = smooth(1.25, 1.75, drive.chapter);
  }, -1);

  return (
    <>
      <color attach="background" args={['#020407']} />
      <fog attach="fog" args={['#03101a', 40, 240]} />
      <ambientLight intensity={0.22} />
      <hemisphereLight args={['#1b4b5c', '#020305', 0.45]} />
      {/* Luz de luna a contraluz: perfila la carrocería en la vista exterior */}
      <directionalLight position={[60, 40, -120]} intensity={0.9} color="#9fe8ff" />
      <directionalLight position={[-30, 20, 60]} intensity={0.25} color="#22d3ee" />
      {/* Luz desde detrás de la cámara de persecución: dibuja la zaga del carro */}
      <directionalLight position={[20, 25, 80]} intensity={0.55} color="#a9e9ff" />
      <NightEnvironment />
      <Sky />
      <Stars count={lite ? 450 : 750} />
      <Moon />
      <Mountains />
      <Road drive={drive} />
      <Traffic u={u} lite={lite} />
      <TrafficCars u={u} lite={lite} />
      <Rain u={u} count={lite ? 450 : 900} carX={LANE_X} />
      <Car drive={drive} calm={calm} x={LANE_X} />
      <Rig drive={drive} carX={LANE_X} calm={calm} />
    </>
  );
}

export type NightDriveProps = {
  className?: string;
  /** Capítulo de la historia (0..3), normalmente derivado del scroll. Sin él, se queda en la cabina. */
  chapter?: MotionValue<number>;
  /** Modo ligero (celulares): sin posprocesado y con menos partículas. */
  lite?: boolean;
  /** false cuando la página la tapa (p. ej. pasada la historia): deja de dibujar. */
  active?: boolean;
};

export default function NightDrive({ className = '', chapter, lite = false, active = true }: NightDriveProps) {
  const host = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [calm] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const running = active && onScreen && tabVisible && !calm;

  return (
    <div ref={host} className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={running ? 'always' : 'demand'}
        camera={{ fov: 56, near: 0.03, far: 900, position: [LANE_X - 0.08, 1.18, 0.32] }}
        // Con posprocesado el antialiasing lo hace el compositor (MSAA x4): el lienzo no lo necesita.
        gl={{ antialias: lite, powerPreference: 'high-performance', stencil: false }}
      >
        <ReleaseDFGLUT />
        <Scene chapter={chapter} lite={lite} calm={calm} />
        {!lite && (
          <Suspense fallback={null}>
            <Effects />
          </Suspense>
        )}
      </Canvas>
    </div>
  );
}
