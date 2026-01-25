/**
 * ApprovalBadge Component
 *
 * Badge showing pending approval count.
 * Used in navigation, headers, and buttons.
 */

'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IconShieldCheck, IconAlertTriangle } from '@tabler/icons-react';
import { useApprovalFlow } from '@/components/agent/hooks/useApprovalFlow';
import { getToolDefinition } from '@/lib/agent/toolRegistry';
import { useRenderTracking } from '@/hooks/use-render-tracking';

// =============================================================================
// Types
// =============================================================================

interface ApprovalBadgeProps {
  variant?: 'count' | 'icon' | 'full';
  showTooltip?: boolean;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ApprovalBadge({
  variant = 'count',
  showTooltip = true,
  className = '',
}: ApprovalBadgeProps) {
  // Track renders in development
  useRenderTracking('ApprovalBadge');

  const { pendingApprovals, isLoading } = useApprovalFlow();

  const count = pendingApprovals.length;

  // Count critical approvals
  const criticalCount = pendingApprovals.filter((a) => {
    const toolDef = getToolDefinition(a.tool_name);
    return toolDef?.riskLevel === 'critical' || toolDef?.riskLevel === 'high';
  }).length;

  if (count === 0) {
    return null;
  }

  const badge = (
    <Badge
      variant={criticalCount > 0 ? 'destructive' : 'default'}
      className={`gap-1 ${criticalCount > 0 ? 'bg-amber-500 hover:bg-amber-600' : ''} ${className}`}
    >
      {variant === 'icon' && <IconShieldCheck className="w-3 h-3" />}
      {variant === 'full' && <IconShieldCheck className="w-3 h-3" />}
      {(variant === 'count' || variant === 'full') && count}
      {variant === 'full' && <span className="ml-1">pending</span>}
      {criticalCount > 0 && variant !== 'icon' && (
        <IconAlertTriangle className="w-3 h-3 ml-0.5" />
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>
            {count} pending approval{count !== 1 ? 's' : ''}
            {criticalCount > 0 && ` (${criticalCount} high priority)`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Notification Dot (for nav items)
// =============================================================================

interface ApprovalDotProps {
  className?: string;
}

export function ApprovalDot({ className = '' }: ApprovalDotProps) {
  const { pendingApprovals } = useApprovalFlow();

  if (pendingApprovals.length === 0) {
    return null;
  }

  const hasCritical = pendingApprovals.some((a) => {
    const toolDef = getToolDefinition(a.tool_name);
    return toolDef?.riskLevel === 'critical' || toolDef?.riskLevel === 'high';
  });

  return (
    <span
      className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
        hasCritical ? 'bg-red-500' : 'bg-amber-500'
      } ${hasCritical ? 'animate-pulse' : ''} ${className}`}
    />
  );
}

export default ApprovalBadge;
