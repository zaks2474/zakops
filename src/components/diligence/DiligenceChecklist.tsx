/**
 * DiligenceChecklist Component
 *
 * Main due diligence checklist interface.
 * Features:
 * - Category-based organization
 * - Progress tracking
 * - Filtering and search
 * - Template support
 * - Export capabilities
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  IconSearch,
  IconFilter,
  IconPlus,
  IconDownload,
  IconRefresh,
  IconDotsVertical,
  IconTemplate,
  IconListCheck,
  IconAlertTriangle,
  IconClock,
  IconCheck,
  IconClipboardList,
  IconFileText,
  IconScale,
  IconBuildingBank,
  IconUsers,
  IconShieldCheck,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import {
  DiligenceCategory,
  DiligenceCategoryData,
} from './DiligenceCategory';
import { DiligenceProgress, ProgressRing } from './DiligenceProgress';
import type { DiligenceItemData, DiligenceItemStatus } from './DiligenceItem';

// =============================================================================
// Types
// =============================================================================

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'blocked' | 'complete';
type FilterPriority = 'all' | 'high' | 'medium' | 'low';

interface DiligenceChecklistProps {
  dealId: string;
  dealName?: string;
  categories?: DiligenceCategoryData[];
  targetDate?: Date;
  onItemStatusChange?: (itemId: string, status: DiligenceItemStatus) => Promise<void>;
  onItemNotesChange?: (itemId: string, notes: string) => Promise<void>;
  onItemAssign?: (itemId: string) => void;
  onViewDocuments?: (itemId: string) => void;
  onAddItem?: (categoryId: string) => void;
  onApplyTemplate?: (templateId: string) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

// =============================================================================
// Default Categories Template
// =============================================================================

const DEFAULT_CATEGORY_ICONS: Record<string, React.ElementType> = {
  financial: IconBuildingBank,
  legal: IconScale,
  operational: IconClipboardList,
  hr: IconUsers,
  compliance: IconShieldCheck,
  documents: IconFileText,
};

// =============================================================================
// Component
// =============================================================================

export function DiligenceChecklist({
  dealId,
  dealName,
  categories = [],
  targetDate,
  onItemStatusChange,
  onItemNotesChange,
  onItemAssign,
  onViewDocuments,
  onAddItem,
  onApplyTemplate,
  onExport,
  onRefresh,
  isLoading = false,
  className,
}: DiligenceChecklistProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  // Flatten all items for filtering and stats
  const allItems = useMemo(() => {
    return categories.flatMap((c) => c.items);
  }, [categories]);

  // Filter categories and items
  const filteredCategories = useMemo(() => {
    return categories
      .map((category) => ({
        ...category,
        icon: category.icon || DEFAULT_CATEGORY_ICONS[category.id],
        items: category.items.filter((item) => {
          // Search filter
          if (search) {
            const searchLower = search.toLowerCase();
            const matchesTitle = item.title.toLowerCase().includes(searchLower);
            const matchesDesc = item.description?.toLowerCase().includes(searchLower);
            if (!matchesTitle && !matchesDesc) return false;
          }

          // Status filter
          if (filterStatus !== 'all' && item.status !== filterStatus) {
            return false;
          }

          // Priority filter
          if (filterPriority !== 'all' && item.priority !== filterPriority) {
            return false;
          }

          return true;
        }),
      }))
      .filter((category) => category.items.length > 0 || !search);
  }, [categories, search, filterStatus, filterPriority]);

  // Handle status change with loading state
  const handleStatusChange = useCallback(
    async (itemId: string, status: DiligenceItemStatus) => {
      if (!onItemStatusChange) return;

      setUpdatingItems((prev) => new Set(prev).add(itemId));
      try {
        await onItemStatusChange(itemId, status);
      } finally {
        setUpdatingItems((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    },
    [onItemStatusChange]
  );

  // Handle notes change with loading state
  const handleNotesChange = useCallback(
    async (itemId: string, notes: string) => {
      if (!onItemNotesChange) return;

      setUpdatingItems((prev) => new Set(prev).add(itemId));
      try {
        await onItemNotesChange(itemId, notes);
      } finally {
        setUpdatingItems((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    },
    [onItemNotesChange]
  );

  // Calculate quick stats
  const stats = useMemo(() => {
    const activeItems = allItems.filter((i) => i.status !== 'na');
    const total = activeItems.length;
    const completed = activeItems.filter((i) => i.status === 'complete').length;
    const blocked = activeItems.filter((i) => i.status === 'blocked').length;
    const overdue = activeItems.filter(
      (i) =>
        i.dueDate &&
        i.dueDate < new Date() &&
        i.status !== 'complete'
    ).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, blocked, overdue, percentage };
  }, [allItems]);

  const hasActiveFilters = search || filterStatus !== 'all' || filterPriority !== 'all';

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-4 shrink-0 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconListCheck className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Due Diligence Checklist</CardTitle>
              {dealName && (
                <p className="text-sm text-muted-foreground">{dealName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Progress ring */}
            <ProgressRing percentage={stats.percentage} size={48} strokeWidth={5} />

            {/* Quick stats */}
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted/50">
              <div className="flex items-center gap-1 text-sm">
                <IconCheck className="w-4 h-4 text-green-500" />
                <span className="font-medium">{stats.completed}</span>
                <span className="text-muted-foreground">/ {stats.total}</span>
              </div>
              {stats.blocked > 0 && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1 text-sm text-red-500">
                    <IconAlertTriangle className="w-4 h-4" />
                    <span>{stats.blocked}</span>
                  </div>
                </>
              )}
              {stats.overdue > 0 && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1 text-sm text-amber-500">
                    <IconClock className="w-4 h-4" />
                    <span>{stats.overdue}</span>
                  </div>
                </>
              )}
            </div>

            {/* Actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <IconDotsVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onApplyTemplate && (
                  <DropdownMenuItem onClick={() => onApplyTemplate('default')}>
                    <IconTemplate className="w-4 h-4 mr-2" />
                    Apply Template
                  </DropdownMenuItem>
                )}
                {onExport && (
                  <DropdownMenuItem onClick={onExport}>
                    <IconDownload className="w-4 h-4 mr-2" />
                    Export Checklist
                  </DropdownMenuItem>
                )}
                {onRefresh && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onRefresh}>
                      <IconRefresh className="w-4 h-4 mr-2" />
                      Refresh
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="pl-9 h-9"
            />
          </div>

          {/* Status filter */}
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as FilterStatus)}
          >
            <SelectTrigger className="w-32 h-9">
              <IconFilter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>

          {/* Priority filter */}
          <Select
            value={filterPriority}
            onValueChange={(v) => setFilterPriority(v as FilterPriority)}
          >
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setFilterStatus('all');
                setFilterPriority('all');
              }}
              className="text-muted-foreground"
            >
              Clear filters
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {/* Empty state */}
            {categories.length === 0 && (
              <div className="text-center py-12">
                <IconListCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium mb-2">No checklist items</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Get started by applying a template or adding items manually.
                </p>
                <div className="flex items-center justify-center gap-2">
                  {onApplyTemplate && (
                    <Button onClick={() => onApplyTemplate('default')}>
                      <IconTemplate className="w-4 h-4 mr-2" />
                      Apply Template
                    </Button>
                  )}
                  {onAddItem && (
                    <Button variant="outline" onClick={() => onAddItem('')}>
                      <IconPlus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* No results state */}
            {categories.length > 0 && filteredCategories.length === 0 && (
              <div className="text-center py-12">
                <IconSearch className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium mb-2">No matching items</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search or filters.
                </p>
              </div>
            )}

            {/* Categories */}
            {filteredCategories.map((category) => (
              <DiligenceCategory
                key={category.id}
                category={category}
                onItemStatusChange={handleStatusChange}
                onItemNotesChange={handleNotesChange}
                onItemAssign={onItemAssign}
                onViewDocuments={onViewDocuments}
                updatingItems={updatingItems}
                defaultOpen={!hasActiveFilters || category.items.some(
                  (i) => i.status === 'blocked' || i.priority === 'high'
                )}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Diligence Checklist Compact (for sidebar/overview)
// =============================================================================

interface DiligenceChecklistCompactProps {
  items: DiligenceItemData[];
  targetDate?: Date;
  onViewAll?: () => void;
  className?: string;
}

export function DiligenceChecklistCompact({
  items,
  targetDate,
  onViewAll,
  className,
}: DiligenceChecklistCompactProps) {
  const stats = useMemo(() => {
    const activeItems = items.filter((i) => i.status !== 'na');
    const total = activeItems.length;
    const completed = activeItems.filter((i) => i.status === 'complete').length;
    const blocked = activeItems.filter((i) => i.status === 'blocked').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, blocked, percentage };
  }, [items]);

  // Get top priority items
  const priorityItems = useMemo(() => {
    return items
      .filter((i) => i.status !== 'complete' && i.status !== 'na')
      .sort((a, b) => {
        if (a.status === 'blocked' && b.status !== 'blocked') return -1;
        if (b.status === 'blocked' && a.status !== 'blocked') return 1;
        const priority = { high: 0, medium: 1, low: 2 };
        return priority[a.priority] - priority[b.priority];
      })
      .slice(0, 3);
  }, [items]);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconListCheck className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">Diligence Progress</CardTitle>
          </div>
          <Badge variant={stats.percentage === 100 ? 'default' : 'outline'}>
            {stats.percentage}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <DiligenceProgress items={items} variant="compact" />

        {/* Priority items */}
        {priorityItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              Priority Items
            </p>
            {priorityItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-2 p-2 rounded text-sm',
                  item.status === 'blocked' && 'bg-red-500/10',
                  item.priority === 'high' && item.status !== 'blocked' && 'bg-amber-500/10'
                )}
              >
                {item.status === 'blocked' ? (
                  <IconAlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                ) : item.priority === 'high' ? (
                  <IconClock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  <IconClock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="truncate">{item.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* View all button */}
        {onViewAll && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onViewAll}
          >
            View Full Checklist
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default DiligenceChecklist;
