/**
 * QuickStats Component
 *
 * Row of key metrics for operator HQ.
 * Cards are clickable and navigate to relevant pages.
 */

'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import {
  IconBriefcase,
  IconInbox,
  IconShieldCheck,
  IconActivity,
  IconTrendingUp,
  IconTrendingDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import type { PipelineStats } from '@/types/api';

// =============================================================================
// Types
// =============================================================================

interface QuickStatsProps {
  stats?: PipelineStats;
  isLoading?: boolean;
  className?: string;
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: typeof IconBriefcase;
  href: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  highlight?: boolean;
  isLoading?: boolean;
}

// =============================================================================
// Stat Card Component
// =============================================================================

function StatCard({ label, value, icon: Icon, href, trend, highlight, isLoading }: StatCardProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(href)}
      className={cn(
        'w-full text-left rounded-xl border transition-all duration-200',
        'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
        'group cursor-pointer',
        highlight
          ? 'border-amber-500/50 bg-amber-500/5 hover:border-amber-500 hover:bg-amber-500/10'
          : 'bg-card hover:bg-accent/50 hover:border-primary/50'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg transition-colors',
              highlight ? 'bg-amber-500/20' : 'bg-muted group-hover:bg-primary/10'
            )}>
              <Icon className={cn(
                'w-4 h-4 transition-colors',
                highlight ? 'text-amber-500' : 'text-muted-foreground group-hover:text-primary'
              )} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              {isLoading ? (
                <div className="h-7 w-12 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold">{value}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {trend && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs',
                  trend.direction === 'up' ? 'text-green-500' : 'text-red-500'
                )}
              >
                {trend.direction === 'up' ? (
                  <IconTrendingUp className="w-3 h-3" />
                ) : (
                  <IconTrendingDown className="w-3 h-3" />
                )}
                {Math.abs(trend.value)}%
              </div>
            )}
            <IconChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </CardContent>
    </button>
  );
}

// =============================================================================
// Quick Stats Component
// =============================================================================

export function QuickStats({ stats, isLoading = false, className = '' }: QuickStatsProps) {
  const statCards: Omit<StatCardProps, 'isLoading'>[] = [
    {
      label: 'Active Deals',
      value: stats?.total_active_deals ?? 0,
      icon: IconBriefcase,
      href: '/deals',
      trend: { value: 5, direction: 'up' as const },
    },
    {
      label: 'Pending Approvals',
      value: stats?.pending_actions ?? 0,
      icon: IconShieldCheck,
      href: '/actions',
      highlight: (stats?.pending_actions ?? 0) > 0,
    },
    {
      label: 'Quarantine',
      value: stats?.quarantine_pending ?? 0,
      icon: IconInbox,
      href: '/quarantine',
      highlight: (stats?.quarantine_pending ?? 0) > 0,
    },
    {
      label: 'Events (24h)',
      value: stats?.recent_events_24h ?? 0,
      icon: IconActivity,
      href: '/agent/activity',
    },
  ];

  return (
    <div className={cn('grid grid-cols-4 gap-4 px-6 py-4 border-b', className)}>
      {statCards.map((stat) => (
        <StatCard
          key={stat.label}
          {...stat}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}

export default QuickStats;
