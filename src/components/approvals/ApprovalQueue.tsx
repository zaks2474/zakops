/**
 * ApprovalQueue Component
 *
 * Global queue of pending approvals across all agent runs.
 * Features:
 * - Real-time updates
 * - Grouped by deal or run
 * - Priority ordering by risk level
 * - Quick batch actions
 * - Empty state
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IconShieldCheck,
  IconRefresh,
  IconLoader2,
  IconFilter,
  IconStack,
  IconTimeline,
  IconAlertTriangle,
  IconInbox,
} from '@tabler/icons-react';
import { useApprovalFlow } from '@/components/agent/hooks/useApprovalFlow';
import { ApprovalCard } from './ApprovalCard';
import { getToolDefinition, type RiskLevel } from '@/lib/agent/toolRegistry';
import type { AgentToolCall } from '@/types/execution-contracts';

// =============================================================================
// Types
// =============================================================================

type GroupBy = 'none' | 'deal' | 'run' | 'risk';
type SortBy = 'time' | 'risk';

interface ApprovalQueueProps {
  operatorId?: string;
  variant?: 'full' | 'sidebar' | 'compact';
  maxHeight?: string;
  onApprovalComplete?: (toolCallId: string, action: 'approved' | 'rejected') => void;
  className?: string;
}

interface GroupedApprovals {
  [key: string]: {
    label: string;
    approvals: AgentToolCall[];
  };
}

// =============================================================================
// Risk Level Priority
// =============================================================================

const RISK_PRIORITY: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// =============================================================================
// Component
// =============================================================================

export function ApprovalQueue({
  operatorId = 'operator',
  variant = 'full',
  maxHeight = 'calc(100vh - 12rem)',
  onApprovalComplete,
  className = '',
}: ApprovalQueueProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [sortBy, setSortBy] = useState<SortBy>('risk');
  const [activeView, setActiveView] = useState<'list' | 'grouped'>('list');

  const {
    pendingApprovals,
    isLoading,
    error,
    approve,
    reject,
    refetchApprovals,
    isApproving,
    isRejecting,
    currentlyProcessing,
  } = useApprovalFlow({
    onApprovalSuccess: (tc) => {
      onApprovalComplete?.(tc.tool_call_id, 'approved');
    },
    onRejectionSuccess: (tc) => {
      onApprovalComplete?.(tc.tool_call_id, 'rejected');
    },
  });

  // Sort approvals
  const sortedApprovals = useMemo(() => {
    const sorted = [...pendingApprovals];

    if (sortBy === 'risk') {
      sorted.sort((a, b) => {
        const toolDefA = getToolDefinition(a.tool_name);
        const toolDefB = getToolDefinition(b.tool_name);
        const riskA = toolDefA?.riskLevel ?? 'high';
        const riskB = toolDefB?.riskLevel ?? 'high';
        return (RISK_PRIORITY[riskA] ?? 2) - (RISK_PRIORITY[riskB] ?? 2);
      });
    } else {
      sorted.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    return sorted;
  }, [pendingApprovals, sortBy]);

  // Group approvals
  const groupedApprovals = useMemo(() => {
    if (groupBy === 'none') return null;

    const groups: GroupedApprovals = {};

    for (const approval of sortedApprovals) {
      let key: string;
      let label: string;

      switch (groupBy) {
        case 'deal':
          // Would need deal info from the tool call context
          key = 'unknown';
          label = 'Unknown Deal';
          break;
        case 'run':
          key = approval.run_id;
          label = `Run ${approval.run_id.slice(0, 8)}...`;
          break;
        case 'risk':
          const toolDef = getToolDefinition(approval.tool_name);
          key = toolDef?.riskLevel ?? 'high';
          label = `${key.charAt(0).toUpperCase() + key.slice(1)} Risk`;
          break;
        default:
          key = 'all';
          label = 'All';
      }

      if (!groups[key]) {
        groups[key] = { label, approvals: [] };
      }
      groups[key].approvals.push(approval);
    }

    return groups;
  }, [sortedApprovals, groupBy]);

  // Handle approve action
  const handleApprove = useCallback(
    async (toolCall: AgentToolCall) => {
      // Note: threadId would need to come from context - using empty for now
      await approve({
        threadId: '', // Would be populated from context
        runId: toolCall.run_id,
        toolCallId: toolCall.tool_call_id,
        approvedBy: operatorId,
      });
    },
    [approve, operatorId]
  );

  // Handle reject action
  const handleReject = useCallback(
    async (toolCall: AgentToolCall) => {
      await reject({
        threadId: '',
        runId: toolCall.run_id,
        toolCallId: toolCall.tool_call_id,
        rejectedBy: operatorId,
      });
    },
    [reject, operatorId]
  );

  // Count by risk level
  const riskCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const approval of pendingApprovals) {
      const toolDef = getToolDefinition(approval.tool_name);
      const risk = toolDef?.riskLevel ?? 'high';
      counts[risk] = (counts[risk] || 0) + 1;
    }
    return counts;
  }, [pendingApprovals]);

  // Compact variant for widgets
  if (variant === 'compact') {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconShieldCheck className="w-4 h-4 text-amber-500" />
              <CardTitle className="text-sm">Pending Approvals</CardTitle>
            </div>
            <Badge variant="default" className="bg-amber-500">
              {pendingApprovals.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {pendingApprovals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pending approvals
            </p>
          ) : (
            <div className="space-y-2">
              {sortedApprovals.slice(0, 3).map((approval) => (
                <ApprovalCard
                  key={approval.tool_call_id}
                  toolCall={approval}
                  threadId=""
                  runId={approval.run_id}
                  variant="compact"
                  onApprove={() => handleApprove(approval)}
                  onReject={() => handleReject(approval)}
                  isProcessing={currentlyProcessing === approval.tool_call_id}
                />
              ))}
              {pendingApprovals.length > 3 && (
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  View {pendingApprovals.length - 3} more
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`flex flex-col ${className}`}>
      <CardHeader className="pb-3 shrink-0 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500/20">
              <IconShieldCheck className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-base">Approval Queue</CardTitle>
              <p className="text-xs text-muted-foreground">
                {pendingApprovals.length} pending {pendingApprovals.length === 1 ? 'approval' : 'approvals'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Risk counts */}
            {riskCounts.critical > 0 && (
              <Badge variant="destructive" className="gap-1">
                <IconAlertTriangle className="w-3 h-3" />
                {riskCounts.critical}
              </Badge>
            )}
            {riskCounts.high > 0 && (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                {riskCounts.high}
              </Badge>
            )}

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => refetchApprovals()}
              disabled={isLoading}
            >
              <IconRefresh className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mt-3">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="risk">By Risk</SelectItem>
              <SelectItem value="time">By Time</SelectItem>
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="risk">By Risk</SelectItem>
              <SelectItem value="run">By Run</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea style={{ height: maxHeight }}>
          <div className="p-4">
            {/* Loading state */}
            {isLoading && pendingApprovals.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty state */}
            {!isLoading && pendingApprovals.length === 0 && (
              <div className="text-center py-12">
                <IconInbox className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No pending approvals
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Agent actions requiring approval will appear here
                </p>
              </div>
            )}

            {/* Grouped view */}
            {groupBy !== 'none' && groupedApprovals && (
              <div className="space-y-6">
                {Object.entries(groupedApprovals).map(([key, group]) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-3">
                      <IconStack className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">{group.label}</h3>
                      <Badge variant="outline" className="text-xs">
                        {group.approvals.length}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {group.approvals.map((approval) => (
                        <ApprovalCard
                          key={approval.tool_call_id}
                          toolCall={approval}
                          threadId=""
                          runId={approval.run_id}
                          onApprove={() => handleApprove(approval)}
                          onReject={() => handleReject(approval)}
                          isProcessing={currentlyProcessing === approval.tool_call_id}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Flat list view */}
            {groupBy === 'none' && pendingApprovals.length > 0 && (
              <div className="space-y-3">
                {sortedApprovals.map((approval) => (
                  <ApprovalCard
                    key={approval.tool_call_id}
                    toolCall={approval}
                    threadId=""
                    runId={approval.run_id}
                    onApprove={() => handleApprove(approval)}
                    onReject={() => handleReject(approval)}
                    isProcessing={currentlyProcessing === approval.tool_call_id}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default ApprovalQueue;
