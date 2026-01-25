/**
 * AgentPanel Component
 *
 * Main container showing agent activity with:
 * - Run status header
 * - Real-time timeline
 * - Reasoning display
 * - Evidence links
 * - Approval queue
 *
 * Can be used as a sidebar panel or full-page view.
 */

'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  IconRobot,
  IconRefresh,
  IconPlayerStop,
  IconLoader2,
  IconCheck,
  IconX,
  IconClock,
  IconAlertTriangle,
  IconChevronRight,
  IconActivity,
  IconShieldCheck,
  IconHistory,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { useAgentRun, formatDuration } from './hooks/useAgentRun';
import { useApprovalFlow } from './hooks/useApprovalFlow';
import { AgentRunTimeline } from './AgentRunTimeline';
import { ReasoningDisplay, ThinkingIndicator } from './ReasoningDisplay';
import { EvidenceLinks, extractEvidenceFromToolOutput, type EvidenceItem } from './EvidenceLinks';
import { ToolCallCard } from './ToolCallCard';
import type { RunStatus } from '@/types/execution-contracts';

// =============================================================================
// Types
// =============================================================================

interface AgentPanelProps {
  threadId: string;
  runId: string;
  operatorId?: string;
  variant?: 'sidebar' | 'full' | 'compact';
  showHeader?: boolean;
  showTabs?: boolean;
  defaultTab?: 'timeline' | 'approvals' | 'history';
  onRunCompleted?: () => void;
  onRunFailed?: (error: string) => void;
  className?: string;
}

// =============================================================================
// Status Configuration
// =============================================================================

const STATUS_CONFIG: Record<
  RunStatus,
  {
    label: string;
    icon: typeof IconClock;
    className: string;
  }
> = {
  pending: {
    label: 'Pending',
    icon: IconClock,
    className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  },
  running: {
    label: 'Running',
    icon: IconLoader2,
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  completed: {
    label: 'Completed',
    icon: IconCheck,
    className: 'bg-green-500/10 text-green-500 border-green-500/20',
  },
  failed: {
    label: 'Failed',
    icon: IconX,
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  cancelled: {
    label: 'Cancelled',
    icon: IconX,
    className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  },
};

// =============================================================================
// Component
// =============================================================================

export function AgentPanel({
  threadId,
  runId,
  operatorId = 'operator',
  variant = 'sidebar',
  showHeader = true,
  showTabs = true,
  defaultTab = 'timeline',
  onRunCompleted,
  onRunFailed,
  className = '',
}: AgentPanelProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Agent run state
  const {
    run,
    status,
    isLoading,
    isStreaming,
    error,
    toolCalls,
    pendingApprovals,
    completedToolCalls,
    currentThinking,
    streamTokens,
    progress,
    refetch,
    cancelRun,
  } = useAgentRun({
    threadId,
    runId,
    onRunCompleted: (run) => {
      onRunCompleted?.();
    },
    onRunFailed: (error) => {
      onRunFailed?.(error);
    },
  });

  // Approval flow
  const {
    approve,
    reject,
    isApproving,
    isRejecting,
    currentlyProcessing,
  } = useApprovalFlow();

  // Handle approve
  const handleApprove = useCallback(
    async (params: {
      toolCallId: string;
      approvedBy: string;
      modifications?: Record<string, unknown>;
    }) => {
      return approve({
        threadId,
        runId,
        ...params,
      });
    },
    [threadId, runId, approve]
  );

  // Handle reject
  const handleReject = useCallback(
    async (params: {
      toolCallId: string;
      rejectedBy: string;
      reason?: string;
    }) => {
      return reject({
        threadId,
        runId,
        ...params,
      });
    },
    [threadId, runId, reject]
  );

  // Extract evidence from tool outputs
  const evidence: EvidenceItem[] = toolCalls.flatMap((tc) =>
    tc.tool_output ? extractEvidenceFromToolOutput(tc.tool_name, tc.tool_output) : []
  );

  // Status badge
  const statusConfig = status ? STATUS_CONFIG[status] : null;
  const StatusIcon = statusConfig?.icon || IconClock;

  // Calculate run duration
  const duration = run?.started_at && run?.completed_at
    ? formatDuration(new Date(run.completed_at).getTime() - new Date(run.started_at).getTime())
    : null;

  // Loading state
  if (isLoading && !run) {
    return (
      <Card className={`${className}`}>
        <CardContent className="flex items-center justify-center py-12">
          <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error && !run) {
    return (
      <Card className={`border-red-500/50 ${className}`}>
        <CardContent className="py-8 text-center">
          <IconAlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Failed to load agent run
          </p>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2">
            <IconRefresh className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const panelHeight = variant === 'sidebar' ? 'h-[calc(100vh-8rem)]' : 'h-full';

  return (
    <Card className={`flex flex-col ${panelHeight} ${className}`}>
      {/* Header */}
      {showHeader && (
        <CardHeader className="pb-3 shrink-0 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <IconRobot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Agent Activity</CardTitle>
                {run?.created_at && (
                  <p className="text-xs text-muted-foreground">
                    Started {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Status badge */}
              {statusConfig && (
                <Badge variant="outline" className={statusConfig.className}>
                  <StatusIcon className={`w-3 h-3 mr-1 ${status === 'running' ? 'animate-spin' : ''}`} />
                  {statusConfig.label}
                </Badge>
              )}

              {/* Duration */}
              {duration && (
                <Badge variant="outline" className="font-mono text-xs">
                  {duration}
                </Badge>
              )}

              {/* Actions */}
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => refetch()}>
                  <IconRefresh className="w-4 h-4" />
                </Button>
                {status === 'running' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                    onClick={cancelRun}
                  >
                    <IconPlayerStop className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar for running status */}
          {status === 'running' && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {progress.completedToolCalls} of {progress.totalToolCalls || '?'} steps
                </span>
                {progress.pendingApprovals > 0 && (
                  <span className="text-amber-500">
                    {progress.pendingApprovals} pending approval
                  </span>
                )}
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress.percentComplete}%` }}
                />
              </div>
            </div>
          )}

          {/* Pending approvals alert */}
          {pendingApprovals.length > 0 && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <IconShieldCheck className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-amber-500">
                {pendingApprovals.length} approval{pendingApprovals.length > 1 ? 's' : ''} required
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-xs"
                onClick={() => setActiveTab('approvals')}
              >
                Review
                <IconChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
        </CardHeader>
      )}

      {/* Content */}
      <CardContent className="flex-1 overflow-hidden p-0">
        {showTabs ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="h-full flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 pt-2">
              <TabsTrigger value="timeline" className="gap-1.5">
                <IconActivity className="w-4 h-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="approvals" className="gap-1.5">
                <IconShieldCheck className="w-4 h-4" />
                Approvals
                {pendingApprovals.length > 0 && (
                  <Badge variant="default" className="ml-1 h-5 px-1.5 bg-amber-500">
                    {pendingApprovals.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                <IconHistory className="w-4 h-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {/* Reasoning display */}
                  <ReasoningDisplay
                    thinking={currentThinking}
                    isStreaming={isStreaming}
                    streamTokens={streamTokens}
                  />

                  {/* Timeline */}
                  <AgentRunTimeline
                    run={run}
                    toolCalls={toolCalls}
                    currentThinking={currentThinking}
                    isStreaming={isStreaming}
                    threadId={threadId}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    operatorId={operatorId}
                    isProcessing={isApproving || isRejecting}
                  />

                  {/* Evidence links */}
                  {evidence.length > 0 && (
                    <EvidenceLinks evidence={evidence} />
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="approvals" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {pendingApprovals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <IconShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No pending approvals</p>
                    </div>
                  ) : (
                    pendingApprovals.map((tc) => (
                      <ToolCallCard
                        key={tc.tool_call_id}
                        toolCall={tc}
                        showApprovalActions
                        onApprove={() => handleApprove({ toolCallId: tc.tool_call_id, approvedBy: operatorId })}
                        onReject={() => handleReject({ toolCallId: tc.tool_call_id, rejectedBy: operatorId })}
                        isProcessing={currentlyProcessing === tc.tool_call_id}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-3">
                  {completedToolCalls.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <IconHistory className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No completed actions yet</p>
                    </div>
                  ) : (
                    completedToolCalls.map((tc) => (
                      <ToolCallCard
                        key={tc.tool_call_id}
                        toolCall={tc}
                        compact
                        showApprovalActions={false}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <ReasoningDisplay
                thinking={currentThinking}
                isStreaming={isStreaming}
                streamTokens={streamTokens}
              />

              <AgentRunTimeline
                run={run}
                toolCalls={toolCalls}
                currentThinking={currentThinking}
                isStreaming={isStreaming}
                threadId={threadId}
                onApprove={handleApprove}
                onReject={handleReject}
                operatorId={operatorId}
                isProcessing={isApproving || isRejecting}
              />

              {evidence.length > 0 && (
                <EvidenceLinks evidence={evidence} />
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default AgentPanel;
