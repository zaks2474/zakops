/**
 * DiligenceItem Component
 *
 * Individual due diligence checklist item with:
 * - Status indicator (pending, in_progress, complete, blocked, na)
 * - Due date tracking
 * - Assignment
 * - Notes/comments
 * - Document attachment indicator
 */

'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import {
  IconCalendar,
  IconUser,
  IconPaperclip,
  IconMessageCircle,
  IconAlertTriangle,
  IconClock,
  IconCheck,
  IconX,
  IconMinus,
  IconLoader2,
} from '@tabler/icons-react';
import { format, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type DiligenceItemStatus =
  | 'pending'
  | 'in_progress'
  | 'complete'
  | 'blocked'
  | 'na';

export interface DiligenceItemData {
  id: string;
  title: string;
  description?: string;
  status: DiligenceItemStatus;
  category: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: Date;
  assignee?: string;
  documentCount?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DiligenceItemProps {
  item: DiligenceItemData;
  onStatusChange?: (id: string, status: DiligenceItemStatus) => void;
  onNotesChange?: (id: string, notes: string) => void;
  onAssign?: (id: string) => void;
  onViewDocuments?: (id: string) => void;
  isUpdating?: boolean;
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getStatusConfig(status: DiligenceItemStatus) {
  const configs = {
    pending: {
      icon: IconClock,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      label: 'Pending',
    },
    in_progress: {
      icon: IconLoader2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      label: 'In Progress',
    },
    complete: {
      icon: IconCheck,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      label: 'Complete',
    },
    blocked: {
      icon: IconX,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      label: 'Blocked',
    },
    na: {
      icon: IconMinus,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      label: 'N/A',
    },
  };
  return configs[status];
}

function getDueDateInfo(dueDate: Date) {
  if (isPast(dueDate) && !isToday(dueDate)) {
    const days = differenceInDays(new Date(), dueDate);
    return {
      label: `${days}d overdue`,
      color: 'text-red-500',
      urgent: true,
    };
  }
  if (isToday(dueDate)) {
    return {
      label: 'Due today',
      color: 'text-amber-500',
      urgent: true,
    };
  }
  if (isTomorrow(dueDate)) {
    return {
      label: 'Due tomorrow',
      color: 'text-amber-500',
      urgent: false,
    };
  }
  const days = differenceInDays(dueDate, new Date());
  if (days <= 7) {
    return {
      label: `${days}d left`,
      color: 'text-muted-foreground',
      urgent: false,
    };
  }
  return {
    label: format(dueDate, 'MMM d'),
    color: 'text-muted-foreground',
    urgent: false,
  };
}

// =============================================================================
// Component
// =============================================================================

export function DiligenceItem({
  item,
  onStatusChange,
  onNotesChange,
  onAssign,
  onViewDocuments,
  isUpdating = false,
  className,
}: DiligenceItemProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState(item.notes || '');

  const statusConfig = getStatusConfig(item.status);
  const StatusIcon = statusConfig.icon;
  const dueDateInfo = item.dueDate ? getDueDateInfo(item.dueDate) : null;

  const isComplete = item.status === 'complete' || item.status === 'na';

  const handleCheckboxChange = (checked: boolean) => {
    if (onStatusChange) {
      onStatusChange(item.id, checked ? 'complete' : 'pending');
    }
  };

  const handleSaveNotes = () => {
    if (onNotesChange) {
      onNotesChange(item.id, localNotes);
    }
    setNotesOpen(false);
  };

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border transition-colors',
        isComplete && 'opacity-60',
        item.status === 'blocked' && 'border-red-500/30 bg-red-500/5',
        dueDateInfo?.urgent && item.status === 'pending' && 'border-amber-500/30 bg-amber-500/5',
        className
      )}
    >
      {/* Checkbox */}
      <div className="pt-0.5">
        <Checkbox
          checked={isComplete}
          onCheckedChange={handleCheckboxChange}
          disabled={isUpdating || item.status === 'blocked'}
          className={cn(
            isComplete && 'bg-green-500 border-green-500'
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'font-medium text-sm',
                isComplete && 'line-through text-muted-foreground'
              )}
            >
              {item.title}
            </p>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {item.description}
              </p>
            )}
          </div>

          {/* Priority badge */}
          {item.priority === 'high' && (
            <Badge variant="destructive" className="shrink-0 text-xs">
              High
            </Badge>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2 text-xs">
          {/* Status */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-1 cursor-default',
                    statusConfig.bgColor,
                    statusConfig.color
                  )}
                >
                  <StatusIcon
                    className={cn(
                      'w-3 h-3',
                      item.status === 'in_progress' && 'animate-spin'
                    )}
                  />
                  {statusConfig.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to change status</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Due date */}
          {dueDateInfo && (
            <span
              className={cn(
                'flex items-center gap-1',
                dueDateInfo.color
              )}
            >
              <IconCalendar className="w-3 h-3" />
              {dueDateInfo.label}
              {dueDateInfo.urgent && item.status === 'pending' && (
                <IconAlertTriangle className="w-3 h-3 text-amber-500" />
              )}
            </span>
          )}

          {/* Assignee */}
          {item.assignee ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <IconUser className="w-3 h-3" />
              {item.assignee}
            </span>
          ) : onAssign ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onAssign(item.id)}
            >
              <IconUser className="w-3 h-3 mr-1" />
              Assign
            </Button>
          ) : null}

          {/* Documents */}
          {item.documentCount && item.documentCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onViewDocuments?.(item.id)}
            >
              <IconPaperclip className="w-3 h-3 mr-1" />
              {item.documentCount}
            </Button>
          )}

          {/* Notes */}
          <Popover open={notesOpen} onOpenChange={setNotesOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-5 px-1 text-xs',
                  item.notes
                    ? 'text-blue-500 hover:text-blue-600'
                    : 'text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100'
                )}
              >
                <IconMessageCircle className="w-3 h-3" />
                {item.notes && <span className="ml-1">Note</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-2">
                <p className="text-sm font-medium">Notes</p>
                <Textarea
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  placeholder="Add notes..."
                  className="min-h-[80px] text-sm"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNotesOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveNotes}>
                    Save
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Loading indicator */}
      {isUpdating && (
        <IconLoader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

export default DiligenceItem;
