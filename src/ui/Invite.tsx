import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import QRCode from 'qrcode';
import { Check, Copy, X } from 'lucide-react';
import { getWebOrigin } from '../core/network/api-config';
import { Plate } from './Plate';

export const joinUrl = (room: string) => `${getWebOrigin()}/?sala=${encodeURIComponent(room)}`;

export function QrCode({ text, size = 220 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#cffafeff', light: '#00000000' } }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [text]);
  return (
    <div
      role="img"
      aria-label={`Código QR para unirse: ${text}`}
      className="[&_svg]:h-full [&_svg]:w-full"
      style={{ width: size, height: size, filter: 'drop-shadow(0 0 10px rgb(34 211 238 / 0.45))' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Tarjeta para que los pasajeros se suban: QR grande + placa para dictar. */
export function InviteCard({ room, compact = false }: { room: string; compact?: boolean }) {
  const url = joinUrl(room);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sin portapapeles */
    }
  };
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="lcd rounded-2xl p-4">
        <QrCode text={url} size={compact ? 160 : 220} />
      </div>
      <Plate code={room} size={compact ? 'md' : 'lg'} />
      <p className="max-w-xs text-sm text-dim">Escanea con la cámara del celular o dicta la placa. No hace falta instalar nada.</p>
      <button type="button" onClick={copy} className="inline-flex items-center gap-2 text-sm text-cyan-soft hover:text-ice">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Enlace copiado' : 'Copiar enlace'}
      </button>
    </div>
  );
}

export function InviteDialog({ room, open, onClose }: { room: string; open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Invitar pasajeros"
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="dash-panel relative rounded-[28px] px-8 pt-10 pb-8"
          >
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 text-faint hover:text-ice">
              <X className="h-5 w-5" />
            </button>
            <InviteCard room={room} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
