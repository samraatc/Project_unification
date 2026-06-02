'use client';

import { forwardRef, type InputHTMLAttributes, useId } from 'react';

import { cn } from '../utils/cn.js';

export interface NeuInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/**
 * NeuInput — sunken Neumorphic well used for every form field.
 *
 * Design-System.md §3.3. The 16px floor on font-size suppresses iOS auto-zoom
 * (responsiveness directive §3.2).
 */
export const NeuInput = forwardRef<HTMLInputElement, NeuInputProps>(function NeuInput(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-text-secondary"
        >
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'w-full rounded-md bg-surface-sunken px-4 py-3',
          'min-h-[44px] text-base text-text-primary placeholder:text-text-muted',
          'shadow-neu-sunken focus:shadow-neu-soft',
          'focus:outline-none focus:ring-2 focus:ring-brand-primary',
          'transition-shadow duration-200',
          error && 'ring-2 ring-error',
          className,
        )}
        {...rest}
      />
      {hint && !error ? (
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1 text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});
