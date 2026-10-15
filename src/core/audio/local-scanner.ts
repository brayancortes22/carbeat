import { Track } from '../../types/track.types';

export class LocalScanner {
  public static async scanAudioFiles(fileList: FileList): Promise<Track[]> {
    const tracks: Track[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.flac') || file.name.endsWith('.m4a')) {
        const objectUrl = URL.createObjectURL(file);
        
        // Limpiar nombre de archivo (ej: "01 - Bohemian Rhapsody.mp3" -> "Bohemian Rhapsody")
        const cleanName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/^\d+[\s.-]+/, '');

        const parts = cleanName.split(' - ');
        const artist = parts.length > 1 ? parts[0].trim() : 'Biblioteca Local';
        const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : cleanName.trim();

        tracks.push({
          id: `local_${Date.now()}_${i}`,
          title,
          artist,
          album: 'Memoria USB / Carro',
          duration: 210, // Duración estimada si no hay metadatos ID3
          source: 'local_car',
          audioUrl: objectUrl,
        });
      }
    }

    return tracks;
  }
}
