import { useId, type CSSProperties } from 'react';
import { normalizeRoomCode } from '../../../shared/room-code';
import './rider.css';
import { screwStyle } from './screw';

/*
 * Piezas de la entrada del APK: el campo de placa repujada y las barras de "en tu red".
 */

const PREFIXES = ['BEAT', 'RIDE', 'VIBE', 'AUTO', 'RUTA'];
/** Símbolos que nunca lleva una placa de CarBeat (se confunden al dictarlos). */
const AMBIGUOUS = /[01ILOUV]/;

/**
 * Formatea mientras se escribe: mayúsculas, sólo letras y números, y el guion tras el prefijo
 * de 4 letras. Al borrar no se vuelve a poner el guion (si no, "VIBE-" no se dejaría borrar).
 */
export function formatPlate(next: string, prev: string): string {
  const raw = next.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const deleting = next.length < prev.length;
  if (raw.length > 4) return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  if (raw.length === 4 && !deleting && PREFIXES.includes(raw)) return `${raw}-`;
  return raw;
}

export type PlateCheck = 'empty' | 'typing' | 'ok' | 'bad-prefix' | 'bad-char';

export function checkPlate(code: string): PlateCheck {
  const raw = code.replace(/-/g, '');
  if (!raw) return 'empty';
  if (normalizeRoomCode(code)) return 'ok';
  const head = raw.slice(0, 4);
  if (!PREFIXES.some((p) => p.startsWith(head))) return 'bad-prefix';
  if (AMBIGUOUS.test(raw.slice(4))) return 'bad-char';
  return 'typing';
}

export const PLATE_HINT: Record<PlateCheck, string> = {
  empty: 'Está en la pantalla del carro, bajo el QR.',
  typing: 'Sigue: 4 letras, guion y 4 símbolos.',
  ok: 'Placa completa.',
  'bad-prefix': 'Empieza por BEAT, RIDE, VIBE, AUTO o RUTA.',
  'bad-char': 'Las placas no usan 0, O, 1, I, L, U ni V.',
};

const LED: Record<PlateCheck, string> = {
  empty: 'bg-white/10',
  typing: 'bg-cyan/60 shadow-[0_0_6px_rgb(34_211_238/0.7)]',
  ok: 'bg-go shadow-[0_0_10px_rgb(52_211_153/0.95)]',
  'bad-prefix': 'bg-amber shadow-[0_0_8px_rgb(255_176_32/0.9)]',
  'bad-char': 'bg-amber shadow-[0_0_8px_rgb(255_176_32/0.9)]',
};

const BODY: CSSProperties = {
  background:
    'linear-gradient(115deg, transparent 30%, rgb(207 250 254 / 0.05) 44%, transparent 58%), linear-gradient(172deg, #17313c 0%, #0d1c23 46%, #09141a 56%, #11242d 100%)',
  boxShadow:
    '0 0 0 1px #04070a, 0 14px 28px -12px rgb(0 0 0 / 0.95), 0 0 34px -12px rgb(34 211 238 / 0.6), inset 0 1px 0 rgb(255 255 255 / 0.14), inset 0 -3px 5px rgb(0 0 0 / 0.55)',
};

/** Campo de placa con aspecto de matrícula estampada. */
export function PlateInput({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter?: () => void }) {
  const hintId = useId();
  const state = checkPlate(value);
  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-[16px] px-10 pt-2 pb-2.5" style={BODY}>
        <span
          className="pointer-events-none absolute inset-[5px] rounded-[11px]"
          style={{ border: '1px solid rgb(103 232 249 / 0.36)', boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.16), inset 0 -1px 0 rgb(0 0 0 / 0.7), 0 1px 0 rgb(0 0 0 / 0.55)' }}
          aria-hidden="true"
        />
        {[{ left: 14 }, { right: 14 }].map((pos, i) => (
          <span key={i} className="plate-screw top-1/2" style={screwStyle(pos, 9, i ? '-20deg' : '45deg')} aria-hidden="true" />
        ))}
        <span className="flex items-center justify-center gap-2">
          <span className="label-cluster text-[0.6rem] leading-none text-cyan-soft/65">CarBeat · Sala</span>
          <span className={`h-1.5 w-1.5 rounded-full transition-[background,box-shadow] duration-300 ${LED[state]}`} aria-hidden="true" />
        </span>
        <input
          value={value}
          onChange={(e) => onChange(formatPlate(e.target.value, value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEnter?.();
          }}
          placeholder="VIBE-7KQ3"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="go"
          maxLength={9}
          aria-label="Placa de la sala"
          aria-describedby={hintId}
          aria-invalid={state === 'bad-prefix' || state === 'bad-char'}
          className="readout plate-emboss relative mt-0.5 h-12 w-full bg-transparent text-center text-[2.15rem] leading-none font-bold tracking-[0.13em] placeholder:text-cyan/15 placeholder:[text-shadow:none] focus:outline-none"
        />
      </div>
      <p id={hintId} className={`mt-2 text-center text-sm ${state === 'ok' ? 'text-go' : state.startsWith('bad') ? 'text-amber' : 'text-dim'}`} aria-live="polite">
        {PLATE_HINT[state]}
      </p>
    </div>
  );
}

/** Barras de señal: el carro está en tu misma red. Es un icono, no una medida de intensidad
 * (el servidor no la da). Suben una a una al aparecer el carro. */
export function SignalBars() {
  return (
    <span className="inline-flex h-4 items-end gap-[2px]" role="img" aria-label="En tu misma red">
      {[0.35, 0.55, 0.78, 1].map((h, i) => (
        <span
          key={i}
          className="signal-bar w-[3px] rounded-[1px] bg-cyan-soft shadow-[0_0_6px_rgb(34_211_238/0.7)]"
          style={{ height: `${h * 100}%`, animationDelay: `${120 + i * 90}ms` }}
        />
      ))}
    </span>
  );
}
