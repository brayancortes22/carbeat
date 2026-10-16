import React from 'react';
import { ExternalLink, Smartphone, Tablet, RotateCcw } from 'lucide-react';

export type DeviceType = 'tablet' | 'iphone' | 'android';

interface DeviceFrameProps {
  type: DeviceType;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: 'cyan' | 'purple' | 'amber';
  width: number;
  height: number;
  src: string;
  onReload: () => void;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  type,
  title,
  subtitle,
  badge,
  badgeColor,
  width,
  height,
  src,
  onReload,
  iframeRef,
}) => {
  const badgeClasses = {
    cyan: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  }[badgeColor];

  const handleOpenExternal = () => {
    window.open(src, '_blank', `width=${width},height=${height}`);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Barra superior de información del dispositivo */}
      <div className="w-full flex items-center justify-between pb-2.5 px-2 max-w-full">
        <div className="flex items-center gap-2">
          {type === 'tablet' ? (
            <Tablet className="w-4 h-4 text-cyan-400" />
          ) : (
            <Smartphone className="w-4 h-4 text-purple-400" />
          )}
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight">{title}</h3>
            <p className="text-[10px] text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badgeClasses}`}>
            {badge}
          </span>
          <button
            onClick={onReload}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            title="Reiniciar dispositivo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleOpenExternal}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            title="Abrir en ventana independiente"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chasis físico del dispositivo con biseles y sombras realistas */}
      <div
        className={`relative bg-[#0d0f17] p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(255,255,255,0.05)] border border-white/15 transition-all ${
          type === 'iphone'
            ? 'rounded-[46px] ring-2 ring-white/10'
            : type === 'android'
            ? 'rounded-[36px] ring-1 ring-white/10'
            : 'rounded-2xl ring-1 ring-cyan-500/20'
        }`}
        style={{ width: `${width + 20}px` }}
      >
        {/* Notch / Dynamic Island / Cámara Frontal */}
        {type === 'iphone' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-30 flex items-center justify-between px-2.5 shadow-md">
            <div className="w-2.5 h-2.5 rounded-full bg-[#0d1224] ring-1 ring-white/10" />
            <div className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
          </div>
        )}
        {type === 'android' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-black rounded-full z-30 ring-1 ring-white/20" />
        )}
        {type === 'tablet' && (
          <div className="absolute top-1/2 left-3 -translate-y-1/2 w-2 h-2 bg-black rounded-full z-30 ring-1 ring-white/20" />
        )}

        {/* Pantalla del dispositivo (Viewport IFrame) */}
        <div
          className="relative overflow-hidden bg-black shadow-inner"
          style={{
            width: `${width}px`,
            height: `${height}px`,
            borderRadius: type === 'iphone' ? '38px' : type === 'android' ? '28px' : '12px',
          }}
        >
          <iframe
            ref={iframeRef as any}
            src={src}
            title={title}
            className="w-full h-full border-0 select-none"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
          />
        </div>
      </div>
    </div>
  );
};
