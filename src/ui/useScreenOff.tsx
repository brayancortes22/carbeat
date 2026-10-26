import { useCallback, useEffect, useState } from 'react';
import { native } from '../app/native';

/**
 * «Pantalla apagada» del carro.
 *
 * No apaga Android: baja el brillo de la ventana a cero y pinta una capa negra encima. Para
 * YouTube es la única forma fiable de seguir sonando, porque su reproductor se pausa cuando
 * el sistema apaga la pantalla de verdad.
 */
export function useScreenOff() {
  const [off, setOff] = useState(false);

  const sleep = useCallback(() => {
    setOff(true);
    void native.screenDim(true);
  }, []);

  const wake = useCallback(() => {
    setOff(false);
    void native.screenDim(false);
  }, []);

  useEffect(() => () => void native.screenDim(false), []);

  return { off, sleep, wake };
}

/** Capa negra que atrapa el primer toque para devolver el brillo. */
export function ScreenOffLayer({ onWake }: { onWake: () => void }) {
  return (
    <button
      type="button"
      autoFocus
      aria-label="Pantalla apagada. Toca para volver a encenderla."
      onClick={onWake}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onWake();
      }}
      className="fixed inset-0 z-[130] cursor-pointer border-0 bg-black p-0 outline-none"
    />
  );
}
