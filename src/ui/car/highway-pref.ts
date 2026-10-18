import { useCallback, useSyncExternalStore } from 'react';

/*
 * Interruptor «Autopista 3D». Vive en localStorage porque es una preferencia de ESTE aparato
 * (una tablet vieja puede ir justa con el 3D y otra no), no de la sala.
 * Si nunca se tocó, arranca apagado con prefers-reduced-motion: quien pidió menos movimiento
 * no debería encontrarse una carretera en marcha sin haberla pedido.
 * Se comparte entre el cuadro y el panel Modos con un evento propio: ambos viven en la misma
 * página y el evento «storage» sólo llega a OTRAS pestañas.
 */

const KEY = 'carbeat.highway3d';
const EVENT = 'carbeat:highway3d';

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// Respaldo si localStorage no deja escribir (modo privado estricto): dura lo que la página.
let memory: boolean | null = null;

function read(): boolean {
  if (memory !== null) return memory;
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'on') return true;
    if (v === 'off') return false;
  } catch {
    /* sin almacenamiento: se decide por la preferencia del sistema */
  }
  return !reducedMotion();
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function useHighwayPref(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? 'on' : 'off');
      memory = null;
    } catch {
      memory = v;
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, set];
}
