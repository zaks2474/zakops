'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

function Menubar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='menubar'
      className={cn('bg-background flex h-9 items-center gap-1 rounded-md border p-1 shadow-xs', className)}
      {...props}
    />
  );
}

function MenubarPortal(props: React.ComponentProps<'div'>) {
  return <div data-slot='menubar-portal' {...props} />;
}

function MenubarMenu(props: React.ComponentProps<'div'>) {
  return <div data-slot='menubar-menu' {...props} />;
}

function MenubarTrigger(props: React.ComponentProps<'button'>) {
  return <button type='button' data-slot='menubar-trigger' {...props} />;
}

function MenubarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='menubar-content'
      className={cn('bg-popover text-popover-foreground z-50 min-w-[8rem] rounded-md border p-1 shadow-md', className)}
      {...props}
    />
  );
}

function MenubarGroup(props: React.ComponentProps<'div'>) {
  return <div data-slot='menubar-group' {...props} />;
}

function MenubarSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='menubar-separator' className={cn('bg-border -mx-1 my-1 h-px', className)} {...props} />;
}

function MenubarLabel({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='menubar-label' className={cn('px-2 py-1.5 text-sm font-medium', className)} {...props} />;
}

function MenubarItem({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='menubar-item'
      className={cn('focus:bg-accent focus:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none', className)}
      {...props}
    />
  );
}

function MenubarShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot='menubar-shortcut' className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)} {...props} />;
}

function MenubarCheckboxItem(props: React.ComponentProps<'div'>) {
  return <div data-slot='menubar-checkbox-item' {...props} />;
}

function MenubarRadioGroup(props: React.ComponentProps<'div'>) {
  return <div data-slot='menubar-radio-group' {...props} />;
}

function MenubarRadioItem(props: React.ComponentProps<'div'>) {
  return <div data-slot='menubar-radio-item' {...props} />;
}

function MenubarSub(props: React.ComponentProps<'div'>) {
  return <div data-slot='menubar-sub' {...props} />;
}

function MenubarSubTrigger(props: React.ComponentProps<'div'>) {
  return <div data-slot='menubar-sub-trigger' {...props} />;
}

function MenubarSubContent(props: React.ComponentProps<'div'>) {
  return <div data-slot='menubar-sub-content' {...props} />;
}

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent
};
