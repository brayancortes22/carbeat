import { useSyncExternalStore } from 'react';
import { Sliders, X, Volume2 } from 'lucide-react';
import { equalizerService, EQ_PRESETS, type EqualizerPreset, type EqualizerGains } from '../../core/audio/equalizer-service';
import { Key } from '../controls';

export function EqualizerModal({ onClose }: { onClose: () => void }) {
  useSyncExternalStore(equalizerService.subscribe, () => equalizerService.getPreset() + JSON.stringify(equalizerService.getGains()));

  const gains = equalizerService.getGains();
  const currentPreset = equalizerService.getPreset();

  const handleSliderChange = (band: keyof EqualizerGains, val: number) => {
    equalizerService.setGain(band, val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-label="Ecualizador Car Audio">
      <div className="relative flex w-full max-w-lg flex-col gap-5 rounded-[28px] border border-cyan/30 bg-[#07131b] p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <Sliders className="h-6 w-6 text-cyan" />
            <h2 className="font-display text-xl font-bold tracking-wider text-ice uppercase">
              Ecualizador Car Audio Pro
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-faint hover:bg-white/10 hover:text-ink"
            aria-label="Cerrar ecualizador"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Presets Rápidos */}
        <div className="flex flex-col gap-2">
          <p className="label-cluster text-xs text-cyan-soft">Perfiles de Sonido Automotriz</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(EQ_PRESETS) as Exclude<EqualizerPreset, 'custom'>[]).map((key) => {
              const active = currentPreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => equalizerService.applyPreset(key)}
                  className={`rounded-xl border px-2.5 py-2 text-center font-display text-xs font-semibold tracking-wide uppercase transition-all ${
                    active
                      ? 'border-cyan bg-cyan/20 text-ice shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                      : 'border-white/10 bg-white/[0.03] text-dim hover:border-white/20 hover:text-ink'
                  }`}
                >
                  {EQ_PRESETS[key].name.split(' (')[0]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Faders / Sliders Paramétricos */}
        <div className="grid grid-cols-3 gap-4 rounded-2xl border border-white/5 bg-black/40 p-4">
          {/* Bajos */}
          <div className="flex flex-col items-center gap-2">
            <span className="font-display text-xs font-bold tracking-widest text-cyan uppercase">Bajos</span>
            <span className="text-[0.68rem] text-faint">80 Hz (Sub)</span>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={gains.bass}
              onChange={(e) => handleSliderChange('bass', Number(e.target.value))}
              className="h-32 w-2.5 cursor-pointer accent-cyan [writing-mode:vertical-lr] [direction:rtl]"
            />
            <span className="readout text-sm font-extrabold text-ice">
              {gains.bass > 0 ? `+${gains.bass}` : gains.bass} dB
            </span>
          </div>

          {/* Medios */}
          <div className="flex flex-col items-center gap-2">
            <span className="font-display text-xs font-bold tracking-widest text-cyan uppercase">Medios</span>
            <span className="text-[0.68rem] text-faint">1 kHz (Voces)</span>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={gains.mid}
              onChange={(e) => handleSliderChange('mid', Number(e.target.value))}
              className="h-32 w-2.5 cursor-pointer accent-cyan [writing-mode:vertical-lr] [direction:rtl]"
            />
            <span className="readout text-sm font-extrabold text-ice">
              {gains.mid > 0 ? `+${gains.mid}` : gains.mid} dB
            </span>
          </div>

          {/* Agudos */}
          <div className="flex flex-col items-center gap-2">
            <span className="font-display text-xs font-bold tracking-widest text-cyan uppercase">Agudos</span>
            <span className="text-[0.68rem] text-faint">8 kHz (Brillo)</span>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={gains.treble}
              onChange={(e) => handleSliderChange('treble', Number(e.target.value))}
              className="h-32 w-2.5 cursor-pointer accent-cyan [writing-mode:vertical-lr] [direction:rtl]"
            />
            <span className="readout text-sm font-extrabold text-ice">
              {gains.treble > 0 ? `+${gains.treble}` : gains.treble} dB
            </span>
          </div>
        </div>

        {/* Pie */}
        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-1.5 text-xs text-dim">
            <Volume2 className="h-4 w-4 text-cyan" />
            Ajuste en tiempo real en los parlantes
          </span>
          <Key variant="primary" size="sm" onClick={onClose}>
            Listo
          </Key>
        </div>
      </div>
    </div>
  );
}
