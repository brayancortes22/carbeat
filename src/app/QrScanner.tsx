import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { DotMatrix } from '../ui/kit';

/*
 * Escáner de QR propio: cámara trasera en el WebView + decodificación con jsQR.
 *
 * Por qué no el plugin oficial de escaneo: traía el modelo nativo de ML Kit para 4
 * arquitecturas y el APK pasaba de 4,5 MB a 37,8 MB (medido). jsQR son ~45 kB comprimidos
 * y se cargan sólo al abrir el escáner.
 */

type Props = { onResult: (text: string) => void; onClose: () => void };

export function QrScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let last = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    (async () => {
      try {
        const [{ default: jsQR }] = await Promise.all([import('jsqr')]);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
        const video = videoRef.current;
        if (!video || stopped) return;
        video.srcObject = stream;
        await video.play();
        const tick = (t: number) => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          // 6-7 lecturas por segundo bastan y no calientan el teléfono.
          if (t - last < 150 || video.readyState < 2 || !ctx) return;
          last = t;
          const w = 480;
          const h = Math.round((video.videoHeight / video.videoWidth) * w) || 480;
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
          if (code?.data) {
            stopped = true;
            onResult(code.data);
          }
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        const name = (err as { name?: string })?.name;
        setError(name === 'NotAllowedError' ? 'Sin permiso para la cámara. Actívalo en Ajustes > Apps > CarBeat.' : 'No se pudo abrir la cámara.');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [onResult]);

  return (
    <motion.div className="fixed inset-0 z-50 bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Escanear QR">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
      {/* Visor: esquinas de mira como un HUD del tablero */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle,transparent_32%,rgb(0_0_0/0.7)_33%)]">
        <div className="relative h-[68vw] max-h-80 w-[68vw] max-w-80">
          {['top-0 left-0 border-t-4 border-l-4', 'top-0 right-0 border-t-4 border-r-4', 'bottom-0 left-0 border-b-4 border-l-4', 'bottom-0 right-0 border-b-4 border-r-4'].map((c) => (
            // drop-shadow y no box-shadow: la sombra de caja rodeaba el cuadrado entero y las
            // esquinas de mira se veían como cuatro cajas (visto en captura).
            <span key={c} className={`absolute h-10 w-10 rounded-sm border-cyan [filter:drop-shadow(0_0_6px_rgb(34_211_238/0.9))] ${c}`} />
          ))}
          {/* Línea de barrido: la animación "scan" mueve ±100 % de la altura del elemento; sobre
              una línea de 2 px apenas se movía. Va dentro de una caja de media altura con la
              línea en su borde inferior, así recorre la mira de arriba abajo. */}
          <span className="absolute inset-x-3 top-0 h-1/2 animate-[scan_2.2s_ease-in-out_infinite_alternate]">
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-cyan/70 shadow-[0_0_12px_rgb(34_211_238/0.9)]" />
          </span>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-[calc(var(--sab)+32px)] flex flex-col items-center gap-3 px-6 text-center">
        {/* Pantalla de radio con el estado: el mismo lenguaje que el resto de la app */}
        <div className="lcd lcd-grid relative w-full max-w-xs rounded-xl px-3 py-2" aria-hidden="true">
          <DotMatrix className={`text-base ${error ? 'text-[#ffd2cf] [text-shadow:0_0_10px_rgb(255_69_58/0.6)]' : ''}`}>{error ? 'SIN CÁMARA' : 'BUSCANDO QR…'}</DotMatrix>
        </div>
        <p className={`text-base ${error ? 'text-amber' : 'text-ice'}`} role={error ? 'alert' : undefined}>
          {error ?? 'Apunta al QR de la pantalla del carro'}
        </p>
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar escáner" className="press absolute top-[calc(var(--sat)+16px)] right-5 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-ice">
        <X className="h-6 w-6" />
      </button>
    </motion.div>
  );
}
