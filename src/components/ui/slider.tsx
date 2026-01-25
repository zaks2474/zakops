'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export type SliderProps = Omit<React.ComponentProps<'div'>, 'onChange'> & {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (value: number[]) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function Slider({
  className,
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  onValueChange,
  ...props
}: SliderProps) {
  const initial = React.useMemo(() => {
    const v = Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min];
    if (v.length >= 2) {
      const a = clamp(Number(v[0]), min, max);
      const b = clamp(Number(v[1]), min, max);
      return [Math.min(a, b), Math.max(a, b)];
    }
    return [clamp(Number(v[0]), min, max)];
  }, [value, defaultValue, min, max]);

  const [internal, setInternal] = React.useState<number[]>(initial);

  React.useEffect(() => {
    if (!Array.isArray(value)) return;
    setInternal((prev) => {
      const next = value.length >= 2
        ? [clamp(Number(value[0]), min, max), clamp(Number(value[1]), min, max)].sort((a, b) => a - b)
        : [clamp(Number(value[0]), min, max)];
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
  }, [value, min, max]);

  const current = Array.isArray(value) ? initial : internal;
  const isRange = current.length >= 2;

  const emit = (next: number[]) => {
    setInternal(next);
    onValueChange?.(next);
  };

  return (
    <div
      data-slot='slider'
      className={cn('relative w-full select-none', disabled && 'opacity-50 pointer-events-none', className)}
      {...props}
    >
      {isRange ? (
        <div className='relative h-6'>
          <input
            type='range'
            min={min}
            max={max}
            step={step}
            value={current[0]}
            onChange={(e) => {
              const nextMin = clamp(Number(e.target.value), min, max);
              const next = [Math.min(nextMin, current[1]), current[1]];
              emit(next);
            }}
            className='absolute inset-0 w-full bg-transparent'
            disabled={disabled}
          />
          <input
            type='range'
            min={min}
            max={max}
            step={step}
            value={current[1]}
            onChange={(e) => {
              const nextMax = clamp(Number(e.target.value), min, max);
              const next = [current[0], Math.max(nextMax, current[0])];
              emit(next);
            }}
            className='absolute inset-0 w-full bg-transparent'
            disabled={disabled}
          />
        </div>
      ) : (
        <input
          type='range'
          min={min}
          max={max}
          step={step}
          value={current[0] ?? min}
          onChange={(e) => emit([clamp(Number(e.target.value), min, max)])}
          className='w-full'
          disabled={disabled}
        />
      )}
    </div>
  );
}

export { Slider };
