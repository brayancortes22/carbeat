import { useEffect, useRef, useState } from 'react';
import { Track, QueueItem } from '../../../types/track.types';
import { AiAutopilotService } from '../../../core/ai/ai-autopilot-service';

interface UseHostAutopilotProps {
  currentTrack: Track | null;
  catalog?: Track[];
  queue: QueueItem[];
  onEnqueueTrack: (track: Track) => void;
}

export function useHostAutopilot({
  currentTrack,
  catalog = [],
  queue,
  onEnqueueTrack,
}: UseHostAutopilotProps) {
  const [isAutopilotActive, setIsAutopilotActive] = useState<boolean>(() => {
    return localStorage.getItem('carbeat_autopilot_enabled') === 'true';
  });
  const isPredictingRef = useRef(false);
  const lastPredictedTrackIdRef = useRef<string | null>(null);

  const toggleAutopilot = () => {
    setIsAutopilotActive((prev) => {
      const next = !prev;
      localStorage.setItem('carbeat_autopilot_enabled', String(next));
      if (next) {
        // Al encender, permitir evaluación inmediata
        lastPredictedTrackIdRef.current = null;
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isAutopilotActive) return;

    // Caso 1: Si no hay canción sonando ni en cola, arrancar con una pista del catálogo
    if (!currentTrack && queue.length === 0 && catalog.length > 0) {
      onEnqueueTrack(catalog[0]);
      return;
    }

    if (!currentTrack) return;

    // Caso 2: Solo predecir cuando la cola está vacía o por acabarse (máx 1 canción por delante)
    if (queue.length > 1) return;
    if (isPredictingRef.current) return;
    if (lastPredictedTrackIdRef.current === currentTrack.id) return;

    const timer = setTimeout(async () => {
      isPredictingRef.current = true;
      try {
        const nextTrack = await AiAutopilotService.predictNextTrack(currentTrack, queue);
        if (nextTrack) {
          lastPredictedTrackIdRef.current = currentTrack.id;
          onEnqueueTrack(nextTrack);
        }
      } finally {
        isPredictingRef.current = false;
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isAutopilotActive, currentTrack, catalog, queue.length, onEnqueueTrack]);

  return {
    isAutopilotActive,
    toggleAutopilot,
  };
}
