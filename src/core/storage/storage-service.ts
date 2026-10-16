import { Track, QueueItem } from '../../types/track.types';

const STORAGE_KEYS = {
  CATALOG: 'carbeat_local_catalog_v2', // v2: purga limpia de duplicados
  QUEUE: 'carbeat_local_queue_v2',
  ROOM_ID: 'carbeat_saved_room_id',
  DJ_NAME: 'carbeat_saved_dj_name',
} as const;

export class StorageService {
  public static deduplicateTracks(tracks: Track[]): Track[] {
    const seen = new Set<string>();
    const result: Track[] = [];
    for (const t of tracks) {
      if (!t || !t.title) continue;
      const key = `${t.title.toLowerCase().trim()}_${t.artist.toLowerCase().trim()}`;
      if (!seen.has(key) && !seen.has(t.id)) {
        seen.add(key);
        seen.add(t.id);
        result.push(t);
      }
    }
    return result;
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
      // Deduplicar cola por ID o por título de canción
      const seen = new Set<string>();
      const cleanQueue = queue.filter((item) => {
        if (!item?.track?.title) return false;
        const key = item.track.title.toLowerCase().trim();
        if (seen.has(key) || seen.has(item.queueId)) return false;
        seen.add(key);
        seen.add(item.queueId);
        return true;
      });
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
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public static saveRoomInfo(roomId: string, djName?: string): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(STORAGE_KEYS.ROOM_ID, roomId);
      if (djName) localStorage.setItem(STORAGE_KEYS.DJ_NAME, djName);
    } catch {}
  }
}
