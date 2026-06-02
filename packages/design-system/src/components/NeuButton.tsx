'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export type NeuButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type NeuButtonSize = 'sm' | 'md' | 'lg';

export interface NeuButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: NeuButtonVariant;
  size?: NeuButtonSize;
  loading?: boolean;
}

const variantClasses: Record<NeuButtonVariant, string> = {
  primary: 'bg-brand-primary text-text-inverse hover:bg-brand-primary-hover',
  secondary: 'bg-surface-raised text-text-primary',
  ghost: 'bg-transparent text-text-primary',
  danger: 'bg-error text-text-inverse',
};

const sizeClasses: Record<NeuButtonSize, string> = {
  // All sizes meet the 44×44 px tap target on mobile (responsiveness directive §3.1).
  sm: 'min-h-[44px] min-w-[44px] px-4 py-2 text-sm',
  md: 'min-h-[44px] min-w-[44px] px-6 py-3 text-base',
  lg: 'min-h-[48px] min-w-[48px] px-8 py-4 text-lg',
};

/**
 * NeuButton — raised Neumorphic surface with press-to-sunken gesture.
 * Design-System.md §3.2.
 */
export const NeuButton = forwardRef<HTMLButtonElement, NeuButtonProps>(function NeuButton(
  { children, variant = 'primary', size = 'md', loading = false, className, disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'shadow-neu-soft active:shadow-neu-sunken',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
        'transition-shadow duration-200 disabled:opacity-60 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
