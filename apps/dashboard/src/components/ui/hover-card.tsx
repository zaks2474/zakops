'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

function HoverCard({
  ...props
}: React.ComponentProps<'div'>) {
  return <div data-slot='hover-card' {...props} />;
}

function HoverCardTrigger({
  ...props
}: React.ComponentProps<'div'>) {
  return <div data-slot='hover-card-trigger' {...props} />;
}

function HoverCardContent({
  className,
  ...props
}: React.ComponentProps<'div'> & {
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}) {
  return (
    <div
      data-slot='hover-card-content'
      className={cn(
        'bg-popover text-popover-foreground z-50 w-64 rounded-md border p-4 shadow-md outline-hidden',
        className
      )}
      {...props}
    />
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
