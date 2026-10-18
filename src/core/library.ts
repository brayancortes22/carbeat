// Biblioteca del carro: archivos guardados (USB/tablet), carpeta vigilada, favoritas e historial.
// Es un store sencillo (subscribe/getState) que usan las dos interfaces: web y APK.

import { dedupeTracks, sameTrack, type Track } from '../../shared/track';
import { LocalAudioDatabase, isAudioFile } from './audio/local-audio-db';

const FAV_KEY = 'carbeat.favorites.v2';
const HIST_KEY = 'carbeat.history.v2';
const LEGACY_FAV = 'carbeat_driver_library_v1';
const LEGACY_HIST = 'carbeat_playback_history_v1';
const HISTORY_MAX = 80;
const FOLDER_DB = 'CarBeatFolderDB';

export interface LibraryState {
  ready: boolean;
  local: Track[];
  favorites: Track[];
  history: Track[];
  folderName: string | null;
  importing: { done: number; total: number } | null;
}

function readList(key: string, legacy?: string): Track[] {
  try {
    const raw = localStorage.getItem(key) ?? (legacy ? localStorage.getItem(legacy) : null);
    const parsed = raw ? (JSON.parse(raw) as Track[]) : [];
    // Las favoritas guardadas sólo valen si se pueden volver a reproducir (blob: muere al cerrar).
    return Array.isArray(parsed) ? parsed.filter((t) => t?.title && (t.videoId || t.audioUrl?.startsWith('http'))) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: Track[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* almacenamiento lleno o privado */
  }
}

type DirHandle = { name: string; values(): AsyncIterable<{ kind: string; name: string; getFile(): Promise<File> }>; queryPermission(o: { mode: string }): Promise<string> };

function folderDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FOLDER_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('watched_folders')) req.result.createObjectStore('watched_folders', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class CarLibrary {
  private state: LibraryState = { ready: false, local: [], favorites: [], history: [], folderName: null, importing: null };
  private listeners = new Set<() => void>();
  private folder: DirHandle | null = null;
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getState = () => this.state;

  private set(patch: Partial<LibraryState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  async init(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const local = await LocalAudioDatabase.loadAll();
    this.set({ ready: true, local, favorites: readList(FAV_KEY, LEGACY_FAV), history: readList(HIST_KEY, LEGACY_HIST) });
    void this.restoreFolder();
  }

  /** Todo lo que el piloto automático puede usar sin internet. */
  playable(): Track[] {
    return dedupeTracks([...this.state.local, ...this.state.favorites]);
  }

  async importFiles(files: Iterable<File>): Promise<number> {
    const list = [...files].filter(isAudioFile);
    if (!list.length) return 0;
    let added = 0;
    this.set({ importing: { done: 0, total: list.length } });
    for (let i = 0; i < list.length; i++) {
      try {
        const { track, isNew } = await LocalAudioDatabase.save(list[i]);
        if (isNew) {
          added++;
          this.set({ local: [...this.state.local, track] });
        }
      } catch {
        /* archivo ilegible: se salta */
      }
      this.set({ importing: { done: i + 1, total: list.length } });
    }
    this.set({ importing: null });
    return added;
  }

  async removeLocal(id: string): Promise<void> {
    await LocalAudioDatabase.remove(id);
    this.set({ local: this.state.local.filter((t) => t.id !== id) });
  }

  isFavorite(track: Track): boolean {
    return this.state.favorites.some((t) => sameTrack(t, track));
  }

  toggleFavorite(track: Track): boolean {
    const on = !this.isFavorite(track);
    if (track.source === 'local_car' && !track.audioUrl.startsWith('http')) return false; // ya está en el carro
    const favorites = on ? [track, ...this.state.favorites] : this.state.favorites.filter((t) => !sameTrack(t, track));
    writeList(FAV_KEY, favorites);
    this.set({ favorites });
    return on;
  }

  saveAllToFavorites(tracks: Track[]): number {
    const candidates = tracks.filter((t) => (t.videoId || t.audioUrl.startsWith('http')) && !this.isFavorite(t));
    if (!candidates.length) return 0;
    const favorites = dedupeTracks([...candidates, ...this.state.favorites]);
    writeList(FAV_KEY, favorites);
    this.set({ favorites });
    return candidates.length;
  }

  recordPlayed(track: Track): void {
    const history = [track, ...this.state.history.filter((t) => !sameTrack(t, track))].slice(0, HISTORY_MAX);
    writeList(HIST_KEY, history.filter((t) => t.videoId || t.audioUrl.startsWith('http')));
    this.set({ history });
  }

  clearHistory(): void {
    writeList(HIST_KEY, []);
    this.set({ history: [] });
  }

  // ------------------------------------------------- carpeta vigilada (escritorio)

  folderSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  async pickFolder(): Promise<boolean> {
    if (!this.folderSupported()) return false;
    try {
      const handle = (await (window as unknown as { showDirectoryPicker(o: { mode: string }): Promise<DirHandle> }).showDirectoryPicker({ mode: 'read' })) as DirHandle;
      const db = await folderDb();
      db.transaction('watched_folders', 'readwrite').objectStore('watched_folders').put({ id: 'primary_music_dir', name: handle.name, handle, savedAt: Date.now() });
      await this.watch(handle);
      return true;
    } catch {
      return false;
    }
  }

  private async restoreFolder(): Promise<void> {
    if (!this.folderSupported()) return;
    try {
      const db = await folderDb();
      const row = await new Promise<{ handle?: DirHandle } | undefined>((resolve) => {
        const req = db.transaction('watched_folders', 'readonly').objectStore('watched_folders').get('primary_music_dir');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });
      // Sin permiso concedido no se pregunta al arrancar: se espera a que el conductor lo pida.
      if (row?.handle && (await row.handle.queryPermission({ mode: 'read' })) === 'granted') await this.watch(row.handle);
    } catch {
      /* sin carpeta guardada */
    }
  }

  private async watch(handle: DirHandle): Promise<void> {
    this.folder = handle;
    this.set({ folderName: handle.name });
    await this.scanFolder();
    if (this.watchTimer) clearInterval(this.watchTimer);
    this.watchTimer = setInterval(() => void this.scanFolder(), 15_000);
  }

  private async scanFolder(): Promise<void> {
    if (!this.folder) return;
    const files: File[] = [];
    try {
      for await (const entry of this.folder.values()) {
        if (entry.kind === 'file' && isAudioFile(entry)) {
          const file = await entry.getFile();
          if (!(await LocalAudioDatabase.hasSource(file))) files.push(file);
        }
      }
    } catch {
      return;
    }
    if (files.length) await this.importFiles(files);
  }
}

export const carLibrary = new CarLibrary();
