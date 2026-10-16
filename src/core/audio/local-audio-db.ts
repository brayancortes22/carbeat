import { Track } from '../../types/track.types';

const DB_NAME = 'CarBeatAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'local_audio_tracks';

interface StoredAudioRecord {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  blob: Blob;
  addedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no está disponible en este entorno'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class LocalAudioDatabase {
  public static async saveAudioFile(file: File): Promise<Track> {
    const db = await openDatabase();
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/^\d+[\s.-]+/, '');
    const parts = cleanName.split(' - ');
    const artist = parts.length > 1 ? parts[0].trim() : 'Biblioteca Tablet';
    const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : cleanName.trim();
    const id = `tablet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const record: StoredAudioRecord = {
      id,
      title,
      artist,
      album: 'Almacenamiento Local',
      duration: 210,
      blob: file,
      addedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => {
        const objectUrl = URL.createObjectURL(file);
        resolve({
          id,
          title,
          artist,
          album: 'Almacenamiento Local',
          duration: 210,
          source: 'local_car',
          audioUrl: objectUrl,
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  public static async loadAllTracks(): Promise<Track[]> {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const records = (req.result as StoredAudioRecord[]) || [];
          const tracks: Track[] = records.map((r) => ({
            id: r.id,
            title: r.title,
            artist: r.artist,
            album: r.album || 'Almacenamiento Local',
            duration: r.duration || 210,
            source: 'local_car',
            audioUrl: URL.createObjectURL(r.blob),
          }));
          resolve(tracks);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  public static async removeTrack(id: string): Promise<void> {
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
    } catch (e) {
      console.warn('[LocalAudioDB] Error eliminando pista de IndexedDB:', e);
    }
  }
}
