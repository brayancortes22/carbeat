import { useCallback, useRef, useState } from "react";
import { motion } from "motion/react";
import { LogOut, Pencil, UserRound } from "lucide-react";
import type { Track } from "../../shared/track";
import { getDisplayName, setDisplayName } from "../core/room/identity";
import { useRiderSession } from "../hooks";
import { Key, Toasts } from "../ui/controls";
import { Odometer } from "../ui/kit";
import { LibraryList, QueueList, SearchPanel } from "../ui/music";
import { Plate } from "../ui/Plate";
import {
  NowPlayingCard,
  StatusChip,
  carTrack,
  pickStateFor,
} from "../ui/rider-parts";
import { FlightLayer, launchFlight, useBump } from "../ui/rider/Flight";
import { RiderGate } from "../ui/RiderGate";

/*
 * Pasajero en el navegador (entró por el QR). Pestañas arriba, fijas al hacer scroll: así la
 * pestaña Cola siempre está a la vista para recibir la portada que "vuela" al pedir.
 */

type Tab = "buscar" | "cola" | "carro";

export function RiderScreen({
  room,
  onExit,
}: {
  room: string;
  onExit: () => void;
}) {
  const [name, setName] = useState(() => getDisplayName());
  const [editing, setEditing] = useState(!getDisplayName());
  const [draft, setDraft] = useState(name);
  const { session, view } = useRiderSession(room, name || "Pasajero");
  const [tab, setTab] = useState<Tab>("buscar");
  const colaRef = useRef<HTMLButtonElement>(null);
  const [badge, bump] = useBump();
  const onLand = useCallback((el: Element | null) => el === colaRef.current && bump(), [bump]);
  const [playDirectly, setPlayDirectly] = useState(false);
  const mp3InputRef = useRef<HTMLInputElement>(null);

  if (!session || !view) return null;

  const snap = view.snapshot;
  const canPlayNow = !!snap?.settings.passengerPlayNow;
  const stateOf = pickStateFor(view, snap);
  const library = view.library?.items ?? [];
  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: "buscar", label: "Buscar" },
    { id: "cola", label: "Cola", n: snap?.queue.length ?? 0 },
    ...(library.length
      ? [{ id: "carro" as Tab, label: "Del carro", n: library.length }]
      : []),
  ];

  const leave = () => {
    session.leave();
    onExit();
  };

  const saveName = () => {
    const clean = draft.trim();
    setDisplayName(clean);
    setName(clean);
    setEditing(false);
  };



  const handleMp3Upload = (file: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      alert('El archivo excede el límite máximo de 25 MB.');
      return;
    }
    if (!/\.(mp3|m4a|wav|flac|aac|ogg|opus|wma)$/i.test(file.name)) {
      alert('Solo se admiten archivos de audio válidos (.mp3, .m4a, .wav, .flac).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const cleanName = file.name.replace(/\.[^/.]+$/, '').trim();
      const track: Track = {
        id: `rider_${Date.now()}`,
        title: cleanName,
        artist: view.name || 'Pasajero',
        audioUrl: dataUrl,
        duration: 0,
        source: 'local_car',
      };
      request(track, undefined, playDirectly);
    };
    reader.readAsDataURL(file);
  };

  const request = (t: Track, from?: Element, playNow = playDirectly) => {
    navigator.vibrate?.(10);
    launchFlight(from, t.coverUrl);
    void session.request(t, playNow);
  };

  return (
    // Contenedor de scroll propio: con overflow-x:hidden en <body> (index.css), position:sticky
    // no se pega al hacer scroll del documento (medido: la pestaña Cola acababa en top = -41 px).
    // Dentro de su propio contenedor, las pestañas sí se quedan arriba.
    <div
      data-scroller
      className="h-dvh overflow-x-hidden overflow-y-auto overscroll-contain bg-[radial-gradient(130%_50%_at_50%_0%,#0b1d26,transparent_70%)]"
    >
      <div className="safe-pad relative mx-auto flex min-h-full w-full max-w-2xl flex-col">
        <Toasts
          items={view.toasts}
          onDismiss={(id) => session.dismissToast(id)}
        />
        {/* Si no suena nada, lo pedido sonará ya: la portada va al dial; si no, a la cola. */}
        <FlightLayer target={() => (view.snapshot?.now ? colaRef.current : document.querySelector('[data-dial]'))} onLand={onLand} />

        <header className="flex items-center gap-3 px-4 pt-4">
          <Plate code={room} size="sm" />
          <StatusChip view={view} />
          <button
            type="button"
            onClick={leave}
            className="ml-auto inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm text-dim hover:text-ice"
            aria-label="Bajarme de la sala"
          >
            <LogOut className="h-4 w-4" />{" "}
            <span className="hidden sm:inline">Bajarme</span>
          </button>
        </header>

        <div className="px-4 pt-3">
          {editing ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
            >
              <label className="lcd relative flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3">
                <UserRound
                  className="h-4 w-4 shrink-0 text-cyan-soft/70"
                  aria-hidden="true"
                />
                <span className="sr-only">Tu nombre</span>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Tu nombre (lo verá el conductor)"
                  maxLength={32}
                  autoFocus
                  className="h-11 min-w-0 flex-1 bg-transparent text-ink placeholder:text-faint focus:outline-none"
                />
              </label>
              <Key type="submit" size="md" variant="primary">
                Listo
              </Key>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex min-h-11 items-center gap-2 text-sm text-dim hover:text-ice"
            >
              <UserRound
                className="h-4 w-4 text-cyan-soft/70"
                aria-hidden="true"
              />
              Vas como{" "}
              <span className="font-semibold text-ink">
                {name || "Pasajero"}
              </span>{" "}
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <RiderGate view={view} onExit={leave}>
          <div className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-[calc(var(--sab)+24px)]">
            <NowPlayingCard view={view} session={session} />

            {/* Pestañas fijas arriba: fondo opaco degradado (no backdrop-filter, que cuesta FPS al hacer scroll en el celular) */}
            <div className="sticky top-0 z-20 -mx-4 bg-asphalt px-4 pt-2 pb-2 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-5 after:bg-gradient-to-b after:from-asphalt after:to-transparent">
              <div
                className="flex gap-1 rounded-2xl border border-white/[0.06] bg-[linear-gradient(180deg,#0b1116,#06090c)] p-1 shadow-[inset_0_1px_3px_rgb(0_0_0/0.8)]"
                role="tablist"
                aria-label="Secciones"
              >
                {tabs.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      ref={t.id === "cola" ? colaRef : undefined}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.id)}
                      className={`relative flex-1 rounded-xl py-2.5 font-display text-base font-bold tracking-[0.1em] uppercase transition-colors ${active ? "text-ice" : "text-faint hover:text-dim"}`}
                    >
                      {active && (
                        <motion.span
                          layoutId="rider-tab"
                          className="absolute inset-0 rounded-xl bg-[linear-gradient(180deg,#123542,#0a1f28)] shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_0_0_1px_rgb(34_211_238/0.4),0_0_20px_-6px_rgb(34_211_238/0.8)]"
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 38,
                          }}
                        />
                      )}
                      <span className="relative inline-flex items-center gap-1.5">
                        {t.label}
                        {t.n !== undefined && (
                          <span
                            ref={t.id === "cola" ? badge : undefined}
                            className={`readout inline-flex leading-none ${t.n ? "text-cyan" : "text-faint/70"}`}
                            aria-label={`${t.n} canciones`}
                          >
                            <Odometer value={t.n} />
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/5 bg-black/30 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-dim">Al pedir:</span>
                <button
                  type="button"
                  onClick={() => setPlayDirectly(!playDirectly)}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                    playDirectly
                      ? 'border-go/50 bg-go/20 text-go shadow-[0_0_10px_rgba(48,209,88,0.25)]'
                      : 'border-cyan/30 bg-cyan/10 text-cyan-soft'
                  }`}
                >
                  {playDirectly ? '▶ Sonar de una vez' : '➕ A la cola'}
                </button>
              </div>

              <input
                ref={mp3InputRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.flac,.wav"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleMp3Upload(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => mp3InputRef.current?.click()}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-dim hover:text-ink"
              >
                📤 Enviar MP3 local
              </button>
            </div>

            <div className="min-h-[40vh]" role="tabpanel">
              {tab === "buscar" && (
                <SearchPanel onPick={request} onPlayNow={canPlayNow ? (t) => void session.playNow({ track: t }) : undefined} stateOf={stateOf} />
              )}
              {tab === "cola" && (
                <QueueList
                  queue={snap?.queue ?? []}
                  me={view.me}
                  onPlayNow={canPlayNow ? (q) => void session.playNow({ queueId: q }) : undefined}
                  onVote={(q, v) => {
                    navigator.vibrate?.(8);
                    void session.vote(q, v);
                  }}
                  empty={
                    <p className="text-dim">La cola está vacía. ¡Pide algo!</p>
                  }
                />
              )}
              {tab === "carro" && (
                <LibraryList
                  items={library}
                  onPick={(i, from) => request(carTrack(i), from)}
                  stateOf={(i) => stateOf(carTrack(i))}
                />
              )}
            </div>
          </div>
        </RiderGate>
      </div>
    </div>
  );
}
