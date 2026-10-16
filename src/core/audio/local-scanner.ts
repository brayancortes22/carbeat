import { Track } from '../../types/track.types';
import { LocalAudioDatabase } from './local-audio-db';

export class LocalScanner {
  public static async scanAudioFiles(fileList: FileList): Promise<Track[]> {
    const tracks: Track[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (
        file.type.startsWith('audio/') ||
        file.name.endsWith('.mp3') ||
        file.name.endsWith('.flac') ||
        file.name.endsWith('.m4a') ||
        file.name.endsWith('.wav') ||
        file.name.endsWith('.aac') ||
        file.name.endsWith('.ogg')
      ) {
        try {
          const track = await LocalAudioDatabase.saveAudioFile(file);
          tracks.push(track);
        } catch {
          // Fallback en caso de que IndexedDB falle
          const objectUrl = URL.createObjectURL(file);
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/^\d+[\s.-]+/, '');
          const parts = cleanName.split(' - ');
          tracks.push({
            id: `local_${Date.now()}_${i}`,
            title: parts.length > 1 ? parts.slice(1).join(' - ').trim() : cleanName.trim(),
            artist: parts.length > 1 ? parts[0].trim() : 'Biblioteca Local',
            album: 'Almacenamiento Tablet',
            duration: 210,
            source: 'local_car',
            audioUrl: objectUrl,
          });
        }
      }
    }

    return tracks;
  }
}
