import { Track } from '../../types/track.types';
import { LocalAudioDatabase } from './local-audio-db';

const DB_NAME = 'CarBeatFolderDB';
const STORE_NAME = 'watched_folders';

function openFolderDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no disponible'));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * FolderWatcherService:
 * Guarda y vigila en segundo plano la carpeta física de música del chofer (Tablet/USB)
 * Si el chofer descarga más canciones, las detecta e incorpora en automático.
 */
export class FolderWatcherService {
  private static instance: FolderWatcherService | null = null;
  private directoryHandle: any = null;
  private knownFileNames = new Set<string>();
  private watchInterval: ReturnType<typeof setInterval> | null = null;
  private listener: ((newTracks: Track[]) => void) | null = null;
  private folderName = '';

  private constructor() {}

  public static getInstance(): FolderWatcherService {
    if (!this.instance) {
      this.instance = new FolderWatcherService();
    }
    return this.instance;
  }

  public getFolderName(): string {
    return this.folderName;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  /**
   * Solicita al usuario seleccionar su carpeta de música y la guarda persistentemente
   */
  public async pickAndWatchFolder(onTracksDiscovered: (tracks: Track[]) => void): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'read',
      });

      if (!handle) return false;

      this.directoryHandle = handle;
      this.folderName = handle.name || 'Música';
      this.listener = onTracksDiscovered;

      // Guardar el handle en IndexedDB
      await this.saveHandleToDb(handle);

      // Escaneo inicial inmediato
      await this.scanNow();

      // Iniciar vigilancia periódica cada 12 segundos
      this.startWatching();
      return true;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[FolderWatcher] Error seleccionando directorio:', err);
      }
      return false;
    }
  }

  /**
   * Intenta restaurar la carpeta vinculada previamente desde IndexedDB
   */
  public async restoreWatchedFolder(onTracksDiscovered: (tracks: Track[]) => void): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const db = await openFolderDb();
      const handle = await new Promise<any>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('primary_music_dir');
        req.onsuccess = () => resolve(req.result?.handle || null);
        req.onerror = () => resolve(null);
      });

      if (!handle) return false;

      // Verificar o solicitar permiso persistente
      const perm = await handle.queryPermission({ mode: 'read' });
      if (perm === 'granted') {
        this.directoryHandle = handle;
        this.folderName = handle.name || 'Música';
        this.listener = onTracksDiscovered;
        await this.scanNow();
        this.startWatching();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async saveHandleToDb(handle: any): Promise<void> {
    try {
      const db = await openFolderDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        id: 'primary_music_dir',
        name: handle.name,
        handle,
        savedAt: Date.now(),
      });
    } catch (e) {
      console.warn('[FolderWatcher] Error guardando handle:', e);
    }
  }

  private startWatching(): void {
    if (this.watchInterval) clearInterval(this.watchInterval);
    this.watchInterval = setInterval(() => {
      this.scanNow();
    }, 12000); // Revisar cada 12 segundos si hay nuevas canciones descargadas
  }

  public async scanNow(): Promise<Track[]> {
    if (!this.directoryHandle) return [];

    const newTracks: Track[] = [];
    const validExts = ['.mp3', '.flac', '.m4a', '.wav', '.aac', '.ogg'];

    try {
      for await (const entry of this.directoryHandle.values()) {
        if (entry.kind === 'file') {
          const lowerName = entry.name.toLowerCase();
          const isValidAudio = validExts.some((ext) => lowerName.endsWith(ext));

          if (isValidAudio && !this.knownFileNames.has(entry.name)) {
            this.knownFileNames.add(entry.name);
            const file = await entry.getFile();
            const savedTrack = await LocalAudioDatabase.saveAudioFile(file);
            newTracks.push(savedTrack);
          }
        }
      }

      if (newTracks.length > 0 && this.listener) {
        this.listener(newTracks);
      }
    } catch (e) {
      console.warn('[FolderWatcher] Error en escaneo de directorio:', e);
    }

    return newTracks;
  }

  public stop(): void {
    if (this.watchInterval) clearInterval(this.watchInterval);
  }
}

export const folderWatcher = FolderWatcherService.getInstance();
