/**
 * DiligenceProgress Component
 *
 * Visual progress indicator for due diligence completion.
 * Shows overall progress, status breakdown, and timeline.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  IconCheck,
  IconClock,
  IconLoader2,
  IconX,
  IconMinus,
  IconAlertTriangle,
  IconCalendarEvent,
} from '@tabler/icons-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DiligenceItemData, DiligenceItemStatus } from './DiligenceItem';

// =============================================================================
// Types
// =============================================================================

interface DiligenceProgressProps {
  items: DiligenceItemData[];
  targetDate?: Date;
  variant?: 'compact' | 'detailed';
  className?: string;
}

interface StatusCount {
  status: DiligenceItemStatus;
  count: number;
  label: string;
  icon: React.ElementType;
  color: string;
}

// =============================================================================
// Helpers
// =============================================================================

function calculateProgress(items: DiligenceItemData[]) {
  const activeItems = items.filter((i) => i.status !== 'na');
  const total = activeItems.length;
  const completed = activeItems.filter((i) => i.status === 'complete').length;
  const blocked = activeItems.filter((i) => i.status === 'blocked').length;
  const inProgress = activeItems.filter((i) => i.status === 'in_progress').length;
  const pending = activeItems.filter((i) => i.status === 'pending').length;
  const na = items.filter((i) => i.status === 'na').length;

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Calculate overdue items
  const now = new Date();
  const overdue = items.filter(
    (i) =>
      i.dueDate &&
      i.dueDate < now &&
      i.status !== 'complete' &&
      i.status !== 'na'
  ).length;

  return {
    total,
    completed,
    blocked,
    inProgress,
    pending,
    na,
    percentage,
    overdue,
  };
}

function getStatusCounts(items: DiligenceItemData[]): StatusCount[] {
  const stats = calculateProgress(items);

  const allCounts: StatusCount[] = [
    {
      status: 'complete' as DiligenceItemStatus,
      count: stats.completed,
      label: 'Complete',
      icon: IconCheck,
      color: 'text-green-500',
    },
    {
      status: 'in_progress' as DiligenceItemStatus,
      count: stats.inProgress,
      label: 'In Progress',
      icon: IconLoader2,
      color: 'text-blue-500',
    },
    {
      status: 'pending' as DiligenceItemStatus,
      count: stats.pending,
      label: 'Pending',
      icon: IconClock,
      color: 'text-muted-foreground',
    },
    {
      status: 'blocked' as DiligenceItemStatus,
      count: stats.blocked,
      label: 'Blocked',
      icon: IconX,
      color: 'text-red-500',
    },
    {
      status: 'na' as DiligenceItemStatus,
      count: stats.na,
      label: 'N/A',
      icon: IconMinus,
      color: 'text-muted-foreground',
    },
  ];
  return allCounts.filter((s) => s.count > 0);
}

// =============================================================================
// Component
// =============================================================================

export function DiligenceProgress({
  items,
  targetDate,
  variant = 'detailed',
  className,
}: DiligenceProgressProps) {
  const stats = calculateProgress(items);
  const statusCounts = getStatusCounts(items);

  const daysRemaining = targetDate
    ? differenceInDays(targetDate, new Date())
    : null;

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Progress value={stats.percentage} className="h-2 flex-1" />
        <span className="text-sm font-medium">
          {stats.percentage}%
        </span>
        {stats.overdue > 0 && (
          <Badge variant="destructive" className="text-xs">
            {stats.overdue} overdue
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Diligence Progress</CardTitle>
          {targetDate && (
            <div className="flex items-center gap-2 text-sm">
              <IconCalendarEvent className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Target:</span>
              <span className="font-medium">
                {format(targetDate, 'MMM d, yyyy')}
              </span>
              {daysRemaining !== null && (
                <Badge
                  variant={daysRemaining < 7 ? 'destructive' : 'outline'}
                  className="text-xs"
                >
                  {daysRemaining < 0
                    ? `${Math.abs(daysRemaining)}d overdue`
                    : daysRemaining === 0
                    ? 'Due today'
                    : `${daysRemaining}d left`}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Completion</span>
            <span className="font-medium">
              {stats.completed} of {stats.total} items ({stats.percentage}%)
            </span>
          </div>
          <Progress value={stats.percentage} className="h-3" />
        </div>

        {/* Alerts */}
        {(stats.overdue > 0 || stats.blocked > 0) && (
          <div className="flex gap-2">
            {stats.overdue > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-600 text-sm">
                <IconAlertTriangle className="w-4 h-4" />
                <span>
                  {stats.overdue} item{stats.overdue !== 1 ? 's' : ''} overdue
                </span>
              </div>
            )}
            {stats.blocked > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 text-sm">
                <IconX className="w-4 h-4" />
                <span>
                  {stats.blocked} item{stats.blocked !== 1 ? 's' : ''} blocked
                </span>
              </div>
            )}
          </div>
        )}

        {/* Status breakdown */}
        <div className="grid grid-cols-5 gap-2">
          {statusCounts.map((status) => {
            const Icon = status.icon;
            return (
              <div
                key={status.status}
                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50"
              >
                <Icon
                  className={cn(
                    'w-4 h-4',
                    status.color,
                    status.status === 'in_progress' && 'animate-spin'
                  )}
                />
                <span className="text-lg font-semibold">{status.count}</span>
                <span className="text-xs text-muted-foreground">
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Category progress (if needed, can be expanded) */}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Progress Ring (Alternative Display)
// =============================================================================

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ProgressRing({
  percentage,
  size = 80,
  strokeWidth = 8,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('relative inline-flex', className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold">{percentage}%</span>
      </div>
    </div>
  );
}

export default DiligenceProgress;
