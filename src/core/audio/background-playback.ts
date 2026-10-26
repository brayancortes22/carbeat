import { useEffect, useRef } from 'react';
import type { HostSession } from '../room/host-session';
import type { PlayerState } from '../../types/player.types';
import { globalAudioEngine } from './audio-player';
import { isNative, native, type BackgroundAudioState } from '../../app/native';

/**
 * Mantiene la música sonando cuando la pantalla se apaga.
 *
 * - APK: un servicio en primer plano (nativo) mantiene vivo el WebView, con wake lock de CPU
 *   y Wi-Fi, notificación y controles en la pantalla de bloqueo.
 * - Navegador: Media Session API, que es lo que Chrome/Android usa para no suspender el audio
 *   al bloquear la pantalla.
 *
 * La reproducción sigue siendo la del AudioEngine; aquí sólo se le dice al sistema que hay
 * una sesión de música activa y se traducen sus botones a acciones de la sala.
 */
export function useBackgroundPlayback(session: HostSession | null, player: PlayerState): void {
  const started = useRef(false);

  // Sincroniza metadatos, carátula y estado con la notificación nativa.
  useEffect(() => {
    if (!isNative) return;
    const state = backgroundStateOf(player);
    if (!state) {
      if (started.current) {
        started.current = false;
        void native.backgroundAudio.disable();
      }
      return;
    }
    if (!started.current) {
      started.current = true;
      void native.backgroundAudio.enable(state);
    } else {
      void native.backgroundAudio.update(state);
    }
  }, [player.currentTrack, player.isPlaying, player.duration]);

  // Al cerrar la cabina / salir de la pantalla del carro se apaga el servicio.
  useEffect(() => {
    if (!isNative) return;
    return () => {
      started.current = false;
      void native.backgroundAudio.disable();
    };
  }, []);

  // Botones de la notificación y de la pantalla de bloqueo.
  useEffect(() => {
    if (!isNative || !session) return;
    return native.backgroundAudio.onAction((action) => {
      const playing = globalAudioEngine.getState().isPlaying;
      if (action === 'play') {
        if (!playing) session.toggle();
      } else if (action === 'pause') {
        if (playing) session.toggle();
      } else if (action === 'next') {
        session.next();
      } else if (action === 'prev') {
        session.prev();
      }
    });
  }, [session]);

  // Navegador (web / PWA): controles del sistema y metadatos.
  useEffect(() => {
    if (isNative || !session) return;
    const ms = mediaSessionOf();
    if (!ms) return;

    const play = () => {
      if (!globalAudioEngine.getState().isPlaying) session.toggle();
    };
    const pause = () => {
      if (globalAudioEngine.getState().isPlaying) session.toggle();
    };
    const next = () => session.next();
    const prev = () => session.prev();

    setHandler(ms, 'play', play);
    setHandler(ms, 'pause', pause);
    setHandler(ms, 'nexttrack', next);
    setHandler(ms, 'previoustrack', prev);
    return () => {
      setHandler(ms, 'play', null);
      setHandler(ms, 'pause', null);
      setHandler(ms, 'nexttrack', null);
      setHandler(ms, 'previoustrack', null);
    };
  }, [session]);

  useEffect(() => {
    if (isNative) return;
    const ms = mediaSessionOf();
    if (!ms) return;
    const track = player.currentTrack;
    if (!track) {
      ms.metadata = null;
      ms.playbackState = 'none';
      return;
    }

    if (typeof MediaMetadata !== 'undefined') {
      ms.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || '',
        album: track.album || '',
        artwork: track.coverUrl ? [{ src: track.coverUrl }] : [],
      });
    }
    ms.playbackState = player.isPlaying ? 'playing' : 'paused';

    // La posición se fija al cambiar de pista/estado; el sistema la extrapola sola.
    if (player.duration > 0 && Number.isFinite(player.currentTime) && Number.isFinite(player.duration)) {
      try {
        ms.setPositionState({
          duration: player.duration,
          playbackRate: 1,
          position: Math.max(0, Math.min(player.currentTime, player.duration)),
        });
      } catch {
        /* algunas versiones no aceptan la posición todavía */
      }
    }
  }, [player.currentTrack, player.isPlaying]);
}

function backgroundStateOf(player: PlayerState): BackgroundAudioState | null {
  const track = player.currentTrack;
  if (!track) return null;
  return {
    title: track.title,
    artist: track.artist || '',
    album: track.album || '',
    coverUrl: track.coverUrl || '',
    playing: player.isPlaying,
    position: Number.isFinite(player.currentTime) ? Math.max(0, player.currentTime) : 0,
    duration: player.duration > 0 ? player.duration : track.duration || 0,
  };
}

function mediaSessionOf(): MediaSession | null {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return null;
  return navigator.mediaSession;
}

function setHandler(ms: MediaSession, action: MediaSessionAction, handler: (() => void) | null): void {
  try {
    ms.setActionHandler(action, handler);
  } catch {
    /* acción no soportada por este navegador */
  }
}
