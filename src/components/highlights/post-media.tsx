'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function PostMedia({
  images,
  videoId,
  title,
  unavailable,
}: {
  images: string[];
  videoId: string | null;
  title: string;
  unavailable: boolean;
}) {
  const [index, setIndex] = useState(0),
    [failed, setFailed] = useState(false),
    router = useRouter();
  if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId))
    return (
      <div className="highlight-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={`Video: ${title}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  return (
    <>
      {images.length ? (
        <>
          <div className="highlight-image">
            <Image
              key={images[index % images.length]}
              src={images[index % images.length]!}
              alt={`${title} · captura ${index + 1}`}
              fill
              unoptimized
              sizes="(max-width: 700px) 100vw, 800px"
              onError={() => setFailed(true)}
            />
          </div>
          {images.length > 1 ? (
            <div className="highlight-carousel" aria-label="Capturas">
              <button
                type="button"
                className="button secondary small"
                onClick={() => setIndex((value) => (value - 1 + images.length) % images.length)}
                aria-label="Captura anterior"
              >
                ←
              </button>
              <span aria-live="polite">
                {index + 1} / {images.length}
              </span>
              <button
                type="button"
                className="button secondary small"
                onClick={() => setIndex((value) => (value + 1) % images.length)}
                aria-label="Captura siguiente"
              >
                →
              </button>
            </div>
          ) : null}
        </>
      ) : null}
      {unavailable || failed ? (
        <div className="notice">
          <p>La captura no está disponible o su enlace expiró.</p>
          <button
            type="button"
            className="button secondary small"
            onClick={() => {
              setFailed(false);
              router.refresh();
            }}
          >
            Renovar capturas
          </button>
        </div>
      ) : null}
    </>
  );
}
