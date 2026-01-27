import { NavItem } from '@/types';

/**
 * ZakOps Dashboard Navigation Configuration
 */
export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: []
  },
  {
    title: 'Operator HQ',
    url: '/hq',
    icon: 'hq',
    isActive: false,
    shortcut: ['g', 'h'],
    items: []
  },
  {
    title: 'Deals',
    url: '/deals',
    icon: 'product',
    shortcut: ['g', 'd'],
    isActive: false,
    items: []
  },
  {
    title: 'Actions',
    url: '/actions',
    icon: 'kanban',
    shortcut: ['g', 'a'],
    isActive: false,
    items: []
  },
  {
    title: 'Quarantine',
    url: '/quarantine',
    icon: 'warning',
    shortcut: ['g', 'q'],
    isActive: false,
    items: []
  },
  {
    title: 'Chat',
    url: '/chat',
    icon: 'chat',
    shortcut: ['g', 'c'],
    isActive: false,
    items: []
  },
  {
    title: 'Agent Activity',
    url: '/agent/activity',
    icon: 'agent',
    shortcut: ['g', 'g'],
    isActive: false,
    items: []
  },
  {
    title: 'Onboarding',
    url: '/onboarding',
    icon: 'onboarding',
    isActive: false,
    shortcut: ['g', 'o'],
    items: []
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: 'settings',
    isActive: false,
    shortcut: ['g', 's'],
    items: []
  }
];
