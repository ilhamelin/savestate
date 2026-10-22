'use client';
import { useId } from 'react';
import type { UserCassetteTrack } from '@/domain/retro-audio';

export function CassetteSlot({
  track,
  onFile,
  onEject,
}: {
  track: UserCassetteTrack | null;
  onFile: (file: File) => void;
  onEject: () => void;
}) {
  const id = useId();
  return (
    <div className="radio-cassette-slot">
      <label
        className="radio-dropzone"
        htmlFor={id}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <span>📼 {track ? 'Sustituir casete' : 'Inserta tu propia música'}</span>
        <small>Arrastra un archivo o selecciónalo · MP3, OGG, FLAC, WAV, M4A, AAC</small>
        <input
          id={id}
          type="file"
          accept="audio/*,.mp3,.ogg,.flac,.wav,.m4a,.aac,.opus,.aif,.aiff"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onFile(file);
          }}
        />
      </label>
      {track && (
        <div className="radio-track-meta">
          <span title={track.name}>
            {track.name} · {track.format}
          </span>
          <button
            type="button"
            className="button outline small"
            aria-label="Expulsar casete"
            onClick={onEject}
          >
            ⏏ Expulsar
          </button>
        </div>
      )}
      <small className="muted">
        Solo en este navegador. El archivo no se sube ni se conserva al recargar.
      </small>
    </div>
  );
}
