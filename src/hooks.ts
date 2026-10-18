import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { globalAudioEngine } from './core/audio/audio-player';
import { carLibrary } from './core/library';
import { HostSession, type HostView } from './core/room/host-session';
import { RiderSession, type RiderView } from './core/room/rider-session';
import type { AutopilotMode } from './core/autopilot';
import type { PlayerState } from './types/player.types';

const noopSubscribe = () => () => {};

/** Estado del reproductor del carro. (getState crea un objeto nuevo cada vez: por eso useState.) */
export function usePlayer(): PlayerState {
  const [state, setState] = useState<PlayerState>(() => globalAudioEngine.getState());
  useEffect(() => globalAudioEngine.subscribe(setState), []);
  return state;
}

export function useLibrary() {
  useEffect(() => void carLibrary.init(), []);
  return useSyncExternalStore(carLibrary.subscribe, carLibrary.getState);
}

/**
 * Sesión del carro. Se crea en un efecto (no en render) para que el doble montaje de
 * StrictMode no deje dos sesiones vivas: la primera se cierra antes de que exista la segunda.
 */
export function useHostSession(room: string | null, name: string, autopilot: AutopilotMode = 'hybrid') {
  const [session, setSession] = useState<HostSession | null>(null);
  useEffect(() => {
    if (!room) return;
    const s = new HostSession({
      room,
      name,
      player: globalAudioEngine,
      autopilot,
      getLocalLibrary: () => carLibrary.playable(),
    });
    setSession(s);
    void s.start().then(() => s.libraryChanged());
    const unsubLib = carLibrary.subscribe(() => s.libraryChanged());
    globalAudioEngine.onError((t, reason) => s.announce(`«${t.title}»: ${reason}. Pasando a la siguiente.`));
    let lastId: string | null = null;
    const unsubPlayer = globalAudioEngine.subscribe((st) => {
      if (st.currentTrack && st.currentTrack.id !== lastId && st.isPlaying) {
        lastId = st.currentTrack.id;
        carLibrary.recordPlayed(st.currentTrack);
      }
    });
    // No se cierra la sala al salir de la página: una recarga la recupera con el mismo token.
    // Si el carro desaparece de verdad, la sala caduca sola a los 2 minutos.
    return () => {
      unsubLib();
      unsubPlayer();
      s.dispose();
      setSession((cur) => (cur === s ? null : cur));
    };
    // El nombre y el modo inicial sólo cuentan al crear la sala.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);
  const view = useSyncExternalStore(session?.subscribe ?? noopSubscribe, session?.getView ?? nullHostView) as HostView | null;
  return { session, view };
}
const nullHostView = () => null;

export function useRiderSession(room: string | null, name: string) {
  const [session, setSession] = useState<RiderSession | null>(null);
  useEffect(() => {
    if (!room) return;
    const s = new RiderSession(room, name || 'Pasajero');
    setSession(s);
    s.start();
    return () => {
      s.dispose();
      setSession((cur) => (cur === s ? null : cur));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);
  useEffect(() => {
    if (session && name && session.getView().name !== name) session.rename(name);
  }, [session, name]);
  const view = useSyncExternalStore(session?.subscribe ?? noopSubscribe, session?.getView ?? nullRiderView) as RiderView | null;
  return { session, view };
}
const nullRiderView = () => null;

/** Reloj que avanza cada `ms` (para barras de progreso extrapoladas). */
export function useTicker(ms = 500, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, active]);
  return now;
}

/** Búsqueda con espera (debounce) y cancelación de la anterior. */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export function useStableCallback<A extends unknown[], R>(fn: (...a: A) => R) {
  const ref = useLatest(fn);
  return useCallback((...a: A) => ref.current(...a), [ref]);
}
