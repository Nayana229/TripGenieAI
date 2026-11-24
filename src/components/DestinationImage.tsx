'use client';

import { useState } from 'react';
import { Compass } from 'lucide-react';

interface DestinationImageProps {
  src: string;
  alt: string;
  label?: string;
  className?: string;
}

export function DestinationImage({
  src,
  alt,
  label,
  className = 'w-full h-full object-cover',
}: DestinationImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0B1D3A] via-[#13315C] to-[#0284C7] text-white p-6 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Compass className="w-8 h-8 text-sky-300 mb-2" />
        {label && (
          <span className="text-sm font-display font-semibold tracking-tight text-center">
            {label}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
