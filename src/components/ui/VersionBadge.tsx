import { GitCommit, RefreshCw } from 'lucide-react';
import { Badge } from './Badge';

interface VersionBadgeProps {
  version: string;
  compact?: boolean;
}

export const VersionBadge: React.FC<VersionBadgeProps> = ({
  version,
  compact = false,
}) => {
  return (
    <Badge
      variant="slate"
      className={`text-[9px] ${compact ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}
    >
      <div className="flex items-center gap-1">
        <GitCommit className={`w-2.5 h-2.5 ${compact ? 'w-2 h-2 h-2' : ''}`} />
        <span className="font-mono font-bold">{version}</span>
        {compact && (
          <span title="Recargar versión" className="cursor-pointer hover:text-cyan-400 transition-colors">
            <RefreshCw className="w-2 h-2" />
          </span>
        )}
      </div>
    </Badge>
  );
};
