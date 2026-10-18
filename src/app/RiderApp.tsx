import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Gauge as GaugeIcon, HardDrive, ListMusic, LogOut, Search } from 'lucide-react';
import { scoreOf } from '../../shared/protocol';
import type { Track } from '../../shared/track';
import { getDisplayName } from '../core/room/identity';
import { useRiderSession } from '../hooks';
import { Toasts, formatTime } from '../ui/controls';
import { Odometer } from '../ui/kit';
import { LibraryList, QueueList, SearchPanel, Tag } from '../ui/music';
import { Plate } from '../ui/Plate';
import { PlayLamp, RadioTitle, StatusChip, Transport, carTrack, pickStateFor, usePosition } from '../ui/rider-parts';
import { CoverDial } from '../ui/rider/CoverDial';
import { FlightLayer, launchFlight, useBump } from '../ui/rider/Flight';
import { useInView } from '../ui/rider/useInView';
import { RiderGate } from '../ui/RiderGate';
import { native } from './native';

/*
 * Modo pasajero del APK: navegación de app (barra de pestañas abajo, al alcance del pulgar),
 * vibración al pedir y votar, y botón atrás de Android que vuelve a "Ahora".
 */

type Tab = 'ahora' | 'buscar' | 'cola' | 'carro';
const ORDER: Tab[] = ['ahora', 'buscar', 'cola', 'carro'];

type View = NonNullable<ReturnType<typeof useRiderSession>['view']>;
type Session = NonNullable<ReturnType<typeof useRiderSession>['session']>;

export function RiderApp({ room, onLeave }: { room: string; onLeave: () => void }) {
  const [name] = useState(getDisplayName);
  const { session, view } = useRiderSession(room, name || 'Pasajero');
  const [tab, setTab] = useState<Tab>('ahora');
  const [dir, setDir] = useState(1);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const reduce = useReducedMotion();
  const colaRef = useRef<HTMLSpanElement>(null);
  const ahoraRef = useRef<HTMLSpanElement>(null);
  const [badge, bump] = useBump();
  const onLand = useCallback(
    (el: Element | null) => {
      if (el === colaRef.current) bump();
      void native.haptic('success');
    },
    [bump],
  );

  const go = useCallback((t: Tab) => {
    // Las páginas entran desde el lado de la pestaña: se sabe hacia dónde se movió uno.
    setDir(ORDER.indexOf(t) >= ORDER.indexOf(tabRef.current) ? 1 : -1);
    setTab(t);
  }, []);

  useEffect(
    () =>
      native.onBack(() => {
        if (tabRef.current !== 'ahora') {
          go('ahora');
          return true;
        }
        return false; // en "Ahora", atrás minimiza la app sin bajarse del carro
      }),
    [go],
  );

  // Vibración cuando el carro confirma o rechaza algo.
  const lastToast = useRef<string | null>(null);
  useEffect(() => {
    const t = view?.toasts[0];
    if (t && t.id !== lastToast.current) {
      lastToast.current = t.id;
      void native.haptic('warn');
    }
  }, [view?.toasts]);

  if (!session || !view) return null;
  const snap = view.snapshot;
  const library = view.library?.items ?? [];
  const stateOf = pickStateFor(view, snap);

  const tabs: { id: Tab; label: string; icon: typeof Search; n?: number }[] = [
    { id: 'ahora', label: 'Ahora', icon: GaugeIcon },
    { id: 'buscar', label: 'Buscar', icon: Search },
    { id: 'cola', label: 'Cola', icon: ListMusic, n: snap?.queue.length ?? 0 },
    ...(library.length ? [{ id: 'carro' as Tab, label: 'Del carro', icon: HardDrive, n: library.length }] : []),
  ];

  const leave = () => {
    void native.haptic('tap');
    session.leave();
    onLeave();
  };

  const request = (t: Track, from?: Element) => {
    // Toque al pulsar; la vibración de "hecho" llega cuando la portada cae en la cola.
    void native.haptic('tap');
    launchFlight(from, t.coverUrl);
    void session.request(t);
  };

  const slide = reduce ? 0 : 28;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[radial-gradient(120%_45%_at_50%_0%,#0b1d26,transparent_70%),var(--color-asphalt)]">
      <Toasts items={view.toasts} onDismiss={(id) => session.dismissToast(id)} />
      {/* Si no suena nada, lo pedido sonará ya: la portada va a "Ahora"; si no, a la cola. */}
      <FlightLayer target={() => (view.snapshot?.now ? colaRef.current : ahoraRef.current)} onLand={onLand} />

      <header className="flex items-center gap-3 px-4 pt-[calc(var(--sat)+12px)] pb-3">
        <Plate code={room} size="sm" />
        <StatusChip view={view} />
        <button type="button" onClick={leave} aria-label="Bajarme del carro" className="press ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-dim">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <RiderGate view={view} onExit={leave}>
        <main data-scroller className="scroll-slim min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-6">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={tab}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * slide }),
                center: { opacity: 1, x: 0 },
                // Salida corta: con mode="wait" la página nueva espera a que se vaya la anterior.
                leave: (d: number) => ({ opacity: 0, x: d * -slide * 0.6, transition: { duration: 0.13 } }),
              }}
              initial="enter"
              animate="center"
              exit="leave"
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {tab === 'ahora' && <NowPage view={view} session={session} onOpenQueue={() => go('cola')} />}
              {tab === 'buscar' && <SearchPanel onPick={request} stateOf={stateOf} />}
              {tab === 'cola' && (
                <QueueList
                  queue={snap?.queue ?? []}
                  me={view.me}
                  onVote={(q, v) => {
                    void native.haptic('select');
                    void session.vote(q, v);
                  }}
                  empty={<p className="text-dim">La cola está vacía. Pide algo en «Buscar».</p>}
                />
              )}
              {tab === 'carro' && <LibraryList items={library} onPick={(i, from) => request(carTrack(i), from)} stateOf={(i) => stateOf(carTrack(i))} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Barra de pestañas: teclas del volante, con la activa retroiluminada */}
        <nav
          className="relative grid border-t border-white/[0.06] bg-[linear-gradient(180deg,#0a0f13,#05070a)] pb-[var(--sab)] shadow-[0_-12px_30px_-12px_rgb(0_0_0/0.9)]"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
          aria-label="Secciones"
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                aria-label={t.n !== undefined ? `${t.label}, ${t.n} canciones` : t.label}
                onClick={() => {
                  void native.haptic('select');
                  go(t.id);
                }}
                className={`press relative flex h-16 flex-col items-center justify-center gap-1 ${active ? 'text-ice' : 'text-faint'}`}
              >
                {active && (
                  <motion.span
                    layoutId="tabbar-glow"
                    className="absolute inset-x-3 top-0 h-full rounded-b-2xl bg-[radial-gradient(80%_70%_at_50%_0%,rgb(34_211_238/0.16),transparent_75%)]"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  >
                    <span className="absolute top-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-cyan shadow-[0_0_12px_rgb(34_211_238/0.9)]" />
                  </motion.span>
                )}
                <span ref={t.id === 'cola' ? colaRef : t.id === 'ahora' ? ahoraRef : undefined} className="relative">
                  <t.icon className="h-6 w-6" strokeWidth={active ? 2.2 : 1.7} style={active ? { filter: 'drop-shadow(0 0 6px rgb(34 211 238 / 0.7))' } : undefined} />
                  {t.n !== undefined && (t.n > 0 || t.id === 'cola') && (
                    <span
                      ref={t.id === 'cola' ? badge : undefined}
                      className={`readout absolute -top-2 -right-3.5 inline-flex min-w-[1.15rem] justify-center rounded-full px-1 py-px text-[0.68rem] leading-none font-bold ${t.n ? 'bg-cyan text-asphalt shadow-[0_0_10px_rgb(34_211_238/0.7)]' : 'bg-bezel text-faint'}`}
                      aria-hidden="true"
                    >
                      <Odometer value={t.n} />
                    </span>
                  )}
                </span>
                <span className="font-display text-[0.7rem] font-semibold tracking-[0.12em] uppercase">{t.label}</span>
              </button>
            );
          })}
        </nav>
      </RiderGate>
    </div>
  );
}

/** Ancho disponible para el dial: el de la ventana, sin pasarse en tablets. */
function useDialSize() {
  const calc = () => Math.max(220, Math.min(300, window.innerWidth - 84));
  const [size, setSize] = useState(calc);
  useEffect(() => {
    const on = () => setSize(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

function NowPage({ view, session, onOpenQueue }: { view: View; session: Session; onOpenQueue: () => void }) {
  const snap = view.snapshot;
  const now = snap?.now ?? null;
  const dialBox = useRef<HTMLDivElement>(null);
  // Si se baja hasta la cola, el dial sale de la vista y deja de repintarse cada medio segundo.
  const position = usePosition(view, session, useInView(dialBox));
  const size = useDialSize();
  const next = snap?.queue.slice(0, 3) ?? [];
  const tap = useCallback(() => void native.haptic('tap'), []);

  return (
    <div className="flex flex-col items-center gap-4 pt-1">
      <div ref={dialBox} className="relative">
        {/* Halo de retroiluminación detrás del dial */}
        <span className="pointer-events-none absolute inset-[-12%] rounded-full bg-[radial-gradient(circle,rgb(34_211_238/0.14),transparent_62%)]" aria-hidden="true" />
        <CoverDial track={now?.track ?? null} position={position} duration={now?.duration ?? 0} playing={!!now?.isPlaying} size={size} showTime={!!now} />
      </div>

      <div className="flex w-full flex-col items-center gap-2 text-center">
        <p className="label-cluster flex items-center gap-2 text-cyan-soft/85">
          {now ? (
            <>
              <PlayLamp playing={now.isPlaying} /> {now.isPlaying ? 'Sonando en el carro' : 'En pausa'}
            </>
          ) : (
            'Cabina en silencio'
          )}
        </p>
        <RadioTitle big as="h1" title={now ? now.track.title : 'Silencio en la cabina'} />
        {now ? (
          <>
            <p className="text-lg text-dim">{now.track.artist}</p>
            {now.requestedBy && <Tag tone={now.requestedBy === 'Piloto automático' ? 'go' : 'cyan'}>{now.requestedBy}</Tag>}
          </>
        ) : (
          <p className="text-dim">Pide la primera canción en «Buscar»: sonará al instante.</p>
        )}
      </div>

      {now && (
        <div className="py-1">
          <Transport view={view} session={session} onTap={tap} />
        </div>
      )}

      {next.length > 0 && (
        <button type="button" onClick={onOpenQueue} className="press dash-panel w-full rounded-2xl p-4 text-left">
          <span className="mb-2 flex items-center justify-between">
            <span className="label-cluster text-cyan-soft/85">Siguiente en la cola</span>
            <span className="label-cluster text-dim">Ver todo →</span>
          </span>
          <ol className="flex flex-col gap-2">
            {next.map((e, i) => (
              <li key={e.queueId} className="flex items-center gap-3">
                <span className="dotmatrix w-5 text-center text-lg leading-none opacity-80">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{e.track.title}</span>
                  <span className="block truncate text-xs text-faint">
                    {e.track.artist} · {formatTime(e.track.duration)}
                  </span>
                </span>
                <span className={`readout text-sm font-bold ${scoreOf(e) > 0 ? 'text-ice' : scoreOf(e) < 0 ? 'text-danger' : 'text-faint'}`}>
                  {scoreOf(e) !== 0 && <span className="font-sans">{scoreOf(e) > 0 ? '+' : '−'}</span>}
                  {Math.abs(scoreOf(e))}
                </span>
              </li>
            ))}
          </ol>
        </button>
      )}
      <p className="text-sm text-faint">
        {snap?.riders.length ?? 0} a bordo · vas como <span className="text-dim">{view.name}</span>
      </p>
    </div>
  );
}
