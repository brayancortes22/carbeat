import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { generateRoomCode, normalizeRoomCode } from '../../shared/room-code';
import { AppUpdaterService, type UpdateCheckResult } from '../core/updater/app-updater';
import { getLastHostRoom, getLastRiderRoom, setLastRiderRoom } from '../core/room/identity';
import { Onboarding } from './Onboarding';

// El modo carro (cuadro, 3D no) y el modo pasajero son trozos separados: un teléfono de
// pasajero no carga el reproductor ni los paneles del conductor.
const CarApp = lazy(() => import('./CarApp').then((m) => ({ default: m.CarApp })));
const RiderApp = lazy(() => import('./RiderApp').then((m) => ({ default: m.RiderApp })));
const JoinScreen = lazy(() => import('./JoinScreen').then((m) => ({ default: m.JoinScreen })));

export type Role = 'car' | 'rider';
const ROLE_KEY = 'carbeat.app.role';

function readRole(): Role | null {
  try {
    const r = localStorage.getItem(ROLE_KEY);
    return r === 'car' || r === 'rider' ? r : null;
  } catch {
    return null;
  }
}

function writeRole(r: Role | null) {
  try {
    if (r) localStorage.setItem(ROLE_KEY, r);
    else localStorage.removeItem(ROLE_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

/** Mientras llega el trozo de la pantalla: la palabra de encendido en la pantalla del radio. */
function Booting() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3" role="status">
      <span className="dotmatrix text-2xl animate-pulse">ENCENDIENDO</span>
      <span className="h-px w-40 bg-gradient-to-r from-transparent via-cyan to-transparent shadow-[0_0_12px_rgb(34_211_238/0.9)]" aria-hidden="true" />
    </div>
  );
}

export function AppRoot() {
  const reduce = useReducedMotion();
  const [role, setRole] = useState<Role | null>(readRole);
  const [riderRoom, setRiderRoom] = useState<string | null>(() => normalizeRoomCode(getLastRiderRoom() ?? ''));
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null);

  useEffect(() => {
    void AppUpdaterService.checkForUpdates().then((u) => u.hasUpdate && setUpdate(u));
  }, []);

  const choose = useCallback((r: Role | null) => {
    writeRole(r);
    setRole(r);
  }, []);

  const leaveRoom = useCallback(() => {
    setLastRiderRoom(null);
    setRiderRoom(null);
  }, []);

  let screen;
  if (!role) screen = <Onboarding key="onb" onChoose={choose} />;
  else if (role === 'car') screen = <CarApp key="car" room={getLastHostRoom() ?? generateRoomCode()} onSwitchRole={() => choose(null)} />;
  else if (riderRoom) screen = <RiderApp key={`r-${riderRoom}`} room={riderRoom} onLeave={leaveRoom} />;
  else screen = <JoinScreen key="join" onJoin={setRiderRoom} onSwitchRole={() => choose(null)} />;

  return (
    <div className="relative flex min-h-dvh flex-col bg-asphalt">
      <Suspense fallback={<Booting />}>
        <AnimatePresence mode="wait">
          {/* Cambio de pantalla en 3D leve: la nueva sube desde abajo inclinada, como un
              panel que se despliega del salpicadero; la anterior se va hacia atrás. */}
          <motion.div
            key={role ? `${role}-${riderRoom ?? ''}` : 'onb'}
            className="flex flex-1 flex-col"
            style={{ transformPerspective: 1400, transformOrigin: '50% 0%' }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, rotateX: -7, y: 26, scale: 0.985 }}
            animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, rotateX: 5, y: -14, scale: 0.99 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            {screen}
          </motion.div>
        </AnimatePresence>
      </Suspense>
      <AnimatePresence>
        {update && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="lcd fixed inset-x-4 bottom-[calc(var(--sab)+16px)] z-50 flex items-center gap-3 rounded-2xl p-3"
            role="status"
          >
            <span className="min-w-0 flex-1 text-sm text-ice">
              Hay una versión nueva: <b className="readout">{update.latestVersion}</b>
            </span>
            <button type="button" className="press rounded-lg border border-cyan/45 px-3 py-2 font-display text-sm font-semibold tracking-wider text-ice uppercase" onClick={() => AppUpdaterService.triggerApkDownload(update.apkUrl)}>
              Descargar
            </button>
            <button type="button" aria-label="Cerrar aviso" className="px-2 text-faint" onClick={() => setUpdate(null)}>
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
