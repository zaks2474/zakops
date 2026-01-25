/**
 * DealAgentPanel Component
 *
 * Deal-specific agent activity panel.
 * Shows recent agent activity filtered to this deal.
 * Uses useAgentActivity hook as single source of truth.
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconRobot,
  IconClock,
  IconPlayerPlay,
  IconShieldCheck,
  IconChartBar,
  IconFileText,
  IconMail,
  IconActivity,
  IconMessageCircle,
  IconCircleCheck,
  IconCircleX,
} from '@tabler/icons-react';
import { useAgentActivity } from '@/hooks/useAgentActivity';
import { useAskAgent } from '@/components/agent/AgentDrawer';
import type { AgentActivityEvent, AgentRecentRun, AgentEventType } from '@/types/agent-activity';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface DealAgentPanelProps {
  /** Deal ID to filter activity */
  dealId: string;
  /** Deal name for display and context */
  dealName?: string;
  /** Maximum height */
  maxHeight?: string;
  /** Additional class names */
  className?: string;
  /** Show header (default true) */
  showHeader?: boolean;
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

function getRunStatusBadge(status: AgentRecentRun['status']) {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-green-500 gap-1"><IconCircleCheck className="h-3 w-3" />Done</Badge>;
    case 'failed':
      return <Badge variant="destructive" className="gap-1"><IconCircleX className="h-3 w-3" />Failed</Badge>;
    case 'cancelled':
      return <Badge variant="secondary" className="gap-1">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// =============================================================================
// Component
// =============================================================================

export function DealAgentPanel({
  dealId,
  dealName,
  maxHeight = '400px',
  className = '',
  showHeader = true,
}: DealAgentPanelProps) {
  const { data, isLoading, error } = useAgentActivity({ dealId });
  const askAgent = useAskAgent();

  // Filter data for this deal (API should already filter, but double-check)
  const dealEvents = data?.recent?.filter(e => e.dealId === dealId) ?? [];
  const dealRuns = data?.recentRuns?.filter(r => r.dealId === dealId) ?? [];
  const currentRun = data?.currentRun?.dealId === dealId ? data.currentRun : undefined;

  // Handle "Ask Agent" button
  const handleAskAgent = () => {
    askAgent({
      dealId,
      dealName,
      initialQuestion: '',
    });
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconRobot className="h-4 w-4" />
                Agent Activity
              </CardTitle>
              <CardDescription className="text-xs">
                {dealEvents.length} event{dealEvents.length !== 1 ? 's' : ''}, {dealRuns.length} run{dealRuns.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAskAgent}
              className="gap-1.5"
            >
              <IconMessageCircle className="h-3.5 w-3.5" />
              Ask Agent
            </Button>
          </div>
        </CardHeader>
      )}

      <CardContent className={cn('flex-1 min-h-0', !showHeader && 'pt-4')}>
        {/* Current Run Banner */}
        {currentRun && (
          <div className="mb-3 p-2 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <IconPlayerPlay className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium">{currentRun.progressLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 pl-6">
              Started {formatDistanceToNow(new Date(currentRun.startedAt), { addSuffix: true })}
            </p>
          </div>
        )}

        <ScrollArea style={{ maxHeight }} className="pr-2">
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
          ) : dealEvents.length === 0 && dealRuns.length === 0 ? (
            <EmptyState onAskAgent={handleAskAgent} />
          ) : (
            <div className="space-y-4">
              {/* Recent Runs */}
              {dealRuns.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Recent Runs</h4>
                  <div className="space-y-2">
                    {dealRuns.slice(0, 3).map((run) => (
                      <RunItem key={run.runId} run={run} />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Events */}
              {dealEvents.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Recent Activity</h4>
                  <div className="space-y-1">
                    {dealEvents.slice(0, 5).map((event) => (
                      <EventItem key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function EmptyState({ onAskAgent }: { onAskAgent: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
      <IconRobot className="h-8 w-8 mb-2 opacity-50" />
      <p className="text-sm">No agent activity for this deal</p>
      <Button
        variant="link"
        size="sm"
        onClick={onAskAgent}
        className="mt-2"
      >
        Ask agent for help
      </Button>
    </div>
  );
}

function EventItem({ event }: { event: AgentActivityEvent }) {
  const Icon = getEventIcon(event.type);

  return (
    <div className="flex items-start gap-2 p-2 rounded hover:bg-accent/50 transition-colors">
      <div className="p-1 rounded-full bg-primary/10 shrink-0">
        <Icon className="h-3 w-3 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate">{event.label}</p>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}

function RunItem({ run }: { run: AgentRecentRun }) {
  return (
    <div className="p-2 rounded-lg border hover:bg-accent/50 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-1">
        {getRunStatusBadge(run.status)}
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
        </span>
      </div>
      <p className="text-xs truncate">{run.summary}</p>
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <span>{run.toolsCalled} tools</span>
        <span>{run.approvalsRequested} approvals</span>
      </div>
    </div>
  );
}

export default DealAgentPanel;
