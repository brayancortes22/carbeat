import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Moon, Power, QrCode, Sliders } from 'lucide-react';
import type { Notice } from '../../shared/protocol';
import { globalAudioEngine } from '../core/audio/audio-player';
import { useBackgroundPlayback } from '../core/audio/background-playback';
import { carLibrary } from '../core/library';
import { useHostSession, useLibrary, usePlayer, useTicker } from '../hooks';
import { Cluster } from '../ui/Cluster';
import { Key, Toasts } from '../ui/controls';
import { CarMusicPanel, DriveModesPanel, HostQueuePanel } from '../ui/host-panels';
import { Ignition } from '../ui/Ignition';
import { InviteDialog } from '../ui/Invite';
import { useNightDim } from '../ui/kit';
import { SearchPanel, keyOf } from '../ui/music';
import { Plate } from '../ui/Plate';
import { TripComputer, queueSeconds } from '../ui/TripComputer';
import { Wordmark } from '../ui/Wordmark';
import { useWakeLock } from '../ui/useWakeLock';
import { ScreenOffLayer, useScreenOff } from '../ui/useScreenOff';
import { CabinClock, TelltaleBar, useCabinIgnition, useMediaQuery } from '../ui/car/cabin';
import { HighwayStrip, HighwayTag } from '../ui/car/HighwayStrip';
import { useHighwayPref } from '../ui/car/highway-pref';
import { EqualizerModal } from '../ui/car/EqualizerModal';

type Tab = 'cola' | 'buscar' | 'carro' | 'modos';
const TABS: { id: Tab; label: string }[] = [
  { id: 'cola', label: 'Cola' },
  { id: 'buscar', label: 'Buscar' },
  { id: 'carro', label: 'Música' },
  { id: 'modos', label: 'Modos' },
];

const VOLUME_KEY = 'carbeat.volume';

export function HostScreen({ room, onExit, onRoomChange }: { room: string; onExit: () => void; onRoomChange?: (room: string) => void }) {
  const { session, view } = useHostSession(room, 'Carro');

  // Si el código estaba ocupado, la sesión eligió otro: la URL tiene que seguirlo.
  useEffect(() => {
    if (view && view.room !== room) onRoomChange?.(view.room);
  }, [view, room, onRoomChange]);
  const player = usePlayer();
  useBackgroundPlayback(session, player);
  const { off: screenOff, sleep, wake } = useScreenOff();
  const lib = useLibrary();
  const [tab, setTab] = useState<Tab>('cola');
  const [invite, setInvite] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [toasts, setToasts] = useState<Notice[]>([]);
  const seen = useRef(new Set<string>());
  const now = useTicker(30_000);
  const [startedAt] = useState(() => Date.now());
  const [played, setPlayed] = useState(0);
  const lastTrack = useRef<string | null>(null);
  const { showIgnition, ignition, onIgnitionDone } = useCabinIgnition();
  const [highway] = useHighwayPref();
  const [showEq, setShowEq] = useState(false);
  // Escritorio con alto suficiente: la cabina cabe entera en la pantalla y el cuadro se ajusta
  // al alto que sobra. Por debajo, la página fluye y se desplaza como siempre.
  const fit = useMediaQuery('(min-width: 1024px) and (min-height: 660px)');
  useWakeLock(true);
  useNightDim();

  // Canciones que han sonado en esta sesión (para la computadora de viaje).
  useEffect(() => {
    const id = player.currentTrack?.id ?? null;
    if (id && id !== lastTrack.current && player.isPlaying) {
      lastTrack.current = id;
      setPlayed((n) => n + 1);
    }
  }, [player.currentTrack, player.isPlaying]);

  // Volumen recordado entre viajes.
  useEffect(() => {
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    if (saved > 0 && saved <= 1) globalAudioEngine.setVolume(saved);
  }, []);
  const setVolume = useCallback((v: number) => {
    globalAudioEngine.setVolume(v);
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  // Los avisos generales (para todos) también se ven en el carro.
  useEffect(() => {
    if (!view) return;
    const fresh = view.notices.filter((n) => n.to === '*' && !seen.current.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => seen.current.add(n.id));
    setToasts((t) => [...fresh, ...t].slice(0, 3));
  }, [view]);
  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const handleToggleFavorite = useCallback(() => {
    if (!player.currentTrack) return;
    const isNowFav = carLibrary.toggleFavorite(player.currentTrack);
    const toastId = 'fav-' + Date.now();
    const notice = {
      id: toastId,
      to: '*',
      text: isNowFav ? `⭐ «${player.currentTrack.title}» agregada a Mi Música` : `Quitada de Mi Música`,
      kind: 'info' as const,
      at: Date.now(),
    };
    setToasts((t) => [notice, ...t].slice(0, 3));
    setTimeout(() => dismiss(toastId), 3000);
  }, [player.currentTrack, carLibrary, dismiss]);

  const riders = view ? Object.entries(view.engine.riders).map(([id, r]) => ({ id, name: r.name })) : [];
  const queue = view?.engine.queue;
  const queuedKeys = useMemo(() => new Set(queue?.map((e) => keyOf(e.track)) ?? []), [queue]);

  const turnOff = async () => {
    setConfirmOff(false);
    await session?.close();
    onExit();
  };

  // La secuencia de encendido va siempre en la misma posición del árbol: si estuviera dentro
  // de cada rama, al pasar de «encendiendo» a la cabina se desmontaría y empezaría otra vez.
  const ignitionLayer = showIgnition && <Ignition onDone={onIgnitionDone} />;

  if (!view || !session) {
    return (
      <>
        {ignitionLayer}
        <div className="flex min-h-dvh items-center justify-center">
          <p className="label-cluster animate-pulse text-cyan-soft">Encendiendo la cabina…</p>
        </div>
      </>
    );
  }

  const remaining = player.currentTrack && player.duration > 0 ? player.duration - player.currentTime : null;
  // Con la autopista, el cuadro llena el alto que queda; sin ella, mantiene su tamaño y se centra
  // (llenar el alto sólo dejaría hueco alrededor de los indicadores, que van por el ancho).
  const fill = fit && highway;

  return (
    <>
    {ignitionLayer}
    <div
      className={`safe-pad relative flex flex-col bg-[radial-gradient(120%_60%_at_30%_0%,#0b1d26,transparent_60%),var(--color-asphalt)] ${fit ? 'h-dvh overflow-hidden' : 'min-h-dvh'}`}
    >
      <Toasts items={toasts} onDismiss={dismiss} />

      {/* ------------------------------------------------ barra superior */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-3 sm:px-6">
        <Wordmark compact />
        <TelltaleBar view={view} />
        <span className="ml-auto hidden sm:inline-flex">
          <CabinClock now={now} className="text-2xl" />
        </span>
        <button type="button" onClick={() => setInvite(true)} className="ml-auto transition-transform active:scale-95 sm:ml-0" aria-label="Mostrar QR para invitar">
          <Plate code={view.room} size="sm" />
        </button>
        <Key size="sm" variant="primary" onClick={() => setInvite(true)} className="hidden md:inline-flex">
          <QrCode className="h-4 w-4" /> Invitar
        </Key>
        <Key size="sm" onClick={() => setShowEq(true)} aria-label="Ecualizador Car Audio">
          <Sliders className="h-4 w-4 text-cyan" /> <span className="hidden sm:inline">Audio</span>
        </Key>
        <Key size="sm" onClick={sleep} aria-label="Apagar la pantalla y seguir escuchando">
          <Moon className="h-4 w-4" /> <span className="hidden sm:inline">Pantalla</span>
        </Key>
        <Key size="sm" variant="danger" onClick={() => setConfirmOff(true)} aria-label="Apagar la cabina">
          <Power className="h-4 w-4" /> <span className="hidden sm:inline">Apagar</span>
        </Key>
      </header>

      {/* -------------------------------------------------------- tablero */}
      <main className={`grid flex-1 gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] ${fit ? 'min-h-0' : ''}`}>
        <div className={`flex min-w-0 flex-col gap-3 ${fit ? 'min-h-0' : ''} ${fit && !highway ? 'justify-center' : ''}`}>
          {highway && (
            <HighwayStrip
              queue={view.engine.queue}
              remaining={remaining}
              moving={player.isPlaying}
              className="h-[150px] shrink-0 rounded-[26px] sm:h-[clamp(118px,28dvh,250px)]"
              hud={
                // Abajo a la izquierda, sobre el arcén: arriba están los letreros.
                <div className="flex h-full items-end p-3 pb-7">
                  <HighwayTag count={view.engine.queue.length} />
                </div>
              }
            />
          )}
          <Cluster
            track={player.currentTrack}
            isPlaying={player.isPlaying}
            position={player.currentTime}
            duration={player.duration}
            volume={player.volume}
            requestedBy={view.now?.requestedBy}
            ignition={ignition}
            fill={fill}
            // Con parabrisas, el salpicadero monta un poco sobre él (como el capó tapa el borde
            // inferior del cristal): se lee como una sola cabina y no como dos tarjetas.
            className={`${fill ? 'min-h-[260px] flex-1' : ''} ${highway ? 'relative z-10 -mt-6' : ''}`}
            favorite={player.currentTrack ? carLibrary.isFavorite(player.currentTrack) : false}
            onFavorite={handleToggleFavorite}
            onVolume={setVolume}
            onToggle={() => session.toggle()}
            onNext={() => session.next()}
            onPrev={() => session.prev()}
          />
          <TripComputer
            next={view.engine.queue[0]}
            elapsedMs={now - startedAt}
            played={played}
            riders={riders.length}
            queued={view.engine.queue.length}
            queuedSeconds={queueSeconds(view.engine.queue)}
            showNext={!highway}
            className="shrink-0"
          />
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-2" aria-label="A bordo">
            <span className="label-cluster mr-1">A bordo</span>
            {riders.length === 0 && <span className="text-sm text-faint">Nadie todavía · muestra el QR con «Invitar»</span>}
            <AnimatePresence initial={false}>
              {riders.map((r) => (
                <motion.span
                  key={r.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="rounded-full border border-cyan/25 bg-cyan/[0.05] px-3 py-1 font-display text-sm font-semibold tracking-wide text-ice"
                >
                  {r.name}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <aside className={`dash-panel flex flex-col overflow-hidden rounded-[28px] ${fit ? 'min-h-0' : 'min-h-[420px]'}`} aria-label="Pantalla central">
          <div className="flex gap-1 border-b border-white/[0.06] p-2" role="tablist">
            {TABS.map((x) => (
              <button
                key={x.id}
                role="tab"
                type="button"
                aria-selected={tab === x.id}
                onClick={() => setTab(x.id)}
                className={`relative flex-1 rounded-xl py-2.5 font-display text-[0.95rem] font-bold tracking-[0.1em] uppercase transition-colors ${tab === x.id ? 'text-ice' : 'text-faint hover:text-dim'}`}
              >
                {tab === x.id && <motion.span layoutId="host-tab" className="absolute inset-0 rounded-xl bg-cyan/10 ring-1 ring-cyan/30" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span className="relative">
                  {x.label}
                  {x.id === 'cola' && view.engine.queue.length > 0 && <span className="readout ml-1.5 text-cyan">{view.engine.queue.length}</span>}
                </span>
              </button>
            ))}
          </div>
          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {tab === 'cola' && <HostQueuePanel view={view} session={session} />}
            {tab === 'buscar' && (
              <SearchPanel
                pickLabel="+ Cola"
                onPlayNow={(tr) => session.playTrackNow(tr)}
                stateOf={(tr) => (queuedKeys.has(keyOf(tr)) || (player.currentTrack && keyOf(player.currentTrack) === keyOf(tr)) ? 'done' : 'idle')}
                onPick={(tr) => {
                  const notice = session.request(tr);
                  if (notice) setToasts((x) => [{ id: `local-${Date.now()}`, to: '*', text: notice, at: Date.now() }, ...x]);
                }}
              />
            )}
            {tab === 'carro' && <CarMusicPanel lib={lib} onPlay={(tr) => session.playTrackNow(tr)} onQueue={(tr) => session.request(tr)} />}
            {tab === 'modos' && <DriveModesPanel view={view} session={session} onScreenOff={sleep} />}
          </div>
        </aside>
      </main>

      <InviteDialog room={view.room} open={invite} onClose={() => setInvite(false)} />
      {showEq && <EqualizerModal onClose={() => setShowEq(false)} />}

      <AnimatePresence>
        {confirmOff && (
          <motion.div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div role="alertdialog" aria-modal="true" aria-labelledby="off-title" initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="dash-panel max-w-sm rounded-[24px] p-6 text-center">
              <h2 id="off-title" className="font-display text-2xl font-bold tracking-wide text-ink uppercase">
                ¿Apagar la cabina?
              </h2>
              <p className="mt-2 text-dim">La música se detiene y los pasajeros verán que cerraste la sala.</p>
              <div className="mt-6 flex justify-center gap-3">
                <Key onClick={() => setConfirmOff(false)} autoFocus>
                  Seguir
                </Key>
                <Key variant="danger" onClick={turnOff}>
                  <Power className="h-4 w-4" /> Apagar
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
