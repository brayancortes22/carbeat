import './rider.css';

/*
 * Atajos de género como las teclas de presintonía de un radio de carro: numeradas, el número
 * en matriz de puntos, se hunden al pulsar y la emisora activa queda enclavada e iluminada.
 * Es lo que un pasajero ya sabe usar sin leer: "pon la 3".
 */
export function PresetKeys({
  presets,
  active,
  onTune,
}: {
  presets: readonly { label: string; q: string }[];
  /** Consulta actual: la tecla cuya búsqueda coincide queda encendida. */
  active: string;
  onTune: (q: string) => void;
}) {
  const current = active.trim().toLowerCase();
  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Presintonías por género">
      {presets.map((p, i) => {
        const on = current === p.q.toLowerCase();
        return (
          <button key={p.q} type="button" className="preset-key" aria-pressed={on} onClick={() => onTune(on ? '' : p.q)} aria-label={`Presintonía ${i + 1}: ${p.label}`}>
            <span className="flex w-full items-center justify-between">
              <span className={`dotmatrix text-[1.15rem] leading-none ${on ? '' : 'opacity-45'}`} aria-hidden="true">
                {i + 1}
              </span>
              <span className="preset-led" aria-hidden="true" />
            </span>
            {/* Interlineado holgado: con 1.05 el line-clamp recortaba la tilde de REGGAETÓN (visto en captura) */}
            <span className="line-clamp-2 pt-0.5 font-display text-[0.7rem] leading-[1.2] font-bold tracking-[0.06em] uppercase [font-stretch:72%]" aria-hidden="true">
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
