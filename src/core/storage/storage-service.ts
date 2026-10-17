import { Track, QueueItem } from '../../types/track.types';

const STORAGE_KEYS = {
  CATALOG: 'carbeat_local_catalog_v3',
  QUEUE: 'carbeat_local_queue_v3', // v3: purga automática de cualquier cola sucia previa
  DRIVER_LIBRARY: 'carbeat_driver_library_v1',
  PLAYBACK_HISTORY: 'carbeat_playback_history_v1',
  ROOM_ID: 'carbeat_saved_room_id',
  DJ_NAME: 'carbeat_saved_dj_name',
} as const;

export class StorageService {
  public static deduplicateTracks(tracks: Track[]): Track[] {
    const seen = new Set<string>();
    const result: Track[] = [];
    for (const t of tracks) {
      if (!t || !t.title) continue;
      const key = `${t.title.toLowerCase().trim()}_${(t.artist || '').toLowerCase().trim()}`;
      if (!seen.has(key) && !seen.has(t.id)) {
        seen.add(key);
        seen.add(t.id);
        result.push(t);
      }
    }
    return result;
  }

  public static deduplicateQueue(queue: QueueItem[]): QueueItem[] {
    const seen = new Set<string>();
    const cleanQueue: QueueItem[] = [];
    for (const item of queue) {
      if (!item?.track?.title) continue;
      const key = `${item.track.title.toLowerCase().trim()}_${(item.track.artist || '').toLowerCase().trim()}`;
      if (!seen.has(key) && !seen.has(item.track.id) && !seen.has(item.queueId)) {
        seen.add(key);
        seen.add(item.track.id);
        seen.add(item.queueId);
        cleanQueue.push(item);
      }
    }
    return cleanQueue.sort((a, b) => b.votes - a.votes);
  }

  public static saveCatalog(tracks: Track[]): void {
    try {
      if (typeof window === 'undefined') return;
      const clean = this.deduplicateTracks(tracks);
      localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(clean));
    } catch (e) {
      console.warn('[StorageService] Error guardando catálogo en localStorage:', e);
    }
  }

  public static loadCatalog(fallback: Track[] = []): Track[] {
    try {
      if (typeof window === 'undefined') return fallback;
      const data = localStorage.getItem(STORAGE_KEYS.CATALOG);
      if (!data) return this.deduplicateTracks(fallback);
      const parsed = JSON.parse(data) as Track[];
      return Array.isArray(parsed) && parsed.length > 0 ? this.deduplicateTracks(parsed) : this.deduplicateTracks(fallback);
    } catch {
      return fallback;
    }
  }

  public static saveQueue(queue: QueueItem[]): void {
    try {
      if (typeof window === 'undefined') return;
      const cleanQueue = this.deduplicateQueue(queue);
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(cleanQueue));
    } catch (e) {
      console.warn('[StorageService] Error guardando cola en localStorage:', e);
    }
  }

  public static loadQueue(): QueueItem[] {
    try {
      if (typeof window === 'undefined') return [];
      const data = localStorage.getItem(STORAGE_KEYS.QUEUE);
      if (!data) return [];
      const parsed = JSON.parse(data) as QueueItem[];
      return Array.isArray(parsed) ? this.deduplicateQueue(parsed) : [];
    } catch {
      return [];
    }
  }

  public static clearQueue(): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(STORAGE_KEYS.QUEUE);
    } catch {}
  }

  public static loadDriverLibrary(): Track[] {
    try {
      if (typeof window === 'undefined') return [];
      const data = localStorage.getItem(STORAGE_KEYS.DRIVER_LIBRARY);
      if (!data) return [];
      const parsed = JSON.parse(data) as Track[];
      return Array.isArray(parsed) ? this.deduplicateTracks(parsed) : [];
    } catch {
      return [];
    }
  }

  public static saveDriverLibrary(tracks: Track[]): void {
    try {
      if (typeof window === 'undefined') return;
      const clean = this.deduplicateTracks(tracks);
      localStorage.setItem(STORAGE_KEYS.DRIVER_LIBRARY, JSON.stringify(clean));
    } catch (e) {
      console.warn('[StorageService] Error guardando biblioteca del chofer:', e);
    }
  }

  public static addToDriverLibrary(track: Track): Track[] {
    const current = this.loadDriverLibrary();
    const updated = this.deduplicateTracks([{ ...track, source: 'local_car', addedBy: 'Chofer (Carro)' }, ...current]);
    this.saveDriverLibrary(updated);
    return updated;
  }

  public static removeFromDriverLibrary(trackId: string): Track[] {
    const current = this.loadDriverLibrary();
    const updated = current.filter((t) => t.id !== trackId);
    this.saveDriverLibrary(updated);
    return updated;
  }

  public static loadPlaybackHistory(): Track[] {
    try {
      if (typeof window === 'undefined') return [];
      const data = localStorage.getItem(STORAGE_KEYS.PLAYBACK_HISTORY);
      if (!data) return [];
      const parsed = JSON.parse(data) as Track[];
      return Array.isArray(parsed) ? this.deduplicateTracks(parsed) : [];
    } catch {
      return [];
    }
  }

  public static addToPlaybackHistory(track: Track): Track[] {
    try {
      if (!track || !track.id) return this.loadPlaybackHistory();
      const current = this.loadPlaybackHistory();
      // Insertar al inicio y mantener máximo 60 pistas
      const updated = this.deduplicateTracks([track, ...current]).slice(0, 60);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.PLAYBACK_HISTORY, JSON.stringify(updated));
      }
      return updated;
    } catch {
      return [];
    }
  }

  public static clearPlaybackHistory(): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(STORAGE_KEYS.PLAYBACK_HISTORY);
    } catch {}
  }

  public static addManyToDriverLibrary(tracks: Track[]): Track[] {
    const current = this.loadDriverLibrary();
    const tagged = tracks.map((t) => ({ ...t, source: 'local_car' as const, addedBy: 'Chofer (Carro)' }));
    const updated = this.deduplicateTracks([...tagged, ...current]);
    this.saveDriverLibrary(updated);
    return updated;
  }

  public static saveRoomInfo(roomId: string, djName?: string): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(STORAGE_KEYS.ROOM_ID, roomId);
      if (djName) localStorage.setItem(STORAGE_KEYS.DJ_NAME, djName);
    } catch {}
  }
}
