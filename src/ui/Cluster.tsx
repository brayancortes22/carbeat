import { useMemo, type CSSProperties } from 'react';
import type { Track } from '../../shared/track';
import { Gauge } from './Gauge';
import { formatTime } from './controls';
import { RadioDisplay } from './car/RadioDisplay';
import './car/car.css';

/*
 * Cuadro de instrumentos del carro:
 *   [ tiempo de canción ]  [ pantalla central ]  [ volumen ]
 * El indicador de tiempo es el "velocímetro" (va de 0 a la duración en minutos) y el de
 * volumen el "tacómetro" (se puede arrastrar). En pantallas estrechas los indicadores van
 * arriba y la pantalla central debajo (consulta de contenedor, no de ventana).
 *
 * Con `fill` el cuadro ocupa todo el alto que le den y los indicadores se ajustan a ese alto
 * (unidades cqh): así cabe en el APK en horizontal corto (997×448) sin desbordarse.
 */

export interface ClusterProps {
  track: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  requestedBy?: string;
  /** Autotest de agujas: `'hold'` en reposo bajo la secuencia de encendido, `true` barre. */
  ignition?: boolean | 'hold';
  favorite?: boolean;
  onVolume?: (v: number) => void;
  onToggle?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onFavorite?: () => void;
  /** Indicadores más grandes (modo carro del APK, pantalla completa). */
  large?: boolean;
  /** Ocupa el alto del contenedor y ajusta los indicadores a él. */
  fill?: boolean;
  /** Pantalla central compacta (alturas cortas). */
  compact?: boolean;
  className?: string;
}

/**
 * Escala del «velocímetro» en minutos. Hasta 10 min, una marca por minuto; las mezclas largas
 * (en YouTube hay de una hora) pasan a marcas de 2, 5, 10 o 20 min: con la escala fija en 10
 * la aguja se quedaba clavada en el tope casi toda la canción.
 */
function timeScale(duration: number): { majors: string[]; step: number } {
  const mins = Math.ceil(duration / 60) || 5;
  const step = mins <= 10 ? 1 : mins <= 20 ? 2 : mins <= 50 ? 5 : mins <= 100 ? 10 : 20;
  const n = Math.max(3, Math.ceil(mins / step));
  return { majors: Array.from({ length: n + 1 }, (_, i) => String(i * step)), step };
}

export function Cluster({
  track,
  isPlaying,
  position,
  duration,
  volume,
  requestedBy,
  ignition = false,
  favorite = false,
  onVolume,
  onToggle,
  onNext,
  onPrev,
  onFavorite,
  large = false,
  fill = false,
  compact = false,
  className = '',
}: ClusterProps) {
  const { majors, step } = useMemo(() => timeScale(duration), [duration]);
  const scale = (majors.length - 1) * step * 60;
  // En modo «fill» el indicador es tan ancho como su columna, pero nunca más que el alto
  // disponible (es cuadrado). Fuera de él, un tope fijo como antes.
  const gaugeClass = fill ? 'w-full justify-self-center' : `w-full ${large ? 'max-w-[440px]' : 'max-w-[min(330px,40dvh)]'} justify-self-center`;
  const gaugeStyle: CSSProperties | undefined = fill ? { maxWidth: 'min(100%, 100cqh)' } : undefined;

  const timeGauge = (
    <Gauge
      className={gaugeClass}
      value={track && scale ? position / scale : 0}
      label="Tiempo"
      readout={formatTime(position)}
      unit={duration ? `de ${formatTime(duration)}` : 'min'}
      majors={majors}
      minorPerMajor={4}
      redFrom={duration && scale ? Math.max(0, (duration - 15) / scale) : undefined}
      redTo={duration && scale ? Math.min(1, duration / scale) : undefined}
      endMark={duration && scale ? duration / scale : undefined}
      ignition={ignition}
      ariaValueText={`${formatTime(position)} de ${formatTime(duration)}`}
    />
  );
  const volumeGauge = (
    <Gauge
      className={gaugeClass}
      value={volume}
      label="Volumen"
      readout={Math.round(volume * 100)}
      unit="por ciento"
      majors={['0', '2', '4', '6', '8', '10']}
      minorPerMajor={4}
      redFrom={0.9}
      ignition={ignition}
      onChange={onVolume}
      ariaValueText={`Volumen ${Math.round(volume * 100)} %`}
    />
  );
  const radio = (
    <RadioDisplay
      track={track}
      isPlaying={isPlaying}
      position={position}
      duration={duration}
      requestedBy={requestedBy}
      favorite={favorite}
      onToggle={onToggle}
      onNext={onNext}
      onPrev={onPrev}
      onFavorite={onFavorite}
      compact={compact}
    />
  );

  return (
    <section
      className={`@container dash-panel grain ambient-sweep relative overflow-hidden rounded-[30px] ${fill ? 'flex flex-col p-3 @3xl:px-5' : 'p-4 sm:p-6'} ${className}`}
      aria-label="Cuadro de instrumentos"
    >
      {/* Visera: sombra superior como la del tablero real */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent" aria-hidden="true" />
      {/* Retroiluminación que se derrama detrás de cada indicador */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[var(--glow)] bg-[radial-gradient(22%_48%_at_17%_55%,rgb(34_211_238/0.08),transparent_70%),radial-gradient(22%_48%_at_83%_55%,rgb(34_211_238/0.08),transparent_70%)]"
        aria-hidden="true"
      />

      {fill ? (
        <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] items-center gap-3 [container-type:size]">
          <div className="flex h-full w-full items-center justify-center justify-self-center" style={gaugeStyle}>
            {timeGauge}
          </div>
          <div className="flex h-full min-w-0 items-center">{radio}</div>
          <div className="flex h-full w-full items-center justify-center justify-self-center" style={gaugeStyle}>
            {volumeGauge}
          </div>
        </div>
      ) : (
        <div className="relative grid grid-cols-2 items-center gap-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)] @3xl:gap-2">
          <div className="order-1 flex justify-center">{timeGauge}</div>
          <div className="order-3 col-span-2 @3xl:order-2 @3xl:col-span-1">{radio}</div>
          <div className="order-2 flex justify-center @3xl:order-3">{volumeGauge}</div>
        </div>
      )}

      {/* Tira de luz ambiente bajo el cuadro */}
      <span className="ambient-floor pointer-events-none absolute inset-x-[12%] bottom-0 h-px" aria-hidden="true" />
    </section>
  );
}
