'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

function Drawer({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return <div data-slot='drawer' className={cn(className)} {...props} />;
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<'button'>) {
  return <button type='button' data-slot='drawer-trigger' {...props} />;
}

function DrawerPortal({
  ...props
}: React.ComponentProps<'div'>) {
  return <div data-slot='drawer-portal' {...props} />;
}

function DrawerClose({
  ...props
}: React.ComponentProps<'button'>) {
  return <button type='button' data-slot='drawer-close' {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-overlay'
      className={cn(
        'fixed inset-0 z-50 bg-black/50',
        className
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <DrawerPortal data-slot='drawer-portal'>
      <DrawerOverlay />
      <div
        data-slot='drawer-content'
        className={cn(
          'bg-background fixed inset-x-0 bottom-0 z-50 flex h-auto max-h-[80vh] flex-col rounded-t-lg border-t',
          className
        )}
        {...props}
      >
        <div className='bg-muted mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full' />
        {children}
      </div>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-header'
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-footer'
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-title'
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription
};
