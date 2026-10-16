import { Track, QueueItem } from '../../types/track.types';

const STORAGE_KEYS = {
  CATALOG: 'carbeat_local_catalog_v1',
  QUEUE: 'carbeat_local_queue_v1',
  ROOM_ID: 'carbeat_saved_room_id',
  DJ_NAME: 'carbeat_saved_dj_name',
} as const;

export class StorageService {
  public static saveCatalog(tracks: Track[]): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(tracks));
    } catch (e) {
      console.warn('[StorageService] Error guardando catálogo en localStorage:', e);
    }
  }

  public static loadCatalog(fallback: Track[]): Track[] {
    try {
      if (typeof window === 'undefined') return fallback;
      const data = localStorage.getItem(STORAGE_KEYS.CATALOG);
      if (!data) return fallback;
      const parsed = JSON.parse(data) as Track[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  public static saveQueue(queue: QueueItem[]): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
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

  public static getSavedRoomInfo(): { roomId: string; djName: string } {
    try {
      if (typeof window === 'undefined') return { roomId: 'BEAT-784', djName: 'DJ_Copiloto' };
      const roomId = localStorage.getItem(STORAGE_KEYS.ROOM_ID) || 'BEAT-784';
      const djName = localStorage.getItem(STORAGE_KEYS.DJ_NAME) || 'DJ_Copiloto';
      return { roomId, djName };
    } catch {
      return { roomId: 'BEAT-784', djName: 'DJ_Copiloto' };
    }
  }
}
