import type { CSSProperties } from 'react';
import './rider/rider.css';
import { screwStyle } from './rider/screw';

/*
 * El código de sala se muestra como una placa de carro: "VIBE-7KQ3" ya tiene forma de
 * matrícula, y en un carro es lo primero que alguien sabe leer y dictar en voz alta.
 *
 * Relieve de placa estampada: chapa con biseles, un filo repujado alrededor, letras en relieve
 * (luz arriba, sombra abajo), tornillos con su ranura y, de vez en cuando, el reflejo de unas
 * luces que pasan (sólo transform: no repinta).
 */

const SIZES = {
  sm: { box: 'px-3.5 pt-[5px] pb-[3px] rounded-[7px]', rim: 'inset-[2px] rounded-[5px]', code: 'text-base', tag: 'text-[0.46rem]', screw: 4, screwX: 4.5 },
  md: { box: 'px-5 py-1.5 rounded-[10px]', rim: 'inset-[3px] rounded-[7px]', code: 'text-2xl', tag: 'text-[0.55rem]', screw: 6, screwX: 7 },
  lg: { box: 'px-8 py-2.5 rounded-[14px]', rim: 'inset-[4px] rounded-[10px]', code: 'text-[2.6rem]', tag: 'text-[0.65rem]', screw: 8, screwX: 10 },
} as const;

const BODY: CSSProperties = {
  background:
    'linear-gradient(115deg, transparent 28%, rgb(207 250 254 / 0.06) 42%, transparent 56%), linear-gradient(172deg, #17313c 0%, #0d1c23 46%, #09141a 56%, #11242d 100%)',
  boxShadow:
    '0 0 0 1px #04070a, 0 7px 14px -7px rgb(0 0 0 / 0.95), 0 0 24px -10px rgb(34 211 238 / 0.65), inset 0 1px 0 rgb(255 255 255 / 0.14), inset 0 -2px 3px rgb(0 0 0 / 0.55)',
};

const RIM: CSSProperties = {
  border: '1px solid rgb(103 232 249 / 0.38)',
  boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.16), inset 0 -1px 0 rgb(0 0 0 / 0.7), 0 1px 0 rgb(0 0 0 / 0.55), 0 -1px 0 rgb(255 255 255 / 0.05)',
};

export function Plate({ code, size = 'md', caption = 'CARBEAT · SALA' }: { code: string; size?: keyof typeof SIZES; caption?: string }) {
  const s = SIZES[size];
  return (
    <div className={`relative inline-flex shrink-0 flex-col items-center overflow-hidden ${s.box}`} style={BODY} aria-label={`Código de sala ${code.split('').join(' ')}`}>
      {/* Filo repujado */}
      <span className={`pointer-events-none absolute ${s.rim}`} style={RIM} aria-hidden="true" />
      {/* Reflejo de luces que pasan */}
      <span className="plate-glint pointer-events-none absolute inset-y-0 -left-1/2 w-1/3" aria-hidden="true" />
      {/* Tornillos */}
      {[{ left: s.screwX }, { right: s.screwX }].map((pos, i) => (
        <span
          key={i}
          className="plate-screw top-1/2"
          style={screwStyle(pos, s.screw, i ? '-25deg' : '40deg')}
          aria-hidden="true"
        />
      ))}
      <span className={`label-cluster relative leading-none text-cyan-soft/65 ${s.tag}`} aria-hidden="true">
        {caption}
      </span>
      <span className={`readout plate-emboss relative font-bold leading-[1.05] tracking-[0.12em] ${s.code}`} aria-hidden="true">
        {code}
      </span>
    </div>
  );
}
