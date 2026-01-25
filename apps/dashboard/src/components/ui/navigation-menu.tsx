'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

function NavigationMenu({ className, ...props }: React.ComponentProps<'nav'> & { viewport?: boolean }) {
  return <nav data-slot='navigation-menu' className={cn('relative z-10 flex w-full max-w-max flex-1 items-center justify-center', className)} {...props} />;
}

function NavigationMenuList({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot='navigation-menu-list' className={cn('group flex flex-1 list-none items-center justify-center gap-1', className)} {...props} />;
}

function NavigationMenuItem(props: React.ComponentProps<'li'>) {
  return <li data-slot='navigation-menu-item' {...props} />;
}

function NavigationMenuTrigger(props: React.ComponentProps<'button'>) {
  return <button type='button' data-slot='navigation-menu-trigger' {...props} />;
}

function NavigationMenuContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='navigation-menu-content' className={cn('bg-popover text-popover-foreground rounded-md border p-2 shadow-md', className)} {...props} />;
}

function NavigationMenuViewport(props: React.ComponentProps<'div'>) {
  return <div data-slot='navigation-menu-viewport' {...props} />;
}

function NavigationMenuLink(props: React.ComponentProps<'a'>) {
  return <a data-slot='navigation-menu-link' {...props} />;
}

function NavigationMenuIndicator(props: React.ComponentProps<'div'>) {
  return <div data-slot='navigation-menu-indicator' {...props} />;
}

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport
};
