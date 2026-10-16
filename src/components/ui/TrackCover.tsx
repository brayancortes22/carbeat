import React, { useState } from 'react';
import { Disc3 } from 'lucide-react';

interface TrackCoverProps {
  src?: string;
  alt: string;
  className?: string;
  iconClassName?: string;
}

export const TrackCover: React.FC<TrackCoverProps> = ({
  src,
  alt,
  className = 'w-10 h-10 rounded-lg',
  iconClassName = 'w-5 h-5 text-cyan-400',
}) => {
  const [hasError, setHasError] = useState(!src);

  if (hasError || !src) {
    return (
      <div className={`${className} bg-slate-800/90 border border-white/10 flex items-center justify-center shrink-0`}>
        <Disc3 className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={`${className} object-cover bg-slate-800 shrink-0`}
    />
  );
};
