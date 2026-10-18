// Laboratorio de salas: mide la red de verdad en el navegador (sólo desarrollo).
// No entra en ningún build: lab.html no está en los inputs de vite.config.ts.

import { HostSession, type PlayerPort } from '../core/room/host-session';
import { RiderSession, type RiderView } from '../core/room/rider-session';
import { scoreOf } from '../../shared/protocol';
import type { Track } from '../../shared/track';
import type { PlayerState } from '../types/player.types';

const out = document.getElementById('out')!;
const log = (...a: unknown[]) => {
  out.textContent += '\n' + a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class FakePlayer implements PlayerPort {
  private s: PlayerState = { currentTrack: null, isPlaying: false, currentTime: 0, duration: 0, volume: 1, isMuted: false };
  private subs = new Set<(s: PlayerState) => void>();
  private ended: (() => void) | null = null;
  constructor() {
    setInterval(() => {
      if (!this.s.isPlaying) return;
      this.s = { ...this.s, currentTime: this.s.currentTime + 1 };
      if (this.s.currentTime >= this.s.duration) {
        this.s = { ...this.s, isPlaying: false };
        this.ended?.();
      }
      this.emit();
    }, 1000);
  }
  private emit() {
    for (const f of this.subs) f(this.s);
  }
  getState = () => this.s;
  load = (t: Track, autoplay: boolean) => {
    this.s = { ...this.s, currentTrack: t, isPlaying: autoplay, currentTime: 0, duration: t.duration || 200 };
    this.emit();
  };
  toggle = () => {
    this.s = { ...this.s, isPlaying: !this.s.isPlaying };
    this.emit();
  };
  pause = () => {
    this.s = { ...this.s, isPlaying: false };
    this.emit();
  };
  seek = (n: number) => {
    this.s = { ...this.s, currentTime: n };
    this.emit();
  };
  subscribe = (cb: (s: PlayerState) => void) => {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  };
  onEnded = (cb: () => void) => {
    this.ended = cb;
  };
}

const song = (id: string, title: string): Track => ({
  id: `yt_${id}`,
  title,
  artist: 'Lab',
  duration: 240,
  source: 'stream',
  audioUrl: '',
  videoId: id,
});

async function stats(): Promise<{ commands: number; requests: number }> {
  return (await fetch('/api/_dev/stats')).json();
}

function waitFor(r: RiderSession, pred: (v: RiderView) => boolean, timeout = 15000): Promise<number> {
  const t0 = performance.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (pred(r.getView())) {
        un();
        clearTimeout(to);
        resolve(Math.round(performance.now() - t0));
      }
    };
    const un = r.subscribe(check);
    const to = setTimeout(() => {
      un();
      reject(new Error('timeout'));
    }, timeout);
    check();
  });
}

async function scenario(kind: 'p2p' | 'http') {
  const httpOnly = kind === 'http';
  const channels = httpOnly ? { p2p: false, lan: false, local: false } : { lan: false, local: false };
  const player = new FakePlayer();
  const host = new HostSession({ name: 'Carro lab', player, autopilot: 'off', channels });
  await host.start();
  const room = host.getView().room;
  log(`sala ${room} · canales ${JSON.stringify(channels)} · nube ${host.getView().cloud}`);

  const riders = ['ana', 'beto', 'caro'].map((n) => new RiderSession(room, n, channels, `lab_${n}_${Date.now()}`));
  riders.forEach((r) => r.start());
  const connectMs = await Promise.all(riders.map((r) => waitFor(r, (v) => v.status === 'live', 30000)));
  log('conectar (ms):', connectMs, 'vía:', riders.map((r) => r.getView().via));

  const c0 = await stats();
  const [ana, beto, caro] = riders;

  // 1) Ana pide con nada sonando -> suena ya.
  void ana.request(song('labAAAAAAA1', 'Primera'));
  const tPlay = await waitFor(beto, (v) => v.snapshot?.now?.track.title === 'Primera');
  // 2) Beto pide otra -> cola; Caro pide la misma -> voto.
  void beto.request(song('labBBBBBBB2', 'Segunda'));
  const tQueue = await waitFor(ana, (v) => !!v.snapshot?.queue.some((e) => e.track.title === 'Segunda'));
  void caro.request(song('labBBBBBBB2', 'Segunda'));
  const tVote = await waitFor(ana, (v) => scoreOf(v.snapshot?.queue[0] ?? { votes: {} }) === 2);
  // 3) Beto vuelve a pedirla (duplicado): no debe sumar.
  void beto.request(song('labBBBBBBB2', 'Segunda'));
  const tNotice = await waitFor(beto, (v) => v.toasts.some((t) => t.text === 'Ya la tienes pedida'));
  await sleep(1500);
  const finalScore = scoreOf(ana.getView().snapshot!.queue[0]);
  // 4) Control remoto: siguiente.
  void ana.control('next');
  const tNext = await waitFor(caro, (v) => v.snapshot?.now?.track.title === 'Segunda');

  const c1 = await stats();
  log('latencias (ms): suena', tPlay, '· cola', tQueue, '· voto', tVote, '· aviso duplicado', tNotice, '· siguiente', tNext);
  log('puntuación final de "Segunda" tras pedido duplicado:', finalScore, '(esperado 2)');
  log('comandos Redis durante el guion:', c1.commands - c0.commands, '· peticiones HTTP al almacén:', c1.requests - c0.requests);

  // 5) Coste en reposo: 60 s sin hacer nada.
  const i0 = await stats();
  await sleep(60_000);
  const i1 = await stats();
  const perMin = i1.commands - i0.commands;
  log(`reposo 60 s: ${perMin} comandos (≈ ${perMin * 60} por hora con 1 carro y 3 pasajeros)`);

  await host.close();
  await sleep(2500);
  log('estado tras cerrar:', riders.map((r) => r.getView().status));
  riders.forEach((r) => r.dispose());
  (window as unknown as { __lab: unknown }).__lab = { done: true, kind, connectMs, tPlay, tQueue, tVote, tNotice, tNext, finalScore, perMin };
  log('FIN');
}

const s = new URLSearchParams(location.search).get('s') ?? 'p2p';
scenario(s === 'http' ? 'http' : 'p2p').catch((e) => {
  log('ERROR', String(e));
  (window as unknown as { __lab: unknown }).__lab = { done: true, error: String(e) };
});
