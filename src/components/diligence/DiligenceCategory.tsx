/**
 * DiligenceCategory Component
 *
 * Collapsible category grouping for diligence items.
 * Shows category progress and item list.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconFolderOpen,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import {
  DiligenceItem,
  DiligenceItemData,
  DiligenceItemStatus,
} from './DiligenceItem';

// =============================================================================
// Types
// =============================================================================

export interface DiligenceCategoryData {
  id: string;
  name: string;
  description?: string;
  icon?: React.ElementType;
  items: DiligenceItemData[];
  order: number;
}

interface DiligenceCategoryProps {
  category: DiligenceCategoryData;
  onItemStatusChange?: (itemId: string, status: DiligenceItemStatus) => void;
  onItemNotesChange?: (itemId: string, notes: string) => void;
  onItemAssign?: (itemId: string) => void;
  onViewDocuments?: (itemId: string) => void;
  updatingItems?: Set<string>;
  defaultOpen?: boolean;
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getCategoryProgress(items: DiligenceItemData[]) {
  const total = items.filter((i) => i.status !== 'na').length;
  const completed = items.filter((i) => i.status === 'complete').length;
  const blocked = items.filter((i) => i.status === 'blocked').length;
  const inProgress = items.filter((i) => i.status === 'in_progress').length;
  const pending = items.filter((i) => i.status === 'pending').length;

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, blocked, inProgress, pending, percentage };
}

// =============================================================================
// Component
// =============================================================================

export function DiligenceCategory({
  category,
  onItemStatusChange,
  onItemNotesChange,
  onItemAssign,
  onViewDocuments,
  updatingItems = new Set(),
  defaultOpen = true,
  className,
}: DiligenceCategoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const progress = getCategoryProgress(category.items);
  const Icon = category.icon || (isOpen ? IconFolderOpen : IconFolder);

  // Sort items: blocked first, then by priority, then pending, in_progress, complete
  const sortedItems = [...category.items].sort((a, b) => {
    // Blocked items first
    if (a.status === 'blocked' && b.status !== 'blocked') return -1;
    if (b.status === 'blocked' && a.status !== 'blocked') return 1;

    // Then by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }

    // Then by status
    const statusOrder = {
      in_progress: 0,
      pending: 1,
      complete: 2,
      na: 3,
      blocked: 0,
    };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('border rounded-lg', className)}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-4 h-auto hover:bg-accent/50"
        >
          <div className="flex items-center gap-3">
            {isOpen ? (
              <IconChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <IconChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <Icon className="w-5 h-5 text-primary" />
            <div className="text-left">
              <p className="font-medium">{category.name}</p>
              {category.description && (
                <p className="text-xs text-muted-foreground">
                  {category.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status badges */}
            <div className="flex items-center gap-1.5">
              {progress.blocked > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {progress.blocked} blocked
                </Badge>
              )}
              {progress.inProgress > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20"
                >
                  {progress.inProgress} active
                </Badge>
              )}
            </div>

            {/* Progress */}
            <div className="flex items-center gap-2 w-32">
              <Progress value={progress.percentage} className="h-2" />
              <span className="text-xs text-muted-foreground w-10 text-right">
                {progress.completed}/{progress.total}
              </span>
            </div>
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-4 pt-0 space-y-2">
          {sortedItems.map((item) => (
            <DiligenceItem
              key={item.id}
              item={item}
              onStatusChange={onItemStatusChange}
              onNotesChange={onItemNotesChange}
              onAssign={onItemAssign}
              onViewDocuments={onViewDocuments}
              isUpdating={updatingItems.has(item.id)}
            />
          ))}

          {category.items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No items in this category
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default DiligenceCategory;
