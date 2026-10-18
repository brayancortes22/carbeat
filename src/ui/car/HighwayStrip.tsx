import { Component, lazy, memo, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import type { QueueEntry } from '../../../shared/protocol';
import type { HighwaySign } from '../three/QueueHighway';
import { TtIcon } from '../Telltale';
import './car.css';

/*
 * Parabrisas de la cabina: la «Autopista de la cola» en 3D (se descarga sólo si está
 * encendida) con un HUD encima. Si el 3D no está disponible (sin WebGL, ahorro de datos, error)
 * se ven los mismos letreros en plano: la información nunca depende del 3D.
 */

const QueueHighway = lazy(() => import('../three/QueueHighway'));

const SLOT_LABEL = ['Siguiente', 'Después', 'Más adelante'];

function etaLabel(sec: number): string {
  const m = Math.round(sec / 60);
  return m < 1 ? 'EN <1 MIN' : `EN ${m} MIN`;
}

/**
 * Letreros de las próximas 3. La llegada estimada sale de duraciones reales (lo que le queda
 * a la canción actual + lo que duran las anteriores); si alguna duración no se conoce, a partir
 * de ahí no se muestra: mejor sin dato que un dato inventado.
 */
export function buildSigns(queue: QueueEntry[], remaining: number | null): HighwaySign[] {
  if (!queue.length) return [{ id: 'vacia', title: 'Cola libre', artist: 'Pide desde tu celular', empty: true }];
  let acc = remaining !== null && remaining > 0 ? remaining : null;
  return queue.slice(0, 3).map((e) => {
    const sign: HighwaySign = {
      id: e.queueId,
      title: e.track.title,
      artist: e.track.artist,
      by: e.autopilot ? undefined : e.requestedBy,
      autopilot: e.autopilot,
      eta: acc !== null ? etaLabel(acc) : undefined,
    };
    acc = acc !== null && e.track.duration > 0 ? acc + e.track.duration : null;
    return sign;
  });
}

/** Mantiene la misma referencia mientras el contenido no cambie: el 3D no se reconcilia cada segundo. */
function useStableSigns(signs: HighwaySign[]): HighwaySign[] {
  const ref = useRef<{ key: string; value: HighwaySign[] }>({ key: '', value: signs });
  const key = JSON.stringify(signs);
  if (key !== ref.current.key) ref.current = { key, value: signs };
  return ref.current.value;
}

function canAfford3D(): boolean {
  const c = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  return !c?.saveData;
}

class Guard extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn('[CarBeat] la autopista 3D no arrancó; se muestran los letreros en plano:', error.message);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// El lienzo 3D sólo se vuelve a pintar si cambian los letreros o la marcha, no con cada
// segundo de la canción (que sí re-renderiza la cabina).
const Scene = memo(function Scene({ signs, moving, calm }: { signs: HighwaySign[]; moving: boolean; calm: boolean }) {
  return <QueueHighway signs={signs} moving={moving} calm={calm} className="absolute inset-0" />;
});

/** Los mismos letreros, en plano (sin WebGL, cargando, o si el 3D falla). */
function FlatSigns({ signs }: { signs: HighwaySign[] }) {
  return (
    <div className="absolute inset-0 flex items-start justify-center gap-[2%] bg-[radial-gradient(120%_90%_at_60%_100%,#0b2a35,#03080c_70%)] px-[6%] pt-[4%]" aria-hidden="true">
      {signs.map((s, i) => (
        <div
          key={s.id}
          className={`hw-flat-sign min-w-0 rounded-[10px] border-2 px-3 py-1.5 ${i === 0 ? 'flex-[1.4]' : 'mt-[3%] flex-1 opacity-80'} ${s.autopilot ? 'border-[#e8fff6]/90 bg-[linear-gradient(180deg,#0f6046,#073a2a)]' : s.empty ? 'border-cyan/60 bg-[linear-gradient(180deg,#0c1d26,#061017)]' : 'border-[#f0fdff]/90 bg-[linear-gradient(180deg,#0d4a5c,#062b37)]'}`}
        >
          <p className="font-display text-[0.6rem] font-bold tracking-[0.2em] text-cyan-soft uppercase">{s.empty ? 'Autopista de la cola' : SLOT_LABEL[i]}</p>
          <p className="truncate font-display text-base leading-tight font-extrabold text-white uppercase [font-stretch:80%]">{s.title}</p>
          <p className="truncate text-xs text-[#b6eef7]">{s.empty ? 'Pide desde tu celular' : s.artist}</p>
        </div>
      ))}
    </div>
  );
}

export function HighwayStrip({
  queue,
  remaining,
  moving,
  className = '',
  hud,
}: {
  queue: QueueEntry[];
  /** Segundos que le quedan a la canción actual (null si no se sabe). */
  remaining: number | null;
  /** La carretera avanza mientras suena música; en pausa el carro se detiene. */
  moving: boolean;
  className?: string;
  /** Capa de HUD encima del parabrisas (testigos, hora, placa…). */
  hud?: ReactNode;
}) {
  const reduce = !!useReducedMotion();
  const signs = useStableSigns(buildSigns(queue, remaining));
  const flat = <FlatSigns signs={signs} />;

  // Cuando el primer letrero se va (empieza la siguiente canción), su luz barre el cristal al
  // pasar por encima: el reflejo llega cuando el pórtico cruza sobre la cámara.
  // Sólo si el primero SALIÓ de la cola: si los votos lo bajan a segundo, retrocede en el 3D
  // y no pasa por encima de nadie.
  const head = signs[0]?.id;
  const prevHead = useRef(head);
  const [pass, setPass] = useState(0);
  useEffect(() => {
    const was = prevHead.current;
    prevHead.current = head;
    if (was && was !== head && was !== 'vacia' && !reduce && !signs.some((s) => s.id === was)) setPass((n) => n + 1);
  }, [head, signs, reduce]);

  return (
    <section className={`hw-windshield relative isolate overflow-hidden ${className}`} aria-label="Autopista de la cola: próximas canciones">
      {canAfford3D() ? (
        <Guard fallback={flat}>
          <Suspense fallback={flat}>
            <Scene signs={signs} moving={moving} calm={reduce} />
          </Suspense>
        </Guard>
      ) : (
        flat
      )}
      {/* Cristal: viñeta en los bordes, reflejo diagonal y el techo oscureciendo arriba. */}
      <div className="hw-glass pointer-events-none absolute inset-0" aria-hidden="true" />
      {pass > 0 && <span key={pass} className="hw-pass pointer-events-none absolute inset-0" aria-hidden="true" />}
      {hud && <div className="absolute inset-0 z-10">{hud}</div>}
      <ol className="sr-only">
        {signs.map((s, i) =>
          s.empty ? (
            <li key={s.id}>Cola libre: pide desde tu celular.</li>
          ) : (
            <li key={s.id}>
              {SLOT_LABEL[i]}: {s.title}, de {s.artist}
              {s.autopilot ? ', elegida por el piloto automático' : s.by ? `, la pidió ${s.by}` : ''}
              {s.eta ? `, ${s.eta.toLowerCase()}` : ''}.
            </li>
          ),
        )}
      </ol>
    </section>
  );
}

/** Rótulo del parabrisas: «AUTOPISTA DE LA COLA» con el número de canciones en espera. */
export function HighwayTag({ count }: { count: number }) {
  return (
    <span className="hw-tag inline-flex items-center gap-2 rounded-full border border-cyan/20 bg-[#03080c]/80 px-2.5 py-1">
      <span className="text-cyan [&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden="true">
        <TtIcon.Cruise />
      </span>
      <span className="label-cluster hidden text-[0.6rem] text-cyan-soft/90 sm:inline">Autopista de la cola</span>
      <span className="sr-only sm:hidden">Canciones en la cola:</span>
      <span className="readout text-sm font-bold text-ice">{count}</span>
    </span>
  );
}
