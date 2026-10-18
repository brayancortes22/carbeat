import type { HostView } from '../core/room/host-session';
import type { TelltaleState } from './Telltale';

/** Qué testigos se encienden según el estado de la sala del carro. */
export function telltales(view: HostView) {
  const p2p: TelltaleState =
    view.links.p2p === 'open' ? (view.p2pPeers > 0 ? 'on' : 'info') : view.links.p2p === 'connecting' ? 'blink' : view.links.p2p === 'error' ? 'alert' : 'off';
  const cloud: TelltaleState = view.cloud === 'online' ? 'on' : view.cloud === 'connecting' ? 'blink' : view.cloud === 'offline' ? 'warn' : 'alert';
  const riders = Object.keys(view.engine.riders).length;
  const cruise: TelltaleState = view.autopilot === 'off' ? 'off' : view.autopilotBusy ? 'blink' : 'on';
  return { p2p, cloud, lan: (view.links.lan === 'open' ? 'on' : 'off') as TelltaleState, riders, cruise };
}
