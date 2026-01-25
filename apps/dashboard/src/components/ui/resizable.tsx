'use client';

import * as React from 'react';
import { GripVerticalIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ResizablePanelGroupProps extends React.ComponentProps<'div'> {
  direction?: 'horizontal' | 'vertical';
}

function ResizablePanelGroup({
  className,
  direction = 'horizontal',
  ...props
}: ResizablePanelGroupProps) {
  return (
    <div
      data-slot='resizable-panel-group'
      data-panel-group-direction={direction}
      className={cn(
        'flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
        className
      )}
      {...props}
    />
  );
}

interface ResizablePanelProps extends React.ComponentProps<'div'> {
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
}

function ResizablePanel({
  defaultSize,
  minSize,
  maxSize,
  ...props
}: ResizablePanelProps) {
  return <div data-slot='resizable-panel' {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  withHandle?: boolean;
}) {
  return (
    <div
      data-slot='resizable-handle'
      className={cn(
        'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className='bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border'>
          <GripVerticalIcon className='size-2.5' />
        </div>
      )}
    </div>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
