import type { Track } from '../../types/track.types';

/*
 * Música guardada en el carro (IndexedDB).
 *
 * Corrección respecto a la v1: cada archivo se identifica por nombre + tamaño + fecha. Antes,
 * al reabrir la app, el vigilante de carpeta volvía a guardar TODAS las canciones con ids
 * nuevos, y la base crecía con duplicados en cada arranque.
 */

const DB_NAME = 'CarBeatAudioDB';
const DB_VERSION = 2;
const STORE = 'tracks';
const LEGACY_STORE = 'local_audio_tracks';

interface StoredAudio {
  id: string;
  sourceKey: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  blob: Blob;
  addedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no disponible'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const tx = req.transaction!;
      const store = db.objectStoreNames.contains(STORE) ? tx.objectStore(STORE) : db.createObjectStore(STORE, { keyPath: 'id' });
      if (!store.indexNames.contains('sourceKey')) store.createIndex('sourceKey', 'sourceKey', { unique: false });
      // Migración desde la v1 ('local_audio_tracks'): se copian las canciones sin los duplicados
      // que acumulaba el vigilante de carpeta (mismo título + mismo tamaño = misma canción).
      if (db.objectStoreNames.contains(LEGACY_STORE)) {
        const seen = new Set<string>();
        const cursorReq = tx.objectStore(LEGACY_STORE).openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) {
            db.deleteObjectStore(LEGACY_STORE);
            return;
          }
          const old = cursor.value as { id: string; title: string; artist: string; album?: string; duration?: number; blob: Blob; addedAt?: number };
          const sourceKey = `legacy|${old.title}|${old.artist}|${old.blob?.size ?? 0}`;
          if (old.blob && !seen.has(sourceKey)) {
            seen.add(sourceKey);
            store.put({
              id: old.id,
              sourceKey,
              title: old.title,
              artist: old.artist,
              album: old.album,
              duration: old.duration && old.duration !== 210 ? old.duration : 0,
              blob: old.blob,
              addedAt: old.addedAt ?? Date.now(),
            } satisfies StoredAudio);
          }
          cursor.continue();
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const sourceKeyOf = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

/** "03 - Soda Stereo - De música ligera.mp3" -> artista y título. */
export function parseFileName(name: string): { title: string; artist: string } {
  const clean = name.replace(/\.[^/.]+$/, '').replace(/^\d+[\s._-]+/, '').replace(/_/g, ' ').trim();
  const parts = clean.split(/\s+-\s+/);
  if (parts.length > 1) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  return { artist: 'Música del carro', title: clean };
}

/** Lee la duración real del archivo (antes se ponía 210 s a todo). */
function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    const done = (v: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v) ? Math.round(v) : 0);
    };
    const timer = setTimeout(() => done(0), 800);
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      clearTimeout(timer);
      done(a.duration);
    };
    a.onerror = () => {
      clearTimeout(timer);
      done(0);
    };
    a.src = url;
  });
}

const urls = new Map<string, string>();
function toTrack(r: StoredAudio): Track {
  let url = urls.get(r.id);
  if (!url) {
    url = URL.createObjectURL(r.blob);
    urls.set(r.id, url);
  }
  return { id: r.id, title: r.title, artist: r.artist, album: r.album, duration: r.duration, source: 'local_car', audioUrl: url };
}

export const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus', '.wma', '.mp4'];
function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return `car_${crypto.randomUUID().slice(0, 12)}`;
    } catch {
      /* fallback */
    }
  }
  return `car_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
export const isAudioFile = (f: { name: string; type?: string }) =>
  (f.type ?? '').startsWith('audio/') || AUDIO_EXTENSIONS.some((e) => f.name.toLowerCase().endsWith(e));

export const LocalAudioDatabase = {
  async hasSource(file: File): Promise<boolean> {
    const db = await open();
    return new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).index('sourceKey').getKey(sourceKeyOf(file));
      req.onsuccess = () => resolve(req.result !== undefined);
      req.onerror = () => resolve(false);
    });
  },

  /** Guarda el archivo si no estaba ya. Devuelve la pista (nueva o existente). */
  async save(file: File): Promise<{ track: Track; isNew: boolean }> {
    const db = await open();
    const key = sourceKeyOf(file);
    const existing = await new Promise<StoredAudio | undefined>((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).index('sourceKey').get(key);
      req.onsuccess = () => resolve(req.result as StoredAudio | undefined);
      req.onerror = () => resolve(undefined);
    });
    if (existing) return { track: toTrack(existing), isNew: false };

    const { title, artist } = parseFileName(file.name);
    const record: StoredAudio = {
      id: generateLocalId(),
      sourceKey: key,
      title,
      artist,
      duration: await probeDuration(file),
      blob: file,
      addedAt: Date.now(),
    };
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return { track: toTrack(record), isNew: true };
  },

  async loadAll(): Promise<Track[]> {
    try {
      const db = await open();
      return await new Promise((resolve) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = () => {
          const rows = (req.result as StoredAudio[]).sort((a, b) => a.addedAt - b.addedAt);
          resolve(rows.map(toTrack));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  },

  async remove(id: string): Promise<void> {
    const db = await open();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    const url = urls.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.delete(id);
  },
};
