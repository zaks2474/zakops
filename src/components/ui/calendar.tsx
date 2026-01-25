'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export type DateRange = {
  from?: Date;
  to?: Date;
};

export type CalendarProps = {
  mode?: 'single' | 'range';
  selected?: Date | DateRange;
  onSelect?: (date: Date | DateRange | undefined) => void;
  disabled?: (date: Date) => boolean;
  initialFocus?: boolean;
  numberOfMonths?: number;
  className?: string;
};

function toInputDateValue(date?: Date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseInputDate(value: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function Calendar({ mode = 'single', selected, onSelect, disabled, className }: CalendarProps) {
  if (mode === 'range') {
    const range = (selected && typeof selected === 'object' && !('getTime' in selected))
      ? (selected as DateRange)
      : ({ from: undefined, to: undefined } as DateRange);

    return (
      <div className={cn('p-3 space-y-3', className)}>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-1'>
            <div className='text-xs text-muted-foreground'>From</div>
            <input
              type='date'
              className='w-full rounded-md border bg-background px-2 py-1 text-sm'
              value={toInputDateValue(range.from)}
              onChange={(e) => {
                const nextFrom = parseInputDate(e.target.value);
                if (nextFrom && disabled?.(nextFrom)) return;
                onSelect?.({ from: nextFrom, to: range.to });
              }}
            />
          </div>
          <div className='space-y-1'>
            <div className='text-xs text-muted-foreground'>To</div>
            <input
              type='date'
              className='w-full rounded-md border bg-background px-2 py-1 text-sm'
              value={toInputDateValue(range.to)}
              onChange={(e) => {
                const nextTo = parseInputDate(e.target.value);
                if (nextTo && disabled?.(nextTo)) return;
                onSelect?.({ from: range.from, to: nextTo });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const date = selected && typeof selected === 'object' && 'getTime' in selected ? (selected as Date) : undefined;
  return (
    <div className={cn('p-3', className)}>
      <input
        type='date'
        className='w-full rounded-md border bg-background px-2 py-1 text-sm'
        value={toInputDateValue(date)}
        onChange={(e) => {
          const next = parseInputDate(e.target.value);
          if (next && disabled?.(next)) return;
          onSelect?.(next);
        }}
      />
    </div>
  );
}

export { Calendar };
