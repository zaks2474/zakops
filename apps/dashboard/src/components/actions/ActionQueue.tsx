'use client';

/**
 * ActionQueue - Pending action approval queue
 * Phase 19: Dashboard Foundation
 */

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Check,
  X,
  Loader2,
  AlertCircle,
  Clock,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { usePendingActions, useApproveAction, useRejectAction } from '@/lib/api-client';
import type { Action, RiskLevel } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

function getRiskBadgeVariant(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getRiskIcon(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case 'high':
      return <AlertCircle className="h-4 w-4" />;
    case 'medium':
      return <AlertTriangle className="h-4 w-4" />;
    case 'low':
      return <Shield className="h-4 w-4" />;
    default:
      return null;
  }
}

interface ActionItemProps {
  action: Action;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string, reason: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function ActionItem({
  action,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: ActionItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = () => {
    onApprove(action.action_id);
  };

  const handleReject = () => {
    if (rejectReason.trim()) {
      onReject(action.action_id, rejectReason);
      setRejectReason('');
      setShowRejectForm(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm">{action.title}</h4>
            <Badge variant={getRiskBadgeVariant(action.risk_level)} className="gap-1">
              {getRiskIcon(action.risk_level)}
              {action.risk_level}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {action.action_type}
            </Badge>
          </div>

          {action.summary && (
            <p className="text-sm text-muted-foreground mt-1">{action.summary}</p>
          )}

          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
              </span>
            </div>
            {action.deal_name && <span>Deal: {action.deal_name}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
          >
            {isApproving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Approve
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowRejectForm(!showRejectForm)}
            disabled={isApproving || isRejecting}
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
        </div>
      </div>

      {showRejectForm && (
        <div className="mt-4 space-y-2 border-t pt-4">
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowRejectForm(false);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || isRejecting}
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Confirm Rejection
            </Button>
          </div>
        </div>
      )}

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="mt-2 text-xs">
            {isOpen ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show Details
              </>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="bg-muted/50 rounded-md p-3 text-xs">
            <div className="font-medium mb-2">Input Parameters:</div>
            <pre className="overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(action.inputs, null, 2)}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function ActionQueue() {
  const {
    data: actions,
    isLoading,
    error,
    refetch,
  } = usePendingActions();

  const approveMutation = useApproveAction();
  const rejectMutation = useRejectAction();

  const handleApprove = async (actionId: string) => {
    try {
      await approveMutation.mutateAsync({ actionId });
    } catch (error) {
      console.error('Failed to approve action:', error);
    }
  };

  const handleReject = async (actionId: string, reason: string) => {
    try {
      await rejectMutation.mutateAsync({
        actionId,
        data: { reason },
      });
    } catch (error) {
      console.error('Failed to reject action:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load actions: {error.message}</span>
          </div>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Action Queue</CardTitle>
            <CardDescription>
              Review and approve pending actions
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-lg px-3 py-1">
            {actions?.length || 0} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!actions || actions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Check className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No pending actions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {actions.map((action) => (
              <ActionItem
                key={action.action_id}
                action={action}
                onApprove={handleApprove}
                onReject={handleReject}
                isApproving={
                  approveMutation.isPending &&
                  approveMutation.variables?.actionId === action.action_id
                }
                isRejecting={
                  rejectMutation.isPending &&
                  rejectMutation.variables?.actionId === action.action_id
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActionQueue;
