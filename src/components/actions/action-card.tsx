'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  IconCheck,
  IconX,
  IconRefresh,
  IconPlayerPlay,
  IconPlayerStop,
  IconDownload,
  IconEye,
  IconChevronDown,
  IconAlertTriangle,
  IconClock,
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
  IconShieldCheck,
  IconEdit,
  IconExternalLink,
  IconAlertCircle,
} from '@tabler/icons-react';
import { format } from 'date-fns';
import type { KineticAction, KineticActionStatus, Capability } from '@/lib/api';
import { ActionInputForm, ActionInputDisplay, validateFormValues } from './action-input-form';

const STATUS_CONFIGS: Record<
  KineticActionStatus,
  {
    label: string;
    icon: typeof IconClock;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className: string;
  }
> = {
  PENDING_APPROVAL: {
    label: 'Pending Approval',
    icon: IconShieldCheck,
    variant: 'default',
    className: 'bg-amber-500 hover:bg-amber-600',
  },
  READY: {
    label: 'Ready',
    icon: IconClock,
    variant: 'secondary',
    className: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
  PROCESSING: {
    label: 'Processing',
    icon: IconLoader2,
    variant: 'secondary',
    className: 'bg-purple-500 hover:bg-purple-600 text-white animate-pulse',
  },
  COMPLETED: {
    label: 'Completed',
    icon: IconCircleCheck,
    variant: 'secondary',
    className: 'bg-green-600 hover:bg-green-700 text-white',
  },
  FAILED: {
    label: 'Failed',
    icon: IconCircleX,
    variant: 'destructive',
    className: '',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: IconX,
    variant: 'outline',
    className: 'text-muted-foreground',
  },
};

// Processing timeout threshold (2 minutes)
const PROCESSING_STUCK_THRESHOLD_MS = 2 * 60 * 1000;

interface ActionCardProps {
  action: KineticAction;
  capability?: Capability;
  onApprove?: (actionId: string, approvedBy: string) => Promise<{ success: boolean; error?: string }>;
  onRun?: (actionId: string) => Promise<{ success: boolean; error?: string; reason?: string }>;
  onCancel?: (actionId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  onRetry?: (actionId: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateInputs?: (actionId: string, inputs: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  onRefresh?: () => Promise<void>;
  compact?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export function ActionCard({
  action,
  capability,
  onApprove,
  onRun,
  onCancel,
  onRetry,
  onUpdateInputs,
  onRefresh,
  compact = false,
  selected = false,
  onSelect,
}: ActionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedInputs, setEditedInputs] = useState<Record<string, unknown>>(action.inputs);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [approvedBy, setApprovedBy] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [operating, setOperating] = useState(false);
  const [inputsExpanded, setInputsExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [errorDetailsExpanded, setErrorDetailsExpanded] = useState(false);
  const [outputsExpanded, setOutputsExpanded] = useState(false);

  // Inline error state for API failures
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Stuck detection state
  const [isStuck, setIsStuck] = useState(false);

  const statusConfig = STATUS_CONFIGS[action.status];
  const StatusIcon = statusConfig.icon;

  // Detect stuck PROCESSING actions
  useEffect(() => {
    if (action.status === 'PROCESSING' && action.started_at) {
      const startedAt = new Date(action.started_at).getTime();
      const now = Date.now();
      const isCurrentlyStuck = (now - startedAt) > PROCESSING_STUCK_THRESHOLD_MS;
      setIsStuck(isCurrentlyStuck);

      // Set up interval to re-check
      const interval = setInterval(() => {
        const nowCheck = Date.now();
        setIsStuck((nowCheck - startedAt) > PROCESSING_STUCK_THRESHOLD_MS);
      }, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    } else {
      setIsStuck(false);
    }
  }, [action.status, action.started_at]);

  // Clear inline error when action updates
  useEffect(() => {
    setInlineError(null);
  }, [action.status, action.updated_at]);

  const handleApprove = async () => {
    if (!onApprove || !approvedBy.trim()) return;
    setOperating(true);
    setInlineError(null);
    try {
      const result = await onApprove(action.action_id, approvedBy.trim());
      if (result.success) {
        setShowApproveDialog(false);
        setApprovedBy('');
        // Trigger refresh to get server truth
        if (onRefresh) await onRefresh();
      } else {
        setInlineError(result.error || 'Failed to approve action');
      }
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : 'Failed to approve action');
    } finally {
      setOperating(false);
    }
  };

  const handleRun = async () => {
    if (!onRun) return;
    setOperating(true);
    setInlineError(null);
    try {
      const result = await onRun(action.action_id);
      if (result.success) {
        // Trigger refresh to get server truth
        if (onRefresh) await onRefresh();
      } else {
        // Handle idempotency - already running/completed
        if (result.reason === 'already_processing' || result.reason === 'already_completed') {
          // Not an error, just info - refresh to sync state
          if (onRefresh) await onRefresh();
        } else {
          setInlineError(result.error || 'Failed to run action');
        }
      }
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : 'Failed to run action');
    } finally {
      setOperating(false);
    }
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    setOperating(true);
    setInlineError(null);
    try {
      const result = await onCancel(action.action_id, cancelReason || undefined);
      if (result.success) {
        setShowCancelDialog(false);
        setCancelReason('');
        if (onRefresh) await onRefresh();
      } else {
        setInlineError(result.error || 'Failed to cancel action');
      }
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : 'Failed to cancel action');
    } finally {
      setOperating(false);
    }
  };

  const handleRetry = async () => {
    if (!onRetry) return;
    setOperating(true);
    setInlineError(null);
    try {
      const result = await onRetry(action.action_id);
      if (result.success) {
        if (onRefresh) await onRefresh();
      } else {
        setInlineError(result.error || 'Failed to retry action');
      }
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : 'Failed to retry action');
    } finally {
      setOperating(false);
    }
  };

  const handleSaveInputs = async () => {
    if (!onUpdateInputs) return;

    // Validate if we have a schema
    if (capability?.input_schema) {
      const { valid, errors } = validateFormValues(editedInputs, capability.input_schema);
      if (!valid) {
        setInlineError('Validation errors: ' + errors.join(', '));
        return;
      }
    }

    setOperating(true);
    setInlineError(null);
    try {
      const result = await onUpdateInputs(action.action_id, editedInputs);
      if (result.success) {
        setIsEditing(false);
        if (onRefresh) await onRefresh();
      } else {
        setInlineError(result.error || 'Failed to update inputs');
      }
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : 'Failed to update inputs');
    } finally {
      setOperating(false);
    }
  };

  const canEdit = action.status === 'PENDING_APPROVAL' && onUpdateInputs;
  const canApprove = action.status === 'PENDING_APPROVAL' && onApprove;
  const canRun = action.status === 'READY' && onRun;
  const canCancel = (action.status === 'PENDING_APPROVAL' || action.status === 'READY') && onCancel;
  const canRetry = action.status === 'FAILED' && action.error?.retryable !== false && onRetry;

  // Compact card for lists
  if (compact) {
    return (
      <div
        className={`flex items-center justify-between rounded-lg border p-3 transition-colors cursor-pointer hover:bg-accent ${
          selected ? 'border-primary bg-accent' : ''
        }`}
        onClick={onSelect}
        data-testid="action-card-compact"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{action.title}</p>
            <Badge
              variant={statusConfig.variant}
              className={`shrink-0 gap-1 ${statusConfig.className}`}
            >
              <StatusIcon className={`h-3 w-3 ${action.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
              {statusConfig.label}
            </Badge>
            {isStuck && (
              <Badge variant="destructive" className="shrink-0 gap-1">
                <IconAlertCircle className="h-3 w-3" />
                Stuck
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span>{action.action_type}</span>
            <span>-</span>
            <Link
              href={`/deals/${action.deal_id}`}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {action.deal_id}
            </Link>
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground shrink-0 ml-4">
          {format(new Date(action.updated_at), 'MMM d, HH:mm')}
        </div>
      </div>
    );
  }

  // Full card with all details
  return (
    <Card className={`transition-all ${selected ? 'ring-2 ring-primary' : ''}`} data-testid="action-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              {action.title}
              <Badge
                variant={statusConfig.variant}
                className={`gap-1 ${statusConfig.className}`}
              >
                <StatusIcon className={`h-3 w-3 ${action.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                {statusConfig.label}
              </Badge>
              {isStuck && (
                <Badge variant="destructive" className="gap-1">
                  <IconAlertCircle className="h-3 w-3" />
                  Stuck
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              <span className="font-mono text-xs">{action.action_type}</span>
              {action.summary && <span className="ml-2">- {action.summary}</span>}
            </CardDescription>
          </div>
          <div className="text-right text-sm text-muted-foreground shrink-0">
            <div>
              <Link
                href={`/deals/${action.deal_id}`}
                className="text-primary hover:underline flex items-center gap-1"
              >
                {action.deal_id}
                <IconExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <div className="text-xs mt-1">
              {format(new Date(action.created_at), 'MMM d, yyyy HH:mm')}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Inline error display */}
        {inlineError && (
          <Alert variant="destructive">
            <IconAlertTriangle className="h-4 w-4" />
            <AlertTitle>Operation Failed</AlertTitle>
            <AlertDescription>{inlineError}</AlertDescription>
          </Alert>
        )}

        {/* Stuck warning */}
        {isStuck && (
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertTitle>Action May Be Stuck</AlertTitle>
            <AlertDescription>
              This action has been processing for over 2 minutes. The executor may be down or hung.
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 ml-2"
                onClick={() => onRefresh?.()}
              >
                Refresh status
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Progress indicator for PROCESSING status */}
        {action.status === 'PROCESSING' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {action.progress_message || 'Processing...'}
              </span>
              {action.progress !== undefined && (
                <span className="font-medium">{Math.round(action.progress)}%</span>
              )}
            </div>
            <Progress
              value={action.progress ?? 33}
              className="h-2"
            />
          </div>
        )}

        {/* Error display for FAILED status */}
        {action.status === 'FAILED' && action.error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <div className="flex items-start gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-destructive">{action.error.message}</p>
                {action.error.code && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Error code: {action.error.code}
                    {action.error.category && ` (${action.error.category})`}
                  </p>
                )}
                {action.error.details && (
                  <Collapsible open={errorDetailsExpanded} onOpenChange={setErrorDetailsExpanded}>
                    {/* FIX: Use asChild to avoid nested button - render as span */}
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-2"
                      >
                        <IconChevronDown className={`h-3 w-3 transition-transform ${errorDetailsExpanded ? 'rotate-180' : ''}`} />
                        Show details
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                        {action.error.details}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Artifacts for COMPLETED status */}
        {action.status === 'COMPLETED' && action.artifacts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <IconDownload className="h-4 w-4" />
              Artifacts ({action.artifacts.length})
            </h4>
            <div className="space-y-2">
              {action.artifacts.map((artifact) => (
                <div
                  key={artifact.artifact_id}
                  className="flex items-center justify-between rounded-lg border p-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{artifact.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {artifact.mime_type} - {formatBytes(artifact.size_bytes)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={artifact.download_url} target="_blank" rel="noopener noreferrer">
                        <IconEye className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={artifact.download_url} download={artifact.filename}>
                        <IconDownload className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inputs section - FIX: Restructured to avoid nested buttons */}
        <Collapsible open={inputsExpanded} onOpenChange={setInputsExpanded}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium hover:text-primary"
              >
                <IconChevronDown className={`h-4 w-4 transition-transform ${inputsExpanded ? 'rotate-180' : ''}`} />
                Inputs
              </button>
            </CollapsibleTrigger>
            {/* Edit button moved OUTSIDE the trigger */}
            {canEdit && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6"
                onClick={() => {
                  setIsEditing(true);
                  setEditedInputs(action.inputs);
                }}
              >
                <IconEdit className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
          <CollapsibleContent className="mt-3">
            {isEditing && capability?.input_schema ? (
              <div className="space-y-4">
                <ActionInputForm
                  schema={capability.input_schema}
                  values={editedInputs}
                  onChange={setEditedInputs}
                  disabled={operating}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveInputs} disabled={operating}>
                    {operating ? (
                      <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <IconCheck className="h-4 w-4 mr-1" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedInputs(action.inputs);
                    }}
                    disabled={operating}
                  >
                    <IconX className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <ActionInputDisplay
                inputs={action.inputs}
                schema={capability?.input_schema}
              />
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Outputs section (for completed actions) - FIX: Use asChild */}
        {action.outputs && Object.keys(action.outputs).length > 0 && (
          <Collapsible open={outputsExpanded} onOpenChange={setOutputsExpanded}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium hover:text-primary"
              >
                <IconChevronDown className={`h-4 w-4 transition-transform ${outputsExpanded ? 'rotate-180' : ''}`} />
                Outputs
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                {JSON.stringify(action.outputs, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Audit trail / Details - FIX: Use asChild */}
        <Collapsible open={detailsExpanded} onOpenChange={setDetailsExpanded}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium hover:text-primary"
            >
              <IconChevronDown className={`h-4 w-4 transition-transform ${detailsExpanded ? 'rotate-180' : ''}`} />
              Audit Trail
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Action ID:</span>
                <span className="font-mono text-xs">{action.action_id}</span>
              </div>
              {action.created_by && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created by:</span>
                  <span>{action.created_by}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{format(new Date(action.created_at), 'MMM d, yyyy HH:mm:ss')}</span>
              </div>
              {action.approved_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approved:</span>
                  <span>
                    {format(new Date(action.approved_at), 'MMM d, yyyy HH:mm:ss')}
                    {action.approved_by && ` by ${action.approved_by}`}
                  </span>
                </div>
              )}
              {action.started_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started:</span>
                  <span>{format(new Date(action.started_at), 'MMM d, yyyy HH:mm:ss')}</span>
                </div>
              )}
              {action.completed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed:</span>
                  <span>{format(new Date(action.completed_at), 'MMM d, yyyy HH:mm:ss')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retries:</span>
                <span>{action.retry_count} / {action.max_retries}</span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {/* Action buttons */}
      {(canApprove || canRun || canCancel || canRetry) && (
        <CardFooter className="flex gap-2 pt-4 border-t">
          {canApprove && (
            <Button
              size="sm"
              onClick={() => setShowApproveDialog(true)}
              disabled={operating}
              data-testid="action-approve-btn"
            >
              {operating ? (
                <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <IconShieldCheck className="h-4 w-4 mr-1" />
              )}
              Approve
            </Button>
          )}
          {canRun && (
            <Button
              size="sm"
              onClick={handleRun}
              disabled={operating}
              data-testid="action-run-btn"
            >
              {operating ? (
                <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <IconPlayerPlay className="h-4 w-4 mr-1" />
              )}
              Run
            </Button>
          )}
          {canRetry && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRetry}
              disabled={operating}
              data-testid="action-retry-btn"
            >
              {operating ? (
                <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <IconRefresh className="h-4 w-4 mr-1" />
              )}
              Retry
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
              disabled={operating}
              data-testid="action-cancel-btn"
            >
              <IconPlayerStop className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
        </CardFooter>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Action</DialogTitle>
            <DialogDescription>
              Review and approve this action to proceed with execution.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <p className="text-sm font-medium">{action.title}</p>
              <p className="text-xs text-muted-foreground">{action.action_type}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approved-by">Your Name / ID</Label>
              <Input
                id="approved-by"
                placeholder="Enter your name or ID"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={!approvedBy.trim() || operating}>
              {operating ? (
                <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <IconShieldCheck className="h-4 w-4 mr-1" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Action</DialogTitle>
            <DialogDescription>
              This will cancel the action. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <p className="text-sm font-medium">{action.title}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Why is this action being cancelled?"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Go Back
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={operating}>
              {operating ? (
                <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <IconPlayerStop className="h-4 w-4 mr-1" />
              )}
              Cancel Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
