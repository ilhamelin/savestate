'use client';
import type { VideoHTMLAttributes } from 'react';
export function VaultVideo(props: VideoHTMLAttributes<HTMLVideoElement>) {
  // User-uploaded clips have no caption track; retain native controls and accessible labels.
  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <video {...props} />;
}
