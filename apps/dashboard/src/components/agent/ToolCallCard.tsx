/**
 * ToolCallCard Component
 *
 * Displays a single tool call with:
 * - Tool name and risk level indicator
 * - Input parameters (collapsible)
 * - Output/result (if completed)
 * - Status and timing
 * - Approval actions (if pending)
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  IconChevronDown,
  IconCheck,
  IconX,
  IconLoader2,
  IconClock,
  IconAlertTriangle,
  IconShieldCheck,
  IconExternalLink,
  IconEdit,
  IconEye,
} from '@tabler/icons-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { AgentToolCall } from '@/types/execution-contracts';
import { getToolDefinition, type RiskLevel } from '@/lib/agent/toolRegistry';
import { getRiskLevelColor, formatDuration } from './hooks/useAgentRun';

// =============================================================================
// Types
// =============================================================================

interface ToolCallCardProps {
  toolCall: AgentToolCall;
  onApprove?: () => void;
  onReject?: () => void;
  onModify?: () => void;
  onViewDetails?: () => void;
  isProcessing?: boolean;
  compact?: boolean;
  showApprovalActions?: boolean;
  className?: string;
}

// =============================================================================
// Status Configuration
// =============================================================================

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof IconClock;
    className: string;
  }
> = {
  pending: {
    label: 'Pending',
    icon: IconClock,
    className: 'bg-yellow-500/10 text-yellow-500',
  },
  approved: {
    label: 'Approved',
    icon: IconShieldCheck,
    className: 'bg-green-500/10 text-green-500',
  },
  rejected: {
    label: 'Rejected',
    icon: IconX,
    className: 'bg-red-500/10 text-red-500',
  },
  completed: {
    label: 'Completed',
    icon: IconCheck,
    className: 'bg-green-500/10 text-green-500',
  },
  failed: {
    label: 'Failed',
    icon: IconAlertTriangle,
    className: 'bg-red-500/10 text-red-500',
  },
};

// =============================================================================
// Component
// =============================================================================

export function ToolCallCard({
  toolCall,
  onApprove,
  onReject,
  onModify,
  onViewDetails,
  isProcessing = false,
  compact = false,
  showApprovalActions = true,
  className = '',
}: ToolCallCardProps) {
  const [inputsExpanded, setInputsExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  // Get tool definition for additional metadata
  const toolDef = getToolDefinition(toolCall.tool_name);
  const riskLevel = (toolDef?.riskLevel ?? 'high') as RiskLevel | 'critical';
  const statusConfig = STATUS_CONFIG[toolCall.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  // Calculate duration if we have timing info
  const duration = useMemo(() => {
    if (toolCall.started_at && toolCall.completed_at) {
      const start = new Date(toolCall.started_at).getTime();
      const end = new Date(toolCall.completed_at).getTime();
      return formatDuration(end - start);
    }
    return null;
  }, [toolCall.started_at, toolCall.completed_at]);

  // Check if approval actions should be shown
  const showActions =
    showApprovalActions &&
    toolCall.status === 'pending' &&
    toolCall.requires_approval;

  // Compact card for timeline view
  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${className}`}
      >
        {/* Risk indicator dot */}
        <div
          className={`w-2 h-2 rounded-full ${
            riskLevel === 'low'
              ? 'bg-green-500'
              : riskLevel === 'medium'
              ? 'bg-yellow-500'
              : riskLevel === 'high'
              ? 'bg-orange-500'
              : 'bg-red-500'
          }`}
        />

        {/* Tool info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm truncate">{toolCall.tool_name}</span>
            <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
          {toolCall.created_at && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(toolCall.created_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onApprove}>
              <IconCheck className="w-4 h-4 text-green-500" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onReject}>
              <IconX className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        )}

        {onViewDetails && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onViewDetails}>
            <IconEye className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  // Full card
  return (
    <Card className={`transition-all ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          {/* Tool info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-medium">{toolCall.tool_name}</span>

              {/* Risk level badge */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getRiskLevelColor(riskLevel)}`}
                    >
                      {riskLevel}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Risk Level: {riskLevel}</p>
                    {toolDef && <p className="text-xs text-muted-foreground">{toolDef.description}</p>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Status badge */}
              <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>

              {/* Requires approval indicator */}
              {toolCall.requires_approval && toolCall.status === 'pending' && (
                <Badge variant="default" className="text-xs bg-amber-500 hover:bg-amber-600">
                  <IconShieldCheck className="w-3 h-3 mr-1" />
                  Approval Required
                </Badge>
              )}
            </div>

            {/* Description from tool registry */}
            {toolDef && (
              <p className="text-sm text-muted-foreground mt-1">{toolDef.description}</p>
            )}
          </div>

          {/* Timing info */}
          <div className="text-right text-sm text-muted-foreground shrink-0">
            {toolCall.created_at && (
              <div className="text-xs">
                {format(new Date(toolCall.created_at), 'HH:mm:ss')}
              </div>
            )}
            {duration && (
              <div className="text-xs font-mono">
                {duration}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Input parameters */}
        <Collapsible open={inputsExpanded} onOpenChange={setInputsExpanded}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium hover:text-primary w-full text-left"
            >
              <IconChevronDown
                className={`h-4 w-4 transition-transform ${inputsExpanded ? 'rotate-180' : ''}`}
              />
              Input Parameters
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48 font-mono">
              {JSON.stringify(toolCall.tool_input, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>

        {/* Output (if completed) */}
        {toolCall.tool_output !== null && toolCall.status === 'completed' && (
          <Collapsible open={outputExpanded} onOpenChange={setOutputExpanded}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium hover:text-primary w-full text-left"
              >
                <IconChevronDown
                  className={`h-4 w-4 transition-transform ${outputExpanded ? 'rotate-180' : ''}`}
                />
                Output
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48 font-mono">
                {typeof toolCall.tool_output === 'string'
                  ? toolCall.tool_output
                  : JSON.stringify(toolCall.tool_output, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Error display */}
        {toolCall.error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <div className="flex items-start gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-destructive font-medium">Error</p>
                <p className="text-xs text-muted-foreground mt-1">{toolCall.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Approval info */}
        {toolCall.approved_by && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconShieldCheck className="w-4 h-4 text-green-500" />
            <span>
              Approved by <strong>{toolCall.approved_by}</strong>
              {toolCall.approved_at && (
                <> at {format(new Date(toolCall.approved_at), 'HH:mm:ss')}</>
              )}
            </span>
          </div>
        )}

        {/* Approval actions */}
        {showActions && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={onApprove}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <IconLoader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <IconCheck className="w-4 h-4 mr-1" />
              )}
              Approve
            </Button>

            {onModify && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onModify}
                disabled={isProcessing}
              >
                <IconEdit className="w-4 h-4 mr-1" />
                Modify
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              disabled={isProcessing}
            >
              <IconX className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ToolCallCard;
