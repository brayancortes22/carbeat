import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  glow = false,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'relative rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-5 shadow-2xl transition-all duration-300',
          glow && 'border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
