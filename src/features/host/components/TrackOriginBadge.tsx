import React from 'react';
import { Car, Smartphone, Sparkles } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Track } from '../../../types/track.types';

interface TrackOriginBadgeProps {
  track?: Track;
  requestedBy?: string;
  isAutopilot?: boolean;
  className?: string;
}

export const TrackOriginBadge: React.FC<TrackOriginBadgeProps> = ({
  track,
  requestedBy,
  isAutopilot = false,
  className = '',
}) => {
  const isAi =
    isAutopilot ||
    requestedBy?.includes('IA') ||
    requestedBy?.includes('Autopilot') ||
    track?.addedBy?.includes('IA');

  const isDriver =
    track?.source === 'local_car' ||
    requestedBy?.toLowerCase().includes('chofer') ||
    requestedBy?.toLowerCase().includes('conductor') ||
    requestedBy?.toLowerCase().includes('carro') ||
    track?.addedBy?.toLowerCase().includes('chofer');

  if (isAi) {
    return (
      <Badge
        variant="amber"
        className={`text-[9px] py-0 px-1.5 flex items-center gap-1 border-amber-500/40 bg-amber-500/10 text-amber-300 font-semibold ${className}`}
      >
        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
        <span>IA Autopilot</span>
      </Badge>
    );
  }

  if (isDriver) {
    return (
      <Badge
        variant="cyan"
        className={`text-[9px] py-0 px-1.5 flex items-center gap-1 border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-semibold ${className}`}
      >
        <Car className="w-2.5 h-2.5 text-cyan-400" />
        <span>Chofer / Carro</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant="purple"
      className={`text-[9px] py-0 px-1.5 flex items-center gap-1 border-purple-500/40 bg-purple-500/10 text-purple-300 font-semibold ${className}`}
    >
      <Smartphone className="w-2.5 h-2.5 text-purple-400" />
      <span>{requestedBy || track?.addedBy || 'Pasajero'}</span>
    </Badge>
  );
};
