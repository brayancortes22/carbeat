import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  glowColor?: 'cyan' | 'purple';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  glow = false,
  glowColor = 'cyan',
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'relative rounded-2xl bg-[#0C0E17]/80 backdrop-blur-2xl border border-white/[0.08] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300',
          glow && glowColor === 'cyan' && 'border-cyan-500/30 shadow-[0_0_35px_rgba(6,182,212,0.18)]',
          glow && glowColor === 'purple' && 'border-purple-500/30 shadow-[0_0_35px_rgba(168,85,247,0.18)]',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
