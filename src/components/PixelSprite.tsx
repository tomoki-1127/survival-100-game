import { useState } from "react";

interface PixelSpriteProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackText?: string;
}

export function PixelSprite({ src, alt, className = "w-10 h-10", fallbackText = "?" }: PixelSpriteProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className={`inline-flex items-center justify-center text-xs font-bold text-amber-300/80 ${className}`}
        aria-label={alt}
      >
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={`pixel-art object-contain select-none ${className}`}
    />
  );
}
