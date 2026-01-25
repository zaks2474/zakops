/**
 * ActivityFeed Component
 *
 * Live feed of recent system activity.
 */

'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  IconArrowRight,
  IconFile,
  IconMail,
  IconRobot,
  IconUser,
  IconCheck,
  IconX,
  IconClock,
  IconAlertTriangle,
  IconEye,
  IconBriefcase,
} from '@tabler/icons-react';
import { format, formatDistanceToNow, isToday } from 'date-fns';
import type { DealEvent } from '@/types/api';
import { DEAL_STAGE_LABELS } from '@/types/execution-contracts';

// =============================================================================
// Types
// =============================================================================

interface ActivityFeedProps {
  events: DealEvent[];
  isLoading?: boolean;
  maxHeight?: string;
  className?: string;
}

// =============================================================================
// Event Config
// =============================================================================

const EVENT_CONFIG: Record<
  string,
  {
    icon: typeof IconClock;
    color: string;
  }
> = {
  stage_changed: { icon: IconArrowRight, color: 'text-blue-500 bg-blue-500/10' },
  document_uploaded: { icon: IconFile, color: 'text-green-500 bg-green-500/10' },
  email_received: { icon: IconMail, color: 'text-purple-500 bg-purple-500/10' },
  email_sent: { icon: IconMail, color: 'text-cyan-500 bg-cyan-500/10' },
  agent_action: { icon: IconRobot, color: 'text-amber-500 bg-amber-500/10' },
  action_completed: { icon: IconCheck, color: 'text-green-500 bg-green-500/10' },
  action_failed: { icon: IconX, color: 'text-red-500 bg-red-500/10' },
  deal_created: { icon: IconBriefcase, color: 'text-blue-500 bg-blue-500/10' },
  default: { icon: IconClock, color: 'text-gray-500 bg-gray-500/10' },
};

// =============================================================================
// Component
// =============================================================================

export function ActivityFeed({
  events,
  isLoading = false,
  maxHeight = 'calc(100vh - 20rem)',
  className = '',
}: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <IconClock className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No recent activity</p>
      </div>
    );
  }

  // Group events by date
  const groupedEvents: { date: string; label: string; events: DealEvent[] }[] = [];
  const eventsByDate: Record<string, DealEvent[]> = {};

  for (const event of events) {
    const date = format(new Date(event.created_at), 'yyyy-MM-dd');
    if (!eventsByDate[date]) {
      eventsByDate[date] = [];
    }
    eventsByDate[date].push(event);
  }

  for (const [date, dateEvents] of Object.entries(eventsByDate)) {
    groupedEvents.push({
      date,
      label: isToday(new Date(date)) ? 'Today' : format(new Date(date), 'MMMM d'),
      events: dateEvents,
    });
  }

  return (
    <ScrollArea style={{ height: maxHeight }} className={className}>
      <div className="space-y-6 pr-4">
        {groupedEvents.map((group) => (
          <div key={group.date}>
            <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background py-1 z-10">
              <span className="text-sm font-medium">{group.label}</span>
              <div className="flex-1 h-px bg-border" />
              <Badge variant="outline" className="text-xs">
                {group.events.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {group.events.map((event) => (
                <ActivityItem key={event.id} event={event} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// Activity Item
// =============================================================================

interface ActivityItemProps {
  event: DealEvent;
}

function ActivityItem({ event }: ActivityItemProps) {
  const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.default;
  const Icon = config.icon;

  // Generate description
  const getDescription = () => {
    const details = event.details;

    switch (event.event_type) {
      case 'stage_changed':
        return (
          <>
            Deal moved to{' '}
            <strong>{DEAL_STAGE_LABELS[details.to_stage as keyof typeof DEAL_STAGE_LABELS] || details.to_stage}</strong>
          </>
        );
      case 'document_uploaded':
        return (
          <>
            Document uploaded: <strong>{String(details.filename || 'file')}</strong>
          </>
        );
      case 'email_received':
        return (
          <>
            Email received from <strong>{String(details.from || 'unknown')}</strong>
          </>
        );
      case 'agent_action':
        return (
          <>
            Agent executed <strong>{String(details.tool_name || 'action')}</strong>
          </>
        );
      case 'deal_created':
        return <>New deal created</>;
      default:
        return <>{event.event_type.replace(/_/g, ' ')}</>;
    }
  };

  return (
    <div className="flex gap-3 group">
      <div className={`p-2 rounded-lg ${config.color} shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm">{getDescription()}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>
            {format(new Date(event.created_at), 'HH:mm')}
          </span>
          {event.actor && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                {event.source === 'agent' ? (
                  <IconRobot className="w-3 h-3" />
                ) : (
                  <IconUser className="w-3 h-3" />
                )}
                {event.actor}
              </span>
            </>
          )}
          <span>•</span>
          <span className="truncate">{event.deal_id}</span>
        </div>
      </div>
    </div>
  );
}

export default ActivityFeed;
