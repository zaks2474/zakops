/**
 * AgentActivityWidget
 *
 * Compact dashboard widget showing agent status and recent activity.
 * Uses useAgentActivity hook as single source of truth.
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconRobot,
  IconArrowRight,
  IconClock,
  IconPlayerPlay,
  IconShieldCheck,
  IconChartBar,
  IconFileText,
  IconMail,
  IconActivity,
  IconMessageCircle,
} from '@tabler/icons-react';
import { useAgentActivity, useAgentStatus } from '@/hooks/useAgentActivity';
import { useAskAgent } from '@/components/agent/AgentDrawer';
import type { AgentActivityEvent, AgentEventType } from '@/types/agent-activity';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// =============================================================================
// Props
// =============================================================================

interface AgentActivityWidgetProps {
  /** Maximum height of the widget */
  maxHeight?: string;
  /** Additional class names */
  className?: string;
  /** Maximum number of events to show */
  maxEvents?: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getEventIcon(type: AgentEventType) {
  if (type.startsWith('deal.')) return IconChartBar;
  if (type.startsWith('doc.')) return IconFileText;
  if (type.startsWith('email.') || type.startsWith('loi.')) return IconMail;
  if (type.startsWith('approval.')) return IconShieldCheck;
  if (type.startsWith('agent.')) return IconRobot;
  return IconActivity;
}

function getStatusConfig(status: 'idle' | 'working' | 'waiting_approval') {
  switch (status) {
    case 'waiting_approval':
      return {
        variant: 'destructive' as const,
        icon: IconShieldCheck,
        label: 'Needs Approval',
        pulse: false,
      };
    case 'working':
      return {
        variant: 'default' as const,
        icon: IconPlayerPlay,
        label: 'Working',
        pulse: true,
      };
    case 'idle':
    default:
      return {
        variant: 'secondary' as const,
        icon: IconClock,
        label: 'Idle',
        pulse: false,
      };
  }
}

// =============================================================================
// Main Component
// =============================================================================

export function AgentActivityWidget({
  maxHeight = '350px',
  className,
  maxEvents = 5,
}: AgentActivityWidgetProps) {
  const { data, isLoading, error } = useAgentActivity();
  const status = useAgentStatus();
  const askAgent = useAskAgent();
  const statusConfig = getStatusConfig(status);
  const StatusIcon = statusConfig.icon;

  // Show recent events, limited
  const recentEvents = data?.recent?.slice(0, maxEvents) ?? [];

  // Handle Ask Agent button click
  const handleAskAgent = () => {
    askAgent();
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconRobot className="h-5 w-5" />
              Agent Activity
            </CardTitle>
            <CardDescription>
              {data?.lastActivity
                ? `Last: ${data.lastActivity.label}`
                : 'AI agent status and actions'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusConfig.variant} className="gap-1">
              <StatusIcon className={cn('h-3 w-3', statusConfig.pulse && 'animate-pulse')} />
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        {/* Current Run Banner */}
        {data?.currentRun && (
          <div className="mb-3 p-2 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <IconPlayerPlay className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium">{data.currentRun.progressLabel}</span>
            </div>
            {data.currentRun.dealName && (
              <p className="text-xs text-muted-foreground mt-1 pl-6">
                Deal: {data.currentRun.dealName}
              </p>
            )}
          </div>
        )}

        {/* Activity List */}
        <ScrollArea style={{ maxHeight }} className="flex-1">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">Failed to load activity</p>
            </div>
          ) : recentEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <IconRobot className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentEvents.map((event) => (
                <EventItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer with stats and buttons */}
        <div className="pt-3 mt-auto border-t">
          {data?.stats && (
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{data.stats.toolsCalledToday} tools today</span>
              <span>{data.stats.dealsAnalyzed} deals analyzed</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleAskAgent}>
              <IconMessageCircle className="mr-2 h-4 w-4" />
              Ask Agent
            </Button>
            <Link href="/agent/activity" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full">
                View All
                <IconArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Event Item Component
// =============================================================================

function EventItem({ event }: { event: AgentActivityEvent }) {
  const router = useRouter();
  const Icon = getEventIcon(event.type);

  const handleClick = () => {
    // Navigate to activity page with event highlighted
    router.push(`/agent/activity?highlight=${event.id}`);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left flex items-start gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
    >
      <div className="p-1.5 rounded-full bg-primary/10 shrink-0">
        <Icon className="h-3 w-3 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{event.label}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {event.dealName && (
            <span className="truncate max-w-[120px]">{event.dealName}</span>
          )}
          <span>{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
        </div>
      </div>
    </button>
  );
}

export default AgentActivityWidget;
