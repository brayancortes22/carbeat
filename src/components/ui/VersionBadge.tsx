import React, { useEffect, useState } from 'react';
import { GitCommit, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from './Badge';

import { apiUrl } from '../../core/network/api-config';

interface VersionBadgeProps {
  version: string;
  compact?: boolean;
}

export const VersionBadge: React.FC<VersionBadgeProps> = ({
  version,
  compact = false,
}) => {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkVersion = async () => {
      try {
        const res = await fetch(apiUrl(`/api/version?t=${Date.now()}`));
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.version) {
            setLatestVersion(data.version);
          }
        }
      } catch {
        // Ignorar si no hay conexión
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const hasUpdate = latestVersion && latestVersion !== version;

  const handleReload = () => {
    setIsUpdating(true);
    // Si estamos en entorno móvil nativo / Capacitor, descargar el APK actualizado
    if (window.location.protocol === 'capacitor:' || (window as any).Capacitor) {
      window.open(apiUrl('/downloads/carbeat-latest.apk'), '_system');
    }
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <Badge
      variant={hasUpdate ? 'emerald' : 'slate'}
      className={`text-[9px] transition-all cursor-pointer ${
        compact ? 'px-2 py-0.5' : 'px-2.5 py-1'
      } ${hasUpdate ? 'border-emerald-500/50 shadow-md shadow-emerald-500/20 animate-pulse' : ''}`}
      onClick={handleReload}
      title={hasUpdate ? `¡Nueva versión ${latestVersion} lista! Toca para actualizar` : `Versión ${version}`}
    >
      <div className="flex items-center gap-1">
        {hasUpdate ? (
          <Sparkles className="w-2.5 h-2.5 text-emerald-400 animate-spin" />
        ) : (
          <GitCommit className={`w-2.5 h-2.5 ${compact ? 'w-2 h-2' : ''}`} />
        )}
        <span className="font-mono font-bold">
          {hasUpdate ? `v${latestVersion}` : version}
        </span>
        <span
          title="Actualizar / Recargar"
          className={`transition-colors ${hasUpdate ? 'text-emerald-300' : 'hover:text-cyan-400'}`}
        >
          <RefreshCw className={`w-2 h-2 ${isUpdating || hasUpdate ? 'animate-spin' : ''}`} />
        </span>
      </div>
    </Badge>
  );
};
