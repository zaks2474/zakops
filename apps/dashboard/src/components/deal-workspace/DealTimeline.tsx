/**
 * DealTimeline Component
 *
 * Activity timeline for a deal showing:
 * - Stage changes
 * - Agent actions
 * - Document uploads
 * - Emails
 * - Notes
 */

'use client';

import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  IconArrowRight,
  IconFile,
  IconMail,
  IconRobot,
  IconUser,
  IconNote,
  IconCheck,
  IconX,
  IconClock,
  IconAlertTriangle,
  IconEye,
} from '@tabler/icons-react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import type { DealEvent, DealStage } from '@/types/api';
import { DEAL_STAGE_LABELS } from '@/types/execution-contracts';

// =============================================================================
// Types
// =============================================================================

interface DealTimelineProps {
  events: DealEvent[];
  isLoading?: boolean;
  className?: string;
}

interface TimelineGroup {
  date: string;
  label: string;
  events: DealEvent[];
}

// =============================================================================
// Event Config
// =============================================================================

const EVENT_CONFIG: Record<
  string,
  {
    icon: typeof IconArrowRight;
    color: string;
    label: string;
  }
> = {
  stage_changed: {
    icon: IconArrowRight,
    color: 'text-blue-500 bg-blue-500/20',
    label: 'Stage Changed',
  },
  document_uploaded: {
    icon: IconFile,
    color: 'text-green-500 bg-green-500/20',
    label: 'Document Uploaded',
  },
  email_received: {
    icon: IconMail,
    color: 'text-purple-500 bg-purple-500/20',
    label: 'Email Received',
  },
  email_sent: {
    icon: IconMail,
    color: 'text-cyan-500 bg-cyan-500/20',
    label: 'Email Sent',
  },
  agent_action: {
    icon: IconRobot,
    color: 'text-amber-500 bg-amber-500/20',
    label: 'Agent Action',
  },
  action_completed: {
    icon: IconCheck,
    color: 'text-green-500 bg-green-500/20',
    label: 'Action Completed',
  },
  action_failed: {
    icon: IconX,
    color: 'text-red-500 bg-red-500/20',
    label: 'Action Failed',
  },
  note_added: {
    icon: IconNote,
    color: 'text-slate-500 bg-slate-500/20',
    label: 'Note Added',
  },
  viewed: {
    icon: IconEye,
    color: 'text-gray-500 bg-gray-500/20',
    label: 'Viewed',
  },
  created: {
    icon: IconClock,
    color: 'text-blue-500 bg-blue-500/20',
    label: 'Created',
  },
  default: {
    icon: IconClock,
    color: 'text-gray-500 bg-gray-500/20',
    label: 'Event',
  },
};

// =============================================================================
// Component
// =============================================================================

export function DealTimeline({
  events,
  isLoading = false,
  className = '',
}: DealTimelineProps) {
  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: TimelineGroup[] = [];
    const eventsByDate: Record<string, DealEvent[]> = {};

    // Sort events by date (newest first)
    const sortedEvents = [...events].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    for (const event of sortedEvents) {
      const date = format(new Date(event.created_at), 'yyyy-MM-dd');
      if (!eventsByDate[date]) {
        eventsByDate[date] = [];
      }
      eventsByDate[date].push(event);
    }

    for (const [date, dateEvents] of Object.entries(eventsByDate)) {
      const eventDate = new Date(date);
      let label: string;

      if (isToday(eventDate)) {
        label = 'Today';
      } else if (isYesterday(eventDate)) {
        label = 'Yesterday';
      } else {
        label = format(eventDate, 'MMMM d, yyyy');
      }

      groups.push({ date, label, events: dateEvents });
    }

    return groups;
  }, [events]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="animate-pulse text-muted-foreground">Loading timeline...</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <IconClock className="w-12 h-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className={`h-full ${className}`}>
      <div className="p-6 space-y-6">
        {groupedEvents.map((group) => (
          <div key={group.date}>
            {/* Date header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium text-muted-foreground">
                {group.label}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Events */}
            <div className="relative pl-6 space-y-4">
              {/* Timeline line */}
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />

              {group.events.map((event, idx) => (
                <TimelineEvent key={event.id} event={event} isLast={idx === group.events.length - 1} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// Timeline Event
// =============================================================================

interface TimelineEventProps {
  event: DealEvent;
  isLast: boolean;
}

function TimelineEvent({ event, isLast }: TimelineEventProps) {
  const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.default;
  const Icon = config.icon;

  // Generate description based on event type and details
  const getDescription = () => {
    const details = event.details;

    switch (event.event_type) {
      case 'stage_changed':
        const fromStage = details.from_stage as DealStage | undefined;
        const toStage = details.to_stage as DealStage | undefined;
        return (
          <span>
            Moved from{' '}
            <strong>{fromStage ? DEAL_STAGE_LABELS[fromStage] : 'unknown'}</strong> to{' '}
            <strong>{toStage ? DEAL_STAGE_LABELS[toStage] : 'unknown'}</strong>
            {details.reason ? <span className="text-muted-foreground"> - {String(details.reason)}</span> : null}
          </span>
        );

      case 'document_uploaded':
        return (
          <span>
            Uploaded <strong>{String(details.filename || 'document')}</strong>
            {details.size ? <span className="text-muted-foreground"> ({formatFileSize(Number(details.size))})</span> : null}
          </span>
        );

      case 'email_received':
      case 'email_sent':
        return (
          <span>
            {event.event_type === 'email_received' ? 'Received' : 'Sent'}{' '}
            <strong>{String(details.subject || 'Email')}</strong>
            {details.from ? (
              <span className="text-muted-foreground"> from {String(details.from)}</span>
            ) : null}
          </span>
        );

      case 'agent_action':
        return (
          <span>
            Agent executed <strong>{String(details.tool_name || details.action_type || 'action')}</strong>
            {details.status === 'completed' && <Badge variant="outline" className="ml-2 text-xs bg-green-500/10 text-green-500">Success</Badge>}
            {details.status === 'failed' && <Badge variant="outline" className="ml-2 text-xs bg-red-500/10 text-red-500">Failed</Badge>}
          </span>
        );

      case 'note_added':
        return (
          <span className="line-clamp-2">{String(details.content || details.note || 'Note')}</span>
        );

      case 'created':
        return <span>Deal created</span>;

      default:
        return (
          <span>
            {config.label}
            {details.description ? `: ${String(details.description)}` : null}
          </span>
        );
    }
  };

  return (
    <div className="relative">
      {/* Timeline dot */}
      <div
        className={`absolute -left-6 mt-1 w-4 h-4 rounded-full flex items-center justify-center ${config.color}`}
      >
        <Icon className="w-2.5 h-2.5" />
      </div>

      {/* Event content */}
      <div className="bg-card border rounded-lg p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 text-sm">
            {getDescription()}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {format(new Date(event.created_at), 'HH:mm')}
          </span>
        </div>

        {/* Actor info */}
        {event.actor && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            {event.source === 'agent' ? (
              <IconRobot className="w-3 h-3" />
            ) : (
              <IconUser className="w-3 h-3" />
            )}
            {event.actor}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Utilities
// =============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default DealTimeline;
