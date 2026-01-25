/**
 * ApprovalCheckpoint Component
 *
 * A prominent checkpoint in the agent timeline indicating
 * where human approval is required. Shows:
 * - Tool call details
 * - Preview of what will happen
 * - Approve/Reject/Modify actions
 * - Risk level and impact indicators
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  IconShieldCheck,
  IconCheck,
  IconX,
  IconEdit,
  IconLoader2,
  IconAlertTriangle,
  IconExternalLink,
  IconClock,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import type { AgentToolCall } from '@/types/execution-contracts';
import { getToolDefinition, type RiskLevel } from '@/lib/agent/toolRegistry';
import { getRiskLevelColor } from './hooks/useAgentRun';

// =============================================================================
// Types
// =============================================================================

interface ApprovalCheckpointProps {
  toolCall: AgentToolCall;
  threadId: string;
  runId: string;
  onApprove: (params: {
    toolCallId: string;
    approvedBy: string;
    modifications?: Record<string, unknown>;
  }) => Promise<{ success: boolean; error?: string }>;
  onReject: (params: {
    toolCallId: string;
    rejectedBy: string;
    reason?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  operatorId?: string;
  isProcessing?: boolean;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ApprovalCheckpoint({
  toolCall,
  threadId,
  runId,
  onApprove,
  onReject,
  operatorId = 'operator',
  isProcessing = false,
  className = '',
}: ApprovalCheckpointProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [modifiedInputs, setModifiedInputs] = useState<Record<string, unknown>>(
    toolCall.tool_input
  );
  const [error, setError] = useState<string | null>(null);

  // Get tool definition
  const toolDef = getToolDefinition(toolCall.tool_name);
  const riskLevel = (toolDef?.riskLevel ?? 'high') as RiskLevel | 'critical';
  const hasExternalImpact = toolDef?.externalImpact ?? false;

  // Generate preview text
  const generatePreview = (): string => {
    const inputs = toolCall.tool_input;
    switch (toolCall.tool_name) {
      case 'update_deal_stage':
        return `Move deal to "${inputs.stage}" stage`;
      case 'send_email':
        return `Send email to ${inputs.to}: "${inputs.subject}"`;
      case 'create_document':
        return `Create document: ${inputs.filename}`;
      case 'update_deal_profile':
        return `Update deal profile with ${Object.keys(inputs.updates || {}).length} changes`;
      case 'write_deal_artifact':
        return `Write file: ${inputs.filename} to deal folder`;
      case 'create_action':
        return `Create action: ${inputs.title}`;
      case 'approve_quarantine':
        return `Approve quarantine item and create deal`;
      default:
        return `Execute ${toolCall.tool_name}`;
    }
  };

  // Handle approve
  const handleApprove = async (withModifications = false) => {
    setError(null);
    const result = await onApprove({
      toolCallId: toolCall.tool_call_id,
      approvedBy: operatorId,
      modifications: withModifications ? modifiedInputs : undefined,
    });
    if (!result.success) {
      setError(result.error || 'Failed to approve');
    } else {
      setShowModifyDialog(false);
    }
  };

  // Handle reject
  const handleReject = async () => {
    setError(null);
    const result = await onReject({
      toolCallId: toolCall.tool_call_id,
      rejectedBy: operatorId,
      reason: rejectReason || undefined,
    });
    if (!result.success) {
      setError(result.error || 'Failed to reject');
    } else {
      setShowRejectDialog(false);
      setRejectReason('');
    }
  };

  return (
    <>
      <Card
        className={`border-2 border-amber-500/50 bg-amber-500/5 ${className}`}
        data-testid="approval-checkpoint"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-amber-500/20">
                <IconShieldCheck className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-base">Approval Required</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(toolCall.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>

            {/* Risk level badge */}
            <Badge
              variant="outline"
              className={`${getRiskLevelColor(riskLevel)}`}
            >
              {riskLevel} risk
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <IconAlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Tool and action preview */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{toolCall.tool_name}</span>
              {hasExternalImpact && (
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                  <IconExternalLink className="w-3 h-3 mr-1" />
                  External
                </Badge>
              )}
            </div>
            <p className="text-sm bg-muted p-3 rounded-lg">{generatePreview()}</p>
          </div>

          {/* Input preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Input Parameters</Label>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32 font-mono">
              {JSON.stringify(toolCall.tool_input, null, 2)}
            </pre>
          </div>

          {/* Impact warnings */}
          {(riskLevel === 'high' || riskLevel === 'critical') && (
            <Alert variant="default" className="border-orange-500/50 bg-orange-500/5">
              <IconAlertTriangle className="h-4 w-4 text-orange-500" />
              <AlertTitle className="text-orange-500">High Impact Action</AlertTitle>
              <AlertDescription className="text-sm">
                {riskLevel === 'critical'
                  ? 'This action has major consequences and cannot be easily undone.'
                  : 'This action modifies data or has external effects.'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex gap-2 pt-4 border-t">
          <Button
            size="sm"
            onClick={() => handleApprove(false)}
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

          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setModifiedInputs({ ...toolCall.tool_input });
              setShowModifyDialog(true);
            }}
            disabled={isProcessing}
          >
            <IconEdit className="w-4 h-4 mr-1" />
            Modify
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRejectDialog(true)}
            disabled={isProcessing}
          >
            <IconX className="w-4 h-4 mr-1" />
            Reject
          </Button>
        </CardFooter>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Tool Call</DialogTitle>
            <DialogDescription>
              Rejecting this tool call will prevent it from executing. The agent will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tool</Label>
              <p className="text-sm font-mono">{toolCall.tool_name}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Textarea
                id="reject-reason"
                placeholder="Why is this being rejected?"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing}>
              {isProcessing ? (
                <IconLoader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <IconX className="w-4 h-4 mr-1" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify Dialog */}
      <Dialog open={showModifyDialog} onOpenChange={setShowModifyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modify and Approve</DialogTitle>
            <DialogDescription>
              Edit the input parameters before approving the tool call.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tool</Label>
              <p className="text-sm font-mono">{toolCall.tool_name}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modified-inputs">Modified Inputs (JSON)</Label>
              <Textarea
                id="modified-inputs"
                className="font-mono text-xs h-64"
                value={JSON.stringify(modifiedInputs, null, 2)}
                onChange={(e) => {
                  try {
                    setModifiedInputs(JSON.parse(e.target.value));
                    setError(null);
                  } catch {
                    setError('Invalid JSON');
                  }
                }}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <IconAlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModifyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleApprove(true)} disabled={isProcessing || !!error}>
              {isProcessing ? (
                <IconLoader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <IconCheck className="w-4 h-4 mr-1" />
              )}
              Approve with Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ApprovalCheckpoint;
