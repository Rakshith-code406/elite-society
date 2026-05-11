import { useEffect, useState } from 'react';
import { cn, getDisplayInitial } from '../lib/utils';
import { PresenceStatus } from '../types';

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  textClassName?: string;
  presenceStatus?: PresenceStatus;
  showPresence?: boolean;
  presenceClassName?: string;
}

export default function Avatar({
  name,
  src,
  alt,
  className,
  imageClassName,
  fallbackClassName,
  textClassName,
  presenceStatus,
  showPresence = false,
  presenceClassName,
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const showImage = !!src && !imageFailed;

  return (
    <div className={cn('relative overflow-hidden bg-white/5', className)}>
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={alt ?? name ?? 'Profile avatar'}
          className={cn('h-full w-full object-cover', imageClassName)}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.28),_transparent_55%),linear-gradient(135deg,_rgba(255,255,255,0.14),_rgba(255,255,255,0.04))]',
            fallbackClassName
          )}
          aria-label={alt ?? name ?? 'Profile avatar'}
        >
          <span className={cn('font-serif text-gold/90', textClassName)}>
            {getDisplayInitial(name)}
          </span>
        </div>
      )}
      {showPresence && (
        <span
          className={cn(
            'presence-dot absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-full border-2 border-onyx',
            presenceStatus === 'online'
              ? 'bg-emerald-500 presence-dot-online'
              : presenceStatus === 'busy'
                ? 'bg-rose-500 presence-dot-busy'
                : 'bg-slate-400 presence-dot-offline',
            presenceClassName
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
