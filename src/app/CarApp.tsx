import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ListMusic, Moon, Music2, Power, QrCode, Search, Settings2, Share2, SlidersHorizontal, X } from 'lucide-react';
import type { Notice } from '../../shared/protocol';
import { globalAudioEngine } from '../core/audio/audio-player';
import { useBackgroundPlayback } from '../core/audio/background-playback';
import { carLibrary } from '../core/library';
import { useHostSession, useLibrary, usePlayer, useTicker } from '../hooks';
import { Cluster } from '../ui/Cluster';
import { Key, Toasts } from '../ui/controls';
import { CarMusicPanel, DriveModesPanel, HostQueuePanel } from '../ui/host-panels';
import { Ignition } from '../ui/Ignition';
import { InviteCard, joinUrl } from '../ui/Invite';
import { useNightDim } from '../ui/kit';
import { SearchPanel, keyOf } from '../ui/music';
import { Plate } from '../ui/Plate';
import { StartButton } from '../ui/StartButton';
import { TripComputer, queueSeconds } from '../ui/TripComputer';
import { Wordmark } from '../ui/Wordmark';
import { CabinClock, TelltaleBar, useCabinIgnition, useMediaQuery } from '../ui/car/cabin';
import { HighwayStrip, HighwayTag } from '../ui/car/HighwayStrip';
import { useHighwayPref } from '../ui/car/highway-pref';
import { ScreenOffLayer, useScreenOff } from '../ui/useScreenOff';
import { native } from './native';

/*
 * Modo carro del APK: no es la página web metida en una app.
 * - Pantalla completa (sin barras de Android), siempre encendida y en horizontal.
 * - Riel de botones grandes a la IZQUIERDA (lado del conductor en Colombia).
 * - Arriba el parabrisas (la autopista de la cola) con el HUD encima; debajo el cuadro, que
 *   se ajusta al alto que quede: cabe en un teléfono en horizontal (997×448) y en una tablet.
 * - Los paneles se deslizan sobre el cuadro en vez de encogerlo.
 * - Vibración en cada pulsación y botón atrás de Android con sentido.
 */

type Panel = 'cola' | 'buscar' | 'musica' | 'modos' | 'invitar' | null;

const RAIL: { id: Exclude<Panel, null>; label: string; icon: typeof Search }[] = [
  { id: 'cola', label: 'Cola', icon: ListMusic },
  { id: 'buscar', label: 'Buscar', icon: Search },
  { id: 'musica', label: 'Música', icon: Music2 },
  { id: 'modos', label: 'Modos', icon: SlidersHorizontal },
  { id: 'invitar', label: 'Invitar', icon: QrCode },
];

const TITLES: Record<Exclude<Panel, null>, string> = {
  cola: 'Cola del viaje',
  buscar: 'Buscar música',
  musica: 'Música del carro',
  modos: 'Modos de manejo',
  invitar: 'Subir pasajeros',
};

export function CarApp({ room, onSwitchRole }: { room: string; onSwitchRole: () => void }) {
  const [running, setRunning] = useState(false);
  if (!running) return <StartScreen onStart={() => setRunning(true)} onSwitchRole={onSwitchRole} />;
  return <Cabin room={room} onOff={() => setRunning(false)} />;
}

function StartScreen({ onStart, onSwitchRole }: { onStart: () => void; onSwitchRole: () => void }) {
  return (
    <div className="safe-pad relative flex min-h-dvh flex-col items-center justify-center gap-10 overflow-hidden bg-[radial-gradient(60%_60%_at_50%_55%,#0d2a36,#020407_75%)] px-6">
      <div className="absolute top-[calc(var(--sat)+20px)] left-6">
        <Wordmark />
      </div>
      <button type="button" onClick={onSwitchRole} aria-label="Cambiar modo del dispositivo" className="press absolute top-[calc(var(--sat)+16px)] right-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/8 text-dim">
        <Settings2 className="h-5 w-5" />
      </button>
      <StartButton
        size={220}
        label="Encender"
        sub="la cabina"
        onStart={() => {
          void native.haptic('success');
          onStart();
        }}
      />
      <p className="max-w-sm text-center text-dim">Al encender, esta pantalla queda en horizontal y sin barras. Cuando quieras oscurecerla, usa el botón de la luna: la música sigue sonando.</p>
    </div>
  );
}

function Cabin({ room, onOff }: { room: string; onOff: () => void }) {
  const { session, view } = useHostSession(room, 'Carro');
  const player = usePlayer();
  useBackgroundPlayback(session, player);
  const { off: screenOff, sleep, wake } = useScreenOff();
  const lib = useLibrary();
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [toasts, setToasts] = useState<Notice[]>([]);
  const seen = useRef(new Set<string>());
  const now = useTicker(30_000);
  const [startedAt] = useState(() => Date.now());
  const [played, setPlayed] = useState(0);
  const lastTrack = useRef<string | null>(null);
  const { showIgnition, ignition, onIgnitionDone } = useCabinIgnition();
  const [highway] = useHighwayPref();
  // Teléfono en horizontal (alto corto): todo más compacto para que el cuadro quepa.
  const short = useMediaQuery('(max-height: 560px)');
  useNightDim();

  useEffect(() => {
    void native.carMode(true);
    return () => void native.carMode(false);
  }, []);

  useEffect(() => {
    const id = player.currentTrack?.id ?? null;
    if (id && id !== lastTrack.current && player.isPlaying) {
      lastTrack.current = id;
      setPlayed((n) => n + 1);
    }
  }, [player.currentTrack, player.isPlaying]);

  useEffect(() => {
    if (!view) return;
    const fresh = view.notices.filter((n) => n.to === '*' && !seen.current.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => seen.current.add(n.id));
    setToasts((t) => [...fresh, ...t].slice(0, 3));
  }, [view]);

  // Atrás de Android: despierta la pantalla, cierra el panel o pregunta antes de apagar.
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const screenOffRef = useRef(screenOff);
  screenOffRef.current = screenOff;

  // Cajón accesible: al abrir, el foco va a «Cerrar»; Escape lo cierra (teclado o mando del
  // carro). La revisión encontró que el lector de pantalla seguía navegando por detrás.
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!panel) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);
  useEffect(
    () =>
      native.onBack(() => {
        if (screenOffRef.current) {
          wake();
          return true;
        }
        if (panelRef.current) {
          setPanel(null);
          return true;
        }
        setConfirmOff(true);
        return true;
      }),
    [wake],
  );

  const open = (p: Panel) => {
    void native.haptic('select');
    setPanel((cur) => (cur === p ? null : p));
  };
  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const queue = view?.engine.queue;
  const queuedKeys = useMemo(() => new Set(queue?.map((e) => keyOf(e.track)) ?? []), [queue]);

  // Siempre en la misma posición del árbol: así no se reinicia al pasar de «encendiendo» a la cabina.
  const ignitionLayer = showIgnition && <Ignition onDone={onIgnitionDone} />;

  if (!view || !session) {
    return (
      <>
        {ignitionLayer}
        {screenOff && <ScreenOffLayer onWake={wake} />}
        <div className="flex min-h-dvh items-center justify-center label-cluster animate-pulse text-cyan-soft">Encendiendo la cabina…</div>
      </>
    );
  }

  const riders = Object.keys(view.engine.riders).length;
  const tap = (fn: () => void) => () => {
    void native.haptic('tap');
    fn();
  };
  const remaining = player.currentTrack && player.duration > 0 ? player.duration - player.currentTime : null;

  const turnOff = async () => {
    setConfirmOff(false);
    await session.close();
    onOff();
  };

  // HUD del parabrisas (o barra superior si la autopista está apagada).
  const hud = (
    <div className={`flex items-center gap-3 ${short ? 'p-2' : 'p-3'}`}>
      <TelltaleBar view={view} />
      {highway && !short && <HighwayTag count={view.engine.queue.length} />}
      <CabinClock now={now} className={`ml-auto [text-shadow:0_1px_8px_rgb(0_0_0/0.9)] ${short ? 'text-2xl' : 'text-3xl'}`} />
      <button
        type="button"
        onClick={tap(sleep)}
        aria-label="Apagar la pantalla y seguir escuchando"
        className={`press flex shrink-0 items-center justify-center rounded-full text-dim hover:text-cyan ${short ? 'h-10 w-10' : 'h-11 w-11'}`}
      >
        <Moon className="h-5 w-5" />
      </button>
      <button type="button" onClick={() => open('invitar')} className="press" aria-label="Mostrar QR para invitar">
        <Plate code={view.room} size="sm" />
      </button>
    </div>
  );

  return (
    <>
    {ignitionLayer}
    <div className="relative flex h-dvh overflow-hidden bg-[radial-gradient(90%_70%_at_60%_40%,#0b1d26,transparent_70%),var(--color-asphalt)] pr-[var(--sar)] pl-[var(--sal)]">
      <Toasts items={toasts} onDismiss={dismiss} />

      {/* ------------------------------------------------------------ riel */}
      <nav
        className={`z-30 flex shrink-0 flex-col items-center border-r border-white/[0.05] bg-black/40 ${short ? 'w-[78px] gap-1 pt-[calc(var(--sat)+8px)] pb-[calc(var(--sab)+8px)]' : 'w-[92px] gap-2 pt-[calc(var(--sat)+12px)] pb-[calc(var(--sab)+12px)]'}`}
        aria-label="Menú del carro"
      >
        <Wordmark compact />
        <div className={`flex min-h-0 flex-1 flex-col justify-center ${short ? 'mt-1 gap-0.5' : 'mt-3 gap-1.5'}`}>
          {RAIL.map((r) => {
            const active = panel === r.id;
            const badge = r.id === 'cola' ? view.engine.queue.length : 0;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => open(r.id)}
                aria-pressed={active}
                className={`press relative flex flex-col items-center justify-center rounded-2xl transition-colors ${short ? 'h-[54px] w-[66px] gap-0.5' : 'h-[68px] w-[76px] gap-1'} ${active ? 'bg-cyan/12 text-ice ring-1 ring-cyan/40' : 'text-dim'}`}
              >
                <r.icon className={short ? 'h-5 w-5' : 'h-6 w-6'} strokeWidth={1.8} />
                <span className={`font-display font-semibold tracking-[0.12em] uppercase ${short ? 'text-[0.62rem]' : 'text-[0.7rem]'}`}>{r.label}</span>
                {badge > 0 && <span className="readout absolute top-1 right-1.5 rounded-full bg-cyan px-1.5 text-[0.7rem] font-bold text-asphalt">{badge}</span>}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={tap(() => setConfirmOff(true))}
          aria-label="Apagar la cabina"
          className={`press flex shrink-0 items-center justify-center rounded-full border border-danger/45 text-danger shadow-[0_0_18px_-8px_rgb(255_69_58/0.9)] ${short ? 'h-12 w-12' : 'h-14 w-14'}`}
        >
          <Power className="h-6 w-6" />
        </button>
      </nav>

      {/* ----------------------------------------------------------- cuadro */}
      {/* inert mientras hay un cajón abierto: fuera del foco y del lector de pantalla. */}
      <main inert={!!panel} className={`flex min-w-0 flex-1 flex-col overflow-hidden ${short ? 'gap-2 px-2.5 pt-[calc(var(--sat)+8px)] pb-[calc(var(--sab)+8px)]' : 'gap-3 px-4 pt-[calc(var(--sat)+12px)] pb-[calc(var(--sab)+12px)]'}`}>
        {highway ? (
          <HighwayStrip
            queue={view.engine.queue}
            remaining={remaining}
            moving={player.isPlaying}
            className={`shrink-0 ${short ? 'h-[clamp(96px,25dvh,124px)] rounded-[20px]' : 'h-[clamp(130px,30dvh,260px)] rounded-[26px]'}`}
            hud={hud}
          />
        ) : (
          <header className="shrink-0">{hud}</header>
        )}

        <Cluster
          track={player.currentTrack}
          isPlaying={player.isPlaying}
          position={player.currentTime}
          duration={player.duration}
          volume={player.volume}
          requestedBy={view.now?.requestedBy}
          ignition={ignition}
          large
          fill
          compact={short}
          // El salpicadero monta un poco sobre el parabrisas: una sola cabina, no dos tarjetas.
          className={`min-h-0 flex-1 ${highway ? (short ? 'relative z-10 -mt-5' : 'relative z-10 -mt-7') : ''}`}
          favorite={player.currentTrack ? carLibrary.isFavorite(player.currentTrack) : false}
          onFavorite={tap(() => player.currentTrack && carLibrary.toggleFavorite(player.currentTrack))}
          onVolume={(v) => globalAudioEngine.setVolume(v)}
          onToggle={tap(() => session.toggle())}
          onNext={tap(() => session.next())}
          onPrev={tap(() => session.prev())}
        />
        <TripComputer
          next={view.engine.queue[0]}
          elapsedMs={now - startedAt}
          played={played}
          riders={riders}
          queued={view.engine.queue.length}
          queuedSeconds={queueSeconds(view.engine.queue)}
          showNext={!highway}
          compact={short}
          className="shrink-0"
        />
      </main>

      {/* ------------------------------------------------- panel deslizante */}
      <AnimatePresence>
        {panel && (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar panel"
              className="absolute inset-0 z-10 bg-black/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanel(null)}
            />
            <motion.section
              key="drawer"
              role="dialog"
              aria-modal="false"
              aria-label={TITLES[panel]}
              className={`dash-panel absolute top-0 bottom-0 z-20 flex w-[min(540px,56vw)] flex-col rounded-r-[28px] pt-[var(--sat)] pb-[var(--sab)] ${short ? 'left-[calc(78px+var(--sal))]' : 'left-[calc(92px+var(--sal))]'}`}
              initial={{ x: '-104%' }}
              animate={{ x: 0 }}
              exit={{ x: '-104%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            >
              <div className={`flex items-center justify-between px-5 ${short ? 'pt-2 pb-1' : 'pt-4 pb-3'}`}>
                <h2 className={`font-display font-bold tracking-wide text-ink uppercase ${short ? 'text-xl' : 'text-2xl'}`}>{TITLES[panel]}</h2>
                <button ref={closeBtn} type="button" onClick={() => setPanel(null)} aria-label="Cerrar" className="press flex h-11 w-11 items-center justify-center rounded-full text-dim">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                <DrawerBody panel={panel}>
                  {panel === 'cola' && <HostQueuePanel view={view} session={session} />}
                  {panel === 'buscar' && (
                    <SearchPanel
                      pickLabel="+ Cola"
                      onPlayNow={(tr) => {
                        void native.haptic('success');
                        session.playTrackNow(tr);
                      }}
                      stateOf={(tr) => (queuedKeys.has(keyOf(tr)) ? 'done' : 'idle')}
                      onPick={(tr) => {
                        void native.haptic('success');
                        session.request(tr);
                      }}
                    />
                  )}
                  {panel === 'musica' && <CarMusicPanel lib={lib} onPlay={(tr) => session.playTrackNow(tr)} onQueue={(tr) => session.request(tr)} />}
                  {panel === 'modos' && <DriveModesPanel view={view} session={session} onScreenOff={sleep} />}
                  {panel === 'invitar' && (
                    <div className="flex flex-col items-center gap-6 pt-2">
                      <InviteCard room={view.room} compact={short} />
                      <Key variant="primary" size="lg" className="press" onClick={() => void native.share('CarBeat', `Súbete al carro: placa ${view.room}`, joinUrl(view.room))}>
                        <Share2 className="h-5 w-5" /> Compartir enlace
                      </Key>
                    </div>
                  )}
                </DrawerBody>
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmOff && (
          <motion.div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div role="alertdialog" aria-modal="true" aria-labelledby="off-title" initial={{ scale: 0.94 }} animate={{ scale: 1 }} className="dash-panel w-full max-w-md rounded-[28px] p-7 text-center">
              <h2 id="off-title" className="font-display text-3xl font-bold tracking-wide text-ink uppercase">
                ¿Apagar la cabina?
              </h2>
              <p className="mt-2 text-dim">La música se detiene y los pasajeros verán que cerraste la sala.</p>
              <div className="mt-7 grid grid-cols-2 gap-3">
                <Key size="lg" className="press" onClick={() => setConfirmOff(false)} autoFocus>
                  Seguir
                </Key>
                <Key size="lg" variant="danger" className="press" onClick={turnOff}>
                  <Power className="h-5 w-5" /> Apagar
                </Key>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    {screenOff && <ScreenOffLayer onWake={wake} />}
    </>
  );
}

function DrawerBody({ panel, children }: { panel: string; children: ReactNode }) {
  return (
    <motion.div key={panel} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
      {children}
    </motion.div>
  );
}
