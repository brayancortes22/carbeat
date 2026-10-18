import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CarFront, Loader2, RefreshCcw, ScanLine, Settings2, UserRound } from 'lucide-react';
import { normalizeRoomCode } from '../../shared/room-code';
import { getDisplayName, setDisplayName } from '../core/room/identity';
import { relay } from '../core/room/relay-client';
import { Key } from '../ui/controls';
import { Plate } from '../ui/Plate';
import { PlateInput, SignalBars } from '../ui/rider/JoinParts';
import { Radar, blipFor } from '../ui/rider/Radar';
import { Wordmark } from '../ui/Wordmark';
import { native } from './native';
import { QrScanner } from './QrScanner';

/** El QR lleva una URL (…/?sala=VIBE-7KQ3); también se acepta el código suelto. */
export function roomFromScan(text: string): string | null {
  try {
    const u = new URL(text);
    return normalizeRoomCode(u.searchParams.get('sala') ?? u.searchParams.get('room') ?? '');
  } catch {
    return normalizeRoomCode(text);
  }
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function JoinScreen({ onJoin, onSwitchRole }: { onJoin: (room: string) => void; onSwitchRole: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState(getDisplayName);
  const [error, setError] = useState<string | null>(null);
  const [nearby, setNearby] = useState<{ room: string; name: string }[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [camera, setCamera] = useState(false);
  const reduce = useReducedMotion();

  const join = (room: string) => {
    setDisplayName(name);
    void native.haptic('success');
    onJoin(room);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const room = normalizeRoomCode(code);
    if (!room) {
      void native.haptic('warn');
      setError('Esa placa no es de CarBeat. Ejemplo: VIBE-7KQ3');
      return;
    }
    join(room);
  };

  const onScan = useCallback(
    (text: string) => {
      setCamera(false);
      const room = roomFromScan(text);
      if (room) join(room);
      else {
        void native.haptic('warn');
        setError('Ese QR no es de una sala de CarBeat.');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name],
  );
  const closeCamera = useCallback(() => setCamera(false), []);

  const lookNearby = async () => {
    setScanning(true);
    try {
      setNearby((await relay.nearby()).rooms);
    } catch {
      setNearby([]);
    } finally {
      setScanning(false);
    }
  };
  useEffect(() => {
    void lookNearby();
  }, []);

  // Entrada escalonada de las piezas, como un tablero encendiéndose de arriba abajo.
  const rise = (i: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: 0.12 + i * 0.08, ease: EASE } };

  return (
    <div className="safe-pad flex min-h-dvh flex-col overflow-x-hidden bg-[radial-gradient(120%_55%_at_50%_0%,#0d2632,transparent_65%)]">
      <header className="flex items-center justify-between px-5 pt-5">
        <Wordmark />
        <button type="button" onClick={onSwitchRole} aria-label="Cambiar modo del dispositivo" className="press flex h-11 w-11 items-center justify-center rounded-full border border-white/8 text-dim">
          <Settings2 className="h-5 w-5" />
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center gap-6 px-5 pt-6 pb-8">
        {/* Botón de cámara: el gesto principal en un carro es apuntar al QR. El radar barre y
            cada eco es un carro encontrado de verdad en esta red (relay.nearby). */}
        <motion.button
          type="button"
          onClick={() => {
            void native.haptic('tap');
            setError(null);
            setCamera(true);
          }}
          initial={reduce ? false : { opacity: 0, scale: 0.86, rotateX: 40 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ type: 'spring', stiffness: 140, damping: 17 }}
          style={{ transformPerspective: 900 }}
          className="press relative rounded-full"
          aria-label="Escanear el QR del carro"
        >
          <span className="pointer-events-none absolute inset-[-14%] rounded-full bg-[radial-gradient(circle,rgb(34_211_238/0.2),transparent_64%)]" aria-hidden="true" />
          <Radar size={216} period={2.8} blips={(nearby ?? []).map((r) => blipFor(r.room))}>
            <span className="flex flex-col items-center gap-1.5 [filter:drop-shadow(0_2px_6px_rgb(0_0_0/0.9))]">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan/45 bg-[radial-gradient(circle_at_50%_30%,#1a4352,#081419)] shadow-[0_0_24px_-4px_rgb(34_211_238/0.9),inset_0_1px_0_rgb(255_255_255/0.14)]">
                <ScanLine className="h-7 w-7 text-ice" strokeWidth={1.7} />
              </span>
              <span className="type-wide text-[1.05rem] leading-none text-ice">Escanear QR</span>
              <span className="label-cluster text-[0.58rem] text-cyan-soft/80">del carro</span>
            </span>
          </Radar>
        </motion.button>

        <motion.form {...rise(1)} onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3" noValidate>
          <p className="label-cluster flex items-center gap-3 text-center before:h-px before:flex-1 before:bg-white/10 after:h-px after:flex-1 after:bg-white/10">o escribe la placa</p>
          <PlateInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setError(null);
            }}
            onEnter={() => submit()}
          />
          <label className="lcd relative flex items-center gap-2 rounded-xl px-3">
            <UserRound className="h-4 w-4 shrink-0 text-cyan-soft/70" aria-hidden="true" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre (lo verá el conductor)"
              maxLength={32}
              aria-label="Tu nombre"
              className="h-12 min-w-0 flex-1 bg-transparent text-ink placeholder:text-faint focus:outline-none"
            />
          </label>
          <AnimatePresence>
            {error && (
              <motion.p role="alert" className="text-center text-sm text-amber" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <Key type="submit" variant="primary" size="lg" className="press w-full">
            Subirme <ArrowRight className="h-5 w-5" />
          </Key>
        </motion.form>

        <motion.section {...rise(2)} className="w-full max-w-sm" aria-label="Carros en esta red">
          <div className="mb-2 flex items-center justify-between">
            <p className="label-cluster">Carros en esta red</p>
            <button type="button" onClick={lookNearby} aria-label="Buscar de nuevo" className="press -mr-2 flex h-10 w-10 items-center justify-center text-dim">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </button>
          </div>
          {nearby?.length === 0 && <p className="text-sm text-dim">Ninguno. Si estás en el hotspot del carro y no aparece, escanea el QR.</p>}
          <ul className="flex flex-col gap-2">
            {nearby?.map((r, i) => (
              <motion.li key={r.room} initial={reduce ? false : { opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, duration: 0.5, ease: EASE }}>
                <button type="button" onClick={() => join(r.room)} className="press dash-panel flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/25 bg-cyan/[0.06] text-cyan">
                    <CarFront className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{r.name}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-dim">
                      <SignalBars /> en tu red
                    </span>
                  </span>
                  <Plate code={r.room} size="sm" />
                </button>
              </motion.li>
            ))}
          </ul>
        </motion.section>
      </main>
      <AnimatePresence>{camera && <QrScanner onResult={onScan} onClose={closeCamera} />}</AnimatePresence>
    </div>
  );
}
