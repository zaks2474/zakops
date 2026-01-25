/**
 * ApprovalCard Component
 *
 * Individual approval request card with:
 * - Tool name and risk level
 * - Preview of action
 * - Quick approve/reject actions
 * - Expandable details
 * - Time since requested
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
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
  IconShieldCheck,
  IconCheck,
  IconX,
  IconEdit,
  IconChevronDown,
  IconLoader2,
  IconExternalLink,
  IconClock,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { formatDistanceToNow, format } from 'date-fns';
import { getToolDefinition, type RiskLevel } from '@/lib/agent/toolRegistry';
import { getRiskLevelColor } from '@/components/agent/hooks/useAgentRun';
import type { AgentToolCall } from '@/types/execution-contracts';

// =============================================================================
// Types
// =============================================================================

interface ApprovalCardProps {
  toolCall: AgentToolCall;
  threadId: string;
  runId: string;
  dealId?: string;
  dealName?: string;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onModify?: () => void;
  onViewDetails?: () => void;
  isProcessing?: boolean;
  variant?: 'default' | 'compact' | 'expanded';
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ApprovalCard({
  toolCall,
  threadId,
  runId,
  dealId,
  dealName,
  onApprove,
  onReject,
  onModify,
  onViewDetails,
  isProcessing = false,
  variant = 'default',
  className = '',
}: ApprovalCardProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(variant === 'expanded');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Get tool definition
  const toolDef = getToolDefinition(toolCall.tool_name);
  const riskLevel = (toolDef?.riskLevel ?? 'high') as RiskLevel | 'critical';
  const hasExternalImpact = toolDef?.externalImpact ?? false;

  // Generate preview text based on tool and inputs
  const preview = useMemo(() => {
    const inputs = toolCall.tool_input;
    switch (toolCall.tool_name) {
      case 'update_deal_stage':
        return `Move deal to "${inputs.stage}" stage`;
      case 'send_email':
        return `Send email to ${inputs.to}: "${inputs.subject}"`;
      case 'create_document':
        return `Create document: ${inputs.filename}`;
      case 'update_deal_profile':
        return `Update ${Object.keys(inputs.updates || {}).length} deal profile fields`;
      case 'write_deal_artifact':
        return `Write file: ${inputs.filename}`;
      case 'create_action':
        return `Create action: ${inputs.title}`;
      case 'approve_quarantine':
        return 'Approve quarantine item and create new deal';
      case 'send_followup':
        return `Send follow-up to ${inputs.recipient}`;
      default:
        return `Execute ${toolCall.tool_name}`;
    }
  }, [toolCall.tool_name, toolCall.tool_input]);

  // Time since requested
  const timeAgo = formatDistanceToNow(new Date(toolCall.created_at), { addSuffix: true });

  // Handle approve with loading state
  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove();
    } finally {
      setIsApproving(false);
    }
  };

  // Handle reject with loading state
  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject();
    } finally {
      setIsRejecting(false);
    }
  };

  const isProcessingAction = isProcessing || isApproving || isRejecting;

  // Compact variant for lists
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${className}`}
      >
        {/* Risk indicator */}
        <div
          className={`w-1.5 h-12 rounded-full ${
            riskLevel === 'low'
              ? 'bg-green-500'
              : riskLevel === 'medium'
              ? 'bg-yellow-500'
              : riskLevel === 'high'
              ? 'bg-orange-500'
              : 'bg-red-500'
          }`}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium truncate">
              {toolCall.tool_name}
            </span>
            {hasExternalImpact && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <IconExternalLink className="w-3 h-3 text-purple-500" />
                  </TooltipTrigger>
                  <TooltipContent>Has external impact</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{preview}</p>
          {dealName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Deal: {dealName}
            </p>
          )}
        </div>

        {/* Time */}
        <div className="text-xs text-muted-foreground shrink-0">
          {timeAgo}
        </div>

        {/* Actions */}
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-green-500/20 hover:text-green-500"
            onClick={handleApprove}
            disabled={isProcessingAction}
          >
            {isApproving ? (
              <IconLoader2 className="w-4 h-4 animate-spin" />
            ) : (
              <IconCheck className="w-4 h-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-500"
            onClick={handleReject}
            disabled={isProcessingAction}
          >
            {isRejecting ? (
              <IconLoader2 className="w-4 h-4 animate-spin" />
            ) : (
              <IconX className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Default/expanded variant
  return (
    <Card
      className={`border-amber-500/30 bg-amber-500/5 ${className}`}
      data-testid="approval-card"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500/20">
              <IconShieldCheck className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{toolCall.tool_name}</span>
                <Badge
                  variant="outline"
                  className={getRiskLevelColor(riskLevel)}
                >
                  {riskLevel}
                </Badge>
                {hasExternalImpact && (
                  <Badge
                    variant="outline"
                    className="bg-purple-500/10 text-purple-500 border-purple-500/20"
                  >
                    <IconExternalLink className="w-3 h-3 mr-1" />
                    External
                  </Badge>
                )}
              </div>
              {dealName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deal: {dealName}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconClock className="w-3 h-3" />
            {timeAgo}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Preview */}
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm">{preview}</p>
        </div>

        {/* Risk warning for high/critical */}
        {(riskLevel === 'high' || riskLevel === 'critical') && (
          <div className="flex items-start gap-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <IconAlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-500">
              {riskLevel === 'critical'
                ? 'Critical action with major consequences'
                : 'High-impact action that modifies data'}
            </p>
          </div>
        )}

        {/* Expandable details */}
        <Collapsible open={detailsExpanded} onOpenChange={setDetailsExpanded}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <IconChevronDown
                className={`w-3 h-3 transition-transform ${detailsExpanded ? 'rotate-180' : ''}`}
              />
              {detailsExpanded ? 'Hide' : 'Show'} input parameters
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40 font-mono">
              {JSON.stringify(toolCall.tool_input, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <CardFooter className="flex gap-2 pt-3 border-t">
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={isProcessingAction}
          className="flex-1"
        >
          {isApproving ? (
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
            disabled={isProcessingAction}
          >
            <IconEdit className="w-4 h-4 mr-1" />
            Modify
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={handleReject}
          disabled={isProcessingAction}
        >
          {isRejecting ? (
            <IconLoader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <IconX className="w-4 h-4 mr-1" />
          )}
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}

export default ApprovalCard;
