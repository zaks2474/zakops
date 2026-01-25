/**
 * AgentStatusIndicator Component
 *
 * Header indicator showing agent status with click-to-open drawer.
 * Uses useAgentActivity hook as single source of truth.
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  IconRobot,
  IconClock,
  IconPlayerPlay,
  IconShieldCheck,
  IconMessageCircle,
  IconActivity,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useAgentActivity, useAgentStatus } from '@/hooks/useAgentActivity';
import { useAskAgent } from '@/components/agent/AgentDrawer';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface AgentStatusIndicatorProps {
  /** Variant: badge shows colored badge, icon shows just icon */
  variant?: 'badge' | 'icon';
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusConfig(status: 'idle' | 'working' | 'waiting_approval') {
  switch (status) {
    case 'waiting_approval':
      return {
        variant: 'destructive' as const,
        icon: IconShieldCheck,
        label: 'Needs Approval',
        description: 'Agent is waiting for your approval',
        pulse: true,
        dotColor: 'bg-amber-500',
        iconColor: 'text-amber-500',
      };
    case 'working':
      return {
        variant: 'default' as const,
        icon: IconPlayerPlay,
        label: 'Working',
        description: 'Agent is processing a task',
        pulse: true,
        dotColor: 'bg-blue-500',
        iconColor: 'text-blue-500',
      };
    case 'idle':
    default:
      return {
        variant: 'secondary' as const,
        icon: IconClock,
        label: 'Idle',
        description: 'Agent is ready',
        pulse: false,
        dotColor: 'bg-green-500',
        iconColor: 'text-green-500',
      };
  }
}

// =============================================================================
// Component
// =============================================================================

export function AgentStatusIndicator({
  variant = 'badge',
  showTooltip = true,
  className = '',
}: AgentStatusIndicatorProps) {
  const { data, isLoading } = useAgentActivity();
  const status = useAgentStatus();
  const askAgent = useAskAgent();

  const statusConfig = getStatusConfig(status);
  const StatusIcon = statusConfig.icon;

  // Loading state
  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className={className}>
        <IconRobot className="h-4 w-4 animate-pulse" />
      </Button>
    );
  }

  // Icon-only variant - also uses Popover for consistency
  if (variant === 'icon') {
    const iconTrigger = (
      <Button
        variant="ghost"
        size="sm"
        className={cn('relative', className)}
      >
        <IconRobot className={cn('h-4 w-4', statusConfig.iconColor)} />
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-background',
            statusConfig.dotColor,
            statusConfig.pulse && 'animate-pulse'
          )}
        />
      </Button>
    );

    return (
      <Popover>
        <PopoverTrigger asChild>{iconTrigger}</PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="end" sideOffset={8}>
          <AgentPopoverContent
            status={status}
            statusConfig={statusConfig}
            data={data}
            onAskAgent={askAgent}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Badge variant (default) - uses Popover for richer interaction
  const badgeTrigger = (
    <Button
      variant="ghost"
      size="sm"
      className={cn('gap-1.5 px-2', className)}
    >
      <IconRobot className="h-4 w-4" />
      <Badge variant={statusConfig.variant} className="gap-1">
        <StatusIcon className={cn('h-3 w-3', statusConfig.pulse && 'animate-pulse')} />
        {statusConfig.label}
      </Badge>
    </Button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{badgeTrigger}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <AgentPopoverContent
          status={status}
          statusConfig={statusConfig}
          data={data}
          onAskAgent={askAgent}
        />
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// Popover Content (for badge variant)
// =============================================================================

interface AgentPopoverContentProps {
  status: 'idle' | 'working' | 'waiting_approval';
  statusConfig: ReturnType<typeof getStatusConfig>;
  data?: {
    lastActivity?: {
      label: string;
      timestamp: string;
      dealId?: string;
    } | null;
    currentRun?: {
      progressLabel: string;
      dealName?: string;
      startedAt: string;
    };
    stats?: {
      toolsCalledToday: number;
      dealsAnalyzed: number;
      approvalsProcessed: number;
      runsCompleted24h: number;
    };
    pendingApprovals?: Array<{ id: string }>;
  };
  onAskAgent: () => void;
}

function AgentPopoverContent({
  status,
  statusConfig,
  data,
  onAskAgent,
}: AgentPopoverContentProps) {
  const StatusIcon = statusConfig.icon;

  return (
    <div className="divide-y">
      {/* Header with status */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn('p-1.5 rounded-full', `${statusConfig.dotColor}/20`)}>
            <IconRobot className={cn('h-4 w-4', statusConfig.iconColor)} />
          </div>
          <div>
            <p className="font-medium text-sm">AI Agent</p>
            <Badge variant={statusConfig.variant} className="gap-1 text-xs">
              <StatusIcon className={cn('h-3 w-3', statusConfig.pulse && 'animate-pulse')} />
              {statusConfig.label}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{statusConfig.description}</p>
      </div>

      {/* Current activity or last activity */}
      {(data?.currentRun || data?.lastActivity) && (
        <div className="p-3">
          {data?.currentRun && status === 'working' && (
            <div className="text-sm">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Current Task
              </p>
              <p>{data.currentRun.progressLabel}</p>
              {data.currentRun.dealName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deal: {data.currentRun.dealName}
                </p>
              )}
            </div>
          )}
          {data?.lastActivity && status === 'idle' && (
            <div className="text-sm">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Last Activity
              </p>
              <p className="truncate">{data.lastActivity.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(data.lastActivity.timestamp), { addSuffix: true })}
              </p>
            </div>
          )}
          {status === 'waiting_approval' && (
            <div className="text-sm">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Pending Approvals
              </p>
              <p className="text-amber-600 dark:text-amber-400">
                {data?.pendingApprovals?.length ?? 1} action{(data?.pendingApprovals?.length ?? 1) !== 1 ? 's' : ''} waiting
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick stats */}
      {data?.stats && (
        <div className="p-3 grid grid-cols-2 gap-2 text-center">
          <div className="p-2 rounded-md bg-muted/50">
            <p className="text-lg font-semibold">{data.stats.toolsCalledToday}</p>
            <p className="text-xs text-muted-foreground">Tools Today</p>
          </div>
          <div className="p-2 rounded-md bg-muted/50">
            <p className="text-lg font-semibold">{data.stats.dealsAnalyzed}</p>
            <p className="text-xs text-muted-foreground">Deals Analyzed</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="p-3 flex gap-2">
        <Link href="/agent/activity" className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            <IconActivity className="h-4 w-4 mr-1.5" />
            View Activity
          </Button>
        </Link>
        <Button size="sm" className="flex-1" onClick={onAskAgent}>
          <IconMessageCircle className="h-4 w-4 mr-1.5" />
          Ask Agent
        </Button>
      </div>
    </div>
  );
}

export default AgentStatusIndicator;
