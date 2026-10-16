import React from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  barCount?: number;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  barCount = 12,
  className = '',
}) => {
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <div className={`flex items-end justify-center gap-1.5 h-8 ${className}`}>
      {bars.map((i) => {
        const delay = (i * 0.1).toFixed(2);
        const duration = (0.6 + (i % 5) * 0.15).toFixed(2);
        return (
          <span
            key={i}
            className={`w-1 rounded-full transition-all duration-300 ${
              isPlaying
                ? 'bg-gradient-to-t from-cyan-500 to-sky-300 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                : 'bg-white/10 h-1.5'
            }`}
            style={
              isPlaying
                ? {
                    height: `${Math.max(20, Math.sin(i) * 60 + 35)}%`,
                    animation: `soundwave-bar ${duration}s ease-in-out ${delay}s infinite alternate`,
                  }
                : { height: '4px' }
            }
          />
        );
      })}
    </div>
  );
};
