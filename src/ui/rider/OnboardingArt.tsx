import './rider.css';

/*
 * Ilustraciones vivas de la bienvenida del APK. Decorativas (aria-hidden): no muestran datos.
 * Sólo se animan transform y opacity.
 */

const C = 50;
const CY = 52;
const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: CY - r * Math.cos(a) };
};
const arc = (r: number, from: number, to: number) => {
  const s = polar(from, r);
  const e = polar(to, r);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
};

/** Mini cuadro de instrumentos con la aguja haciendo el autotest de encendido. */
export function MiniGauge() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="mg-bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a5866" />
          <stop offset="50%" stopColor="#11171d" />
          <stop offset="100%" stopColor="#323e49" />
        </linearGradient>
        <radialGradient id="mg-face" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#0f222b" />
          <stop offset="100%" stopColor="#04080b" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={CY} r={47} fill="url(#mg-bezel)" />
      <circle cx={C} cy={CY} r={43.5} fill="url(#mg-face)" />
      <path d={arc(37, -130, 130)} fill="none" stroke="rgb(34 211 238 / 0.15)" strokeWidth="3" strokeLinecap="round" />
      <path d={arc(37, -130, 55)} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 2.5px rgb(34 211 238 / 0.9))' }} />
      <path d={arc(37, 95, 130)} fill="none" stroke="#ff453a" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      {Array.from({ length: 11 }, (_, i) => {
        const d = -130 + i * 26;
        const a = polar(d, 31);
        const b = polar(d, i % 2 ? 28.5 : 25.5);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={i % 2 ? 'rgb(139 162 176 / 0.5)' : '#cffafe'} strokeWidth={i % 2 ? 1 : 1.8} strokeLinecap="round" />;
      })}
      <g className="mini-needle">
        <line x1={C} y1={CY + 6} x2={C} y2={CY - 31} stroke="#ff5a36" strokeWidth="2.6" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 3px rgb(255 90 54 / 0.8))' }} />
      </g>
      <circle cx={C} cy={CY} r={4.5} fill="#e2f4f9" />
      <circle cx={C} cy={CY} r={2} fill="#0b1116" />
      <path d={arc(47, -60, 20)} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Celular con la cola en pantalla y ondas de señal saliendo hacia el carro. */
export function PhonePulse() {
  const top = 30;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="pp-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f3442" />
          <stop offset="100%" stopColor="#061117" />
        </linearGradient>
        <linearGradient id="pp-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a4855" />
          <stop offset="55%" stopColor="#141b22" />
          <stop offset="100%" stopColor="#2a3540" />
        </linearGradient>
      </defs>
      {[12, 21, 30].map((r, i) => (
        <path
          key={r}
          className="signal-wave"
          d={`M ${50 - r * 0.72} ${top - r * 0.5} A ${r} ${r} 0 0 1 ${50 + r * 0.72} ${top - r * 0.5}`}
          fill="none"
          stroke="#67e8f9"
          strokeWidth="2.6"
          strokeLinecap="round"
          style={{ transformBox: 'view-box', transformOrigin: `50px ${top}px`, animationDelay: `${i * 0.28}s`, filter: 'drop-shadow(0 0 3px rgb(34 211 238 / 0.9))' }}
        />
      ))}
      <rect x="33" y={top + 2} width="34" height="64" rx="7" fill="url(#pp-body)" />
      <rect x="35.5" y={top + 4.5} width="29" height="59" rx="5" fill="#04070a" />
      <rect x="37.5" y={top + 9} width="25" height="46" rx="2" fill="url(#pp-screen)" />
      {/* Cola en miniatura: portada + título + voto */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i} opacity={i === 0 ? 1 : 0.7 - i * 0.12}>
          <rect x="39.5" y={top + 12 + i * 10.5} width="6" height="6" rx="1.2" fill={i === 0 ? '#22d3ee' : '#2a4653'} />
          <rect x="47.5" y={top + 12.6 + i * 10.5} width={i === 0 ? 11 : 9 - i} height="1.8" rx="0.9" fill="#cffafe" opacity="0.85" />
          <rect x="47.5" y={top + 15.4 + i * 10.5} width="7" height="1.4" rx="0.7" fill="#8ba2b0" opacity="0.6" />
        </g>
      ))}
      <rect x="45" y={top + 6} width="10" height="1.4" rx="0.7" fill="#1d2731" />
      <circle cx="50" cy={top + 59.5} r="1.6" fill="#1d2731" />
      <path d={`M 36 ${top + 6} L 44 ${top + 6}`} stroke="rgb(255 255 255 / 0.15)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/** Carretera de noche en perspectiva al pie de la pantalla: las líneas vienen hacia ti. */
export function RoadFloor() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] overflow-hidden [mask-image:linear-gradient(to_top,black_20%,transparent_92%)]"
      style={{ perspective: '260px', perspectiveOrigin: '50% 0%' }}
      aria-hidden="true"
    >
      <div className="absolute bottom-[-30%] left-1/2 h-[260%] w-[150%] origin-bottom" style={{ transform: 'translateX(-50%) rotateX(74deg)' }}>
        {/* Asfalto y bordes de la vía */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_6%,#071016_14%,#0a151b_50%,#071016_86%,transparent_94%)]" />
        <div className="absolute inset-y-0 left-[16%] w-[3px] bg-cyan/70 shadow-[0_0_14px_3px_rgb(34_211_238/0.55)]" />
        <div className="absolute inset-y-0 right-[16%] w-[3px] bg-cyan/70 shadow-[0_0_14px_3px_rgb(34_211_238/0.55)]" />
        {/* Línea central discontinua: sólo se traslada */}
        <div className="absolute inset-y-0 left-1/2 w-[5px] -translate-x-1/2 overflow-hidden">
          <div className="road-lines absolute inset-x-0 top-0 h-[calc(100%+128px)] bg-[repeating-linear-gradient(to_bottom,transparent_0_34px,rgb(207_250_254/0.75)_34px_64px)]" />
        </div>
      </div>
    </div>
  );
}
