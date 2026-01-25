/**
 * TodayNextUpStrip Component
 *
 * Horizontal strip showing today's priorities:
 * - Pending approvals
 * - Scheduled actions
 * - Deals needing attention
 * - Quick stats
 */

'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { useRenderTracking } from '@/hooks/use-render-tracking';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  IconShieldCheck,
  IconCalendar,
  IconAlertTriangle,
  IconBriefcase,
  IconArrowRight,
  IconClock,
  IconInbox,
} from '@tabler/icons-react';
import { format } from 'date-fns';
import type { Action, Deal, QuarantineItem } from '@/types/api';
import { getItemHref } from '@/lib/routes';

// =============================================================================
// Types
// =============================================================================

interface TodayItem {
  id: string;
  type: 'approval' | 'scheduled' | 'deal' | 'quarantine';
  title: string;
  subtitle?: string;
  time?: Date;
  priority?: 'high' | 'medium' | 'low';
  href: string;
}

interface TodayNextUpStripProps {
  pendingApprovals?: Action[];
  scheduledActions?: Action[];
  urgentDeals?: Deal[];
  quarantineItems?: QuarantineItem[];
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function TodayNextUpStrip({
  pendingApprovals = [],
  scheduledActions = [],
  urgentDeals = [],
  quarantineItems = [],
  className = '',
}: TodayNextUpStripProps) {
  // Track renders in development
  useRenderTracking('TodayNextUpStrip');

  // Build list of today items
  const items: TodayItem[] = [];

  // Add pending approvals
  for (const action of pendingApprovals.slice(0, 5)) {
    items.push({
      id: `approval-${action.action_id}`,
      type: 'approval',
      title: action.title,
      subtitle: action.action_type,
      priority: action.risk_level === 'high' ? 'high' : 'medium',
      href: getItemHref('approval', action.action_id),
    });
  }

  // Add scheduled actions
  for (const action of scheduledActions.slice(0, 3)) {
    items.push({
      id: `scheduled-${action.action_id}`,
      type: 'scheduled',
      title: action.title,
      subtitle: action.action_type,
      time: action.scheduled_for ? new Date(action.scheduled_for) : undefined,
      href: getItemHref('action', action.action_id),
    });
  }

  // Add urgent deals
  for (const deal of urgentDeals.slice(0, 3)) {
    items.push({
      id: `deal-${deal.deal_id}`,
      type: 'deal',
      title: deal.display_name || deal.canonical_name,
      subtitle: `${deal.stage} - ${deal.days_since_update}d stale`,
      priority: 'high',
      href: getItemHref('deal', deal.deal_id),
    });
  }

  // Add quarantine items
  for (const item of quarantineItems.slice(0, 3)) {
    items.push({
      id: `quarantine-${item.id}`,
      type: 'quarantine',
      title: item.company_name || item.email_subject || 'Unknown',
      subtitle: item.sender || undefined,
      priority: item.urgency === 'HIGH' ? 'high' : item.urgency === 'MEDIUM' ? 'medium' : 'low',
      href: getItemHref('quarantine', item.id),
    });
  }

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-center">
          <IconCalendar className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            You're all caught up! No pending items.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="py-3 px-2">
        <div className="flex items-center gap-2 px-2 mb-2">
          <IconClock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Today & Next Up</span>
          <Badge variant="outline" className="text-xs">
            {items.length} items
          </Badge>
        </div>

        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2 px-2">
            {items.map((item) => (
              <TodayCard key={item.id} item={item} />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Today Card
// =============================================================================

interface TodayCardProps {
  item: TodayItem;
}

function TodayCard({ item }: TodayCardProps) {
  const typeConfig = {
    approval: {
      icon: IconShieldCheck,
      color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      label: 'Approval',
    },
    scheduled: {
      icon: IconCalendar,
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      label: 'Scheduled',
    },
    deal: {
      icon: IconBriefcase,
      color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      label: 'Deal',
    },
    quarantine: {
      icon: IconInbox,
      color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      label: 'Quarantine',
    },
  };

  const config = typeConfig[item.type];
  const Icon = config.icon;

  return (
    <Link href={item.href}>
      <Card className="w-64 shrink-0 hover:border-primary transition-colors cursor-pointer">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <Badge variant="outline" className={`text-xs ${config.color}`}>
              <Icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            {item.priority === 'high' && (
              <IconAlertTriangle className="w-4 h-4 text-red-500" />
            )}
          </div>

          <p className="font-medium text-sm truncate">{item.title}</p>
          {item.subtitle && (
            <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
          )}

          {item.time && (
            <p className="text-xs text-muted-foreground mt-1">
              {format(item.time, 'h:mm a')}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default TodayNextUpStrip;
