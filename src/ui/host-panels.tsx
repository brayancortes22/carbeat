import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { FolderOpen, ListX, Play, Trash2, Upload, X } from 'lucide-react';
import type { RoomSettings } from '../../shared/protocol';
import type { Track } from '../../shared/track';
import { AUTOPILOT_MODES, type AutopilotMode } from '../core/autopilot';
import { carLibrary, type LibraryState } from '../core/library';
import type { HostSession, HostView } from '../core/room/host-session';
import { Key } from './controls';
import { QueueList, TrackRow, Tag } from './music';
import { TtIcon } from './Telltale';
import { useHighwayPref } from './car/highway-pref';

// -------------------------------------------------------------- cola (carro)

export function HostQueuePanel({ view, session }: { view: HostView; session: HostSession }) {
  const queue = view.engine.queue;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <p className="label-cluster">{queue.length ? `${queue.length} en cola · ordenada por votos` : 'Cola vacía'}</p>
        {queue.length > 1 && (
          <Key size="sm" variant="quiet" onClick={() => session.clear()}>
            <ListX className="h-4 w-4" /> Vaciar
          </Key>
        )}
      </div>
      <QueueList
        queue={queue}
        empty={
          <div className="flex flex-col items-center gap-2 text-dim">
            <span className="text-cyan/40 [&_svg]:h-10 [&_svg]:w-10">
              <TtIcon.Cruise />
            </span>
            <p>Nadie ha pedido nada todavía.</p>
            <p className="text-sm text-faint">
              {view.autopilot === 'off' ? 'Con el piloto automático apagado, la música se detiene al acabar.' : 'El piloto automático elegirá la siguiente.'}
            </p>
          </div>
        }
        hostActions={(e) => (
          // Apilados: dos botones de 44 px en fila dejaban el título en ~100 px a 390 de ancho.
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => session.playNow(e.queueId)} aria-label={`Poner ya ${e.track.title}`} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.03] text-dim transition-colors hover:bg-cyan/10 hover:text-cyan">
              <Play className="h-4 w-4" fill="currentColor" />
            </button>
            <button type="button" onClick={() => session.remove(e.queueId)} aria-label={`Quitar ${e.track.title}`} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.03] text-dim transition-colors hover:bg-danger/10 hover:text-danger">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      />
    </div>
  );
}

// -------------------------------------------------------- música del carro

type LibTab = 'carro' | 'favoritas' | 'historial';

export function CarMusicPanel({ lib, onPlay, onQueue }: { lib: LibraryState; onPlay: (t: Track) => void; onQueue: (t: Track) => void }) {
  const [tab, setTab] = useState<LibTab>('carro');
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const list = tab === 'carro' ? lib.local : tab === 'favoritas' ? lib.favorites : lib.history;
  const tabs: { id: LibTab; label: string; n: number }[] = [
    { id: 'carro', label: 'En el carro', n: lib.local.length },
    { id: 'favoritas', label: 'Mi música', n: lib.favorites.length },
    { id: 'historial', label: 'Este viaje', n: lib.history.length },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl bg-black/30 p-1" role="tablist" aria-label="Música del carro">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-2 font-display text-sm font-semibold tracking-wide uppercase transition-colors ${tab === t.id ? 'bg-cyan/12 text-ice' : 'text-faint hover:text-dim'}`}
          >
            {t.label} <span className="readout text-xs text-cyan-soft/70">{t.n}</span>
          </button>
        ))}
      </div>

      {tab === 'carro' && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg,.aac,.opus"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void carLibrary.importFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={folderRef}
            type="file"
            // @ts-expect-error atributo de navegador para subcarpetas
            webkitdirectory=""
            directory=""
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void carLibrary.importFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Key size="sm" variant="primary" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Añadir archivos
          </Key>
          {carLibrary.folderSupported() && (
            <Key size="sm" onClick={() => void carLibrary.pickFolder()}>
              <FolderOpen className="h-4 w-4" /> {lib.folderName ? `USB: «${lib.folderName}»` : 'Escanear USB / Carpeta'}
            </Key>
          )}
        </div>
      )}
      {tab === 'historial' && lib.history.length > 0 && (
        <div className="flex gap-2">
          <Key size="sm" onClick={() => carLibrary.saveAllToFavorites(lib.history)}>
            Guardar todas en Mi música
          </Key>
          <Key size="sm" variant="quiet" onClick={() => carLibrary.clearHistory()}>
            Borrar historial
          </Key>
        </div>
      )}
      {lib.importing && (
        <div className="lcd rounded-xl px-3 py-2 text-sm text-ice" role="status">
          Importando {lib.importing.done} de {lib.importing.total}…
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-cyan/10">
            <motion.div className="h-full bg-cyan" animate={{ width: `${(lib.importing.done / lib.importing.total) * 100}%` }} />
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="px-2 py-8 text-center text-sm text-faint">
          {tab === 'carro'
            ? 'Añade MP3 de la USB o de la tablet: suenan sin datos y los pasajeros también los ven.'
            : tab === 'favoritas'
              ? 'Guarda canciones con el marcador del cuadro para tenerlas siempre a mano.'
              : 'Aquí aparece lo que va sonando en el viaje.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.map((t) => (
            <li key={t.id}>
              <TrackRow
                title={t.title}
                artist={t.artist}
                cover={t.coverUrl}
                duration={t.duration}
                meta={tab === 'carro' ? <Tag tone="amber">Sin datos</Tag> : undefined}
                action={
                  <div className="flex items-center gap-1">
                    <Key size="sm" variant="primary" onClick={() => onQueue(t)}>
                      A la cola
                    </Key>
                    <button type="button" onClick={() => onPlay(t)} aria-label={`Poner ya ${t.title}`} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.03] text-dim hover:text-cyan">
                      <Play className="h-4 w-4" fill="currentColor" />
                    </button>
                    {tab === 'carro' && (
                      <button type="button" onClick={() => void carLibrary.removeLocal(t.id)} aria-label={`Borrar ${t.title} del carro`} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.03] text-dim hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------- modos de manejo

export function DriveModesPanel({ view, session }: { view: HostView; session: HostSession }) {
  const settings = view.engine.settings;
  const set = (patch: Partial<RoomSettings>) => session.setSettings(patch);
  const [highway, setHighway] = useHighwayPref();
  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="label-cluster mb-3 flex items-center gap-2">
          <span className={`[&_svg]:h-4 [&_svg]:w-4 ${view.autopilot === 'off' ? 'text-faint' : 'text-go'}`}>
            <TtIcon.Cruise />
          </span>
          Piloto automático
        </legend>
        <div className="grid gap-2">
          {AUTOPILOT_MODES.map((m) => {
            const active = view.autopilot === m.id;
            return (
              <label
                key={m.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${active ? 'border-cyan/45 bg-cyan/[0.07]' : 'border-white/8 hover:border-white/15'}`}
              >
                <input type="radio" name="autopilot" className="sr-only" checked={active} onChange={() => session.setAutopilot(m.id as AutopilotMode)} />
                <span className={`mt-1 h-3 w-3 shrink-0 rounded-full border ${active ? 'border-cyan bg-cyan shadow-[0_0_8px_rgb(34_211_238/0.9)]' : 'border-faint'}`} aria-hidden="true" />
                <span>
                  <span className="block font-display text-lg leading-none font-bold tracking-wide text-ink uppercase">{m.label}</span>
                  <span className="mt-1 block text-sm text-dim">{m.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="label-cluster mb-3">Reglas de la sala</legend>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/8 px-3 py-3">
          <span>
            <span className="block font-semibold text-ink">Los pasajeros controlan la música</span>
            <span className="block text-sm text-dim">Pausar, saltar y volver desde su celular.</span>
          </span>
          <Toggle checked={settings.passengerControl} onChange={(v) => set({ passengerControl: v })} label="Control de los pasajeros" />
        </label>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 px-3 py-3">
          <span>
            <span className="block font-semibold text-ink">Canciones en espera por pasajero</span>
            <span className="block text-sm text-dim">Para que nadie llene la cola solo.</span>
          </span>
          <div className="flex items-center gap-2">
            <Key size="sm" onClick={() => set({ maxPendingPerRider: Math.max(1, settings.maxPendingPerRider - 1) })} aria-label="Menos">
              −
            </Key>
            <span className="readout glow-text w-6 text-center text-xl font-bold">{settings.maxPendingPerRider}</span>
            <Key size="sm" onClick={() => set({ maxPendingPerRider: Math.min(20, settings.maxPendingPerRider + 1) })} aria-label="Más">
              +
            </Key>
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="label-cluster mb-3">Pantalla del carro</legend>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/8 px-3 py-3">
          <span>
            <span className="block font-semibold text-ink">Autopista 3D</span>
            <span className="block text-sm text-dim">Las próximas canciones como letreros sobre la carretera. Apágala si esta pantalla va lenta; sólo cambia en este aparato.</span>
          </span>
          <Toggle checked={highway} onChange={setHighway} label="Autopista 3D" />
        </label>
      </fieldset>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors ${checked ? 'border-cyan/50 bg-cyan/20' : 'border-white/10 bg-black/40'}`}
    >
      <motion.span
        className={`absolute top-1 h-[22px] w-[22px] rounded-full ${checked ? 'bg-cyan shadow-[0_0_10px_rgb(34_211_238/0.9)]' : 'bg-faint'}`}
        animate={{ left: checked ? 28 : 4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      />
    </button>
  );
}
