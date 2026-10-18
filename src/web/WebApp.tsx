import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { normalizeRoomCode, generateRoomCode } from '../../shared/room-code';
import { getLastHostRoom } from '../core/room/identity';

// Cada pantalla en su propio trozo: quien entra por el QR no descarga la portada ni el 3D,
// y la portada no descarga PeerJS ni el reproductor.
const Landing = lazy(() => import('./Landing').then((m) => ({ default: m.Landing })));
const HostScreen = lazy(() => import('./HostScreen').then((m) => ({ default: m.HostScreen })));
const RiderScreen = lazy(() => import('./RiderScreen').then((m) => ({ default: m.RiderScreen })));

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="label-cluster animate-pulse text-cyan-soft">Encendiendo…</span>
    </div>
  );
}

type Route = { kind: 'landing' } | { kind: 'host'; room: string } | { kind: 'rider'; room: string };

/** La ruta vive en la URL: recargar la página recupera la sala (el carro conserva su token). */
function readRoute(): Route {
  const q = new URLSearchParams(window.location.search);
  const host = normalizeRoomCode(q.get('carro') ?? '');
  if (host) return { kind: 'host', room: host };
  // ?room= es el parámetro de la v1; se sigue aceptando.
  const rider = normalizeRoomCode(q.get('sala') ?? q.get('room') ?? '');
  if (rider) return { kind: 'rider', room: rider };
  return { kind: 'landing' };
}

function writeRoute(r: Route): void {
  const url = r.kind === 'host' ? `/?carro=${r.room}` : r.kind === 'rider' ? `/?sala=${r.room}` : '/';
  window.history.pushState(null, '', url);
}

export function WebApp() {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((r: Route) => {
    writeRoute(r);
    setRoute(r);
    window.scrollTo(0, 0);
  }, []);

  return (
    <Suspense fallback={<Loading />}>
      {route.kind === 'host' ? (
        <HostScreen
          room={route.room}
          onExit={() => go({ kind: 'landing' })}
          onRoomChange={(room) => window.history.replaceState(null, '', `/?carro=${room}`)}
        />
      ) : route.kind === 'rider' ? (
        <RiderScreen room={route.room} onExit={() => go({ kind: 'landing' })} />
      ) : (
        <Landing
          onHost={() => go({ kind: 'host', room: getLastHostRoom() ?? generateRoomCode() })}
          onJoin={(room) => go({ kind: 'rider', room })}
        />
      )}
    </Suspense>
  );
}
