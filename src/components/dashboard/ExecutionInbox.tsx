/**
 * ExecutionInbox Component
 *
 * Unified inbox for all actionable items:
 * - Pending approvals
 * - Ready actions
 * - Failed actions needing attention
 * - Quarantine items
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IconInbox,
  IconShieldCheck,
  IconPlayerPlay,
  IconAlertTriangle,
  IconFilter,
  IconCheck,
  IconX,
  IconLoader2,
  IconClock,
  IconRefresh,
} from '@tabler/icons-react';
import { formatDistanceToNow, isValid } from 'date-fns';
import type { Action, QuarantineItem, ActionStatus } from '@/types/api';
import { getItemHref } from '@/lib/routes';
import { useRenderTracking } from '@/hooks/use-render-tracking';

// Helper to safely parse dates
function safeParseDate(dateValue: string | Date | null | undefined): Date | null {
  if (!dateValue) return null;
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return isValid(date) ? date : null;
}

// Helper to format time safely
function formatTimeSafe(date: Date | null): string {
  if (!date || !isValid(date)) return 'Unknown';
  return formatDistanceToNow(date, { addSuffix: true });
}

// =============================================================================
// Types
// =============================================================================

type InboxTab = 'all' | 'approvals' | 'ready' | 'failed' | 'quarantine';
type SortBy = 'time' | 'priority';

interface InboxItem {
  id: string;
  type: 'approval' | 'ready' | 'failed' | 'quarantine';
  title: string;
  subtitle?: string;
  priority: 'high' | 'medium' | 'low';
  time: Date | null;
  href: string;
  data: Action | QuarantineItem;
}

interface ExecutionInboxProps {
  actions?: Action[];
  quarantineItems?: QuarantineItem[];
  onApprove?: (actionId: string) => Promise<void>;
  onRun?: (actionId: string) => Promise<void>;
  onRetry?: (actionId: string) => Promise<void>;
  onRefresh?: () => void;
  isLoading?: boolean;
  maxHeight?: string;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ExecutionInbox({
  actions = [],
  quarantineItems = [],
  onApprove,
  onRun,
  onRetry,
  onRefresh,
  isLoading = false,
  maxHeight = 'calc(100vh - 16rem)',
  className = '',
}: ExecutionInboxProps) {
  // Track renders in development
  useRenderTracking('ExecutionInbox');

  const [activeTab, setActiveTab] = useState<InboxTab>('all');
  const [sortBy, setSortBy] = useState<SortBy>('time');

  // Build inbox items
  const items = useMemo(() => {
    const result: InboxItem[] = [];

    for (const action of actions) {
      let type: InboxItem['type'] | null = null;

      if (action.status === 'PENDING_APPROVAL') {
        type = 'approval';
      } else if (action.status === 'READY') {
        type = 'ready';
      } else if (action.status === 'FAILED') {
        type = 'failed';
      }

      if (type) {
        result.push({
          id: action.action_id,
          type,
          title: action.title,
          subtitle: action.deal_name || action.action_type,
          priority: action.risk_level === 'high' ? 'high' : action.risk_level === 'medium' ? 'medium' : 'low',
          time: safeParseDate(action.updated_at),
          href: getItemHref('action', action.action_id),
          data: action,
        });
      }
    }

    for (const item of quarantineItems) {
      result.push({
        id: item.id,
        type: 'quarantine',
        title: item.company_name || item.email_subject || 'Unknown',
        subtitle: item.sender || undefined,
        priority: item.urgency === 'HIGH' ? 'high' : item.urgency === 'MEDIUM' ? 'medium' : 'low',
        time: safeParseDate(item.created_at),
        href: getItemHref('quarantine', item.id),
        data: item,
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      // Handle null times - put them at the end
      const aTime = a.time?.getTime() ?? 0;
      const bTime = b.time?.getTime() ?? 0;
      return bTime - aTime;
    });

    return result;
  }, [actions, quarantineItems, sortBy]);

  // Filter by tab
  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return items;
    return items.filter((item) => {
      if (activeTab === 'approvals') return item.type === 'approval';
      if (activeTab === 'ready') return item.type === 'ready';
      if (activeTab === 'failed') return item.type === 'failed';
      if (activeTab === 'quarantine') return item.type === 'quarantine';
      return true;
    });
  }, [items, activeTab]);

  // Counts
  const counts = useMemo(() => ({
    all: items.length,
    approvals: items.filter((i) => i.type === 'approval').length,
    ready: items.filter((i) => i.type === 'ready').length,
    failed: items.filter((i) => i.type === 'failed').length,
    quarantine: items.filter((i) => i.type === 'quarantine').length,
  }), [items]);

  return (
    <Card className={`flex flex-col ${className}`}>
      <CardHeader className="pb-3 shrink-0 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconInbox className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Execution Inbox</CardTitle>
            <Badge variant="outline">{items.length}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="time">Latest</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <IconRefresh className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as InboxTab)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 pt-2 shrink-0">
          <TabsTrigger value="all" className="gap-1">
            All
            {counts.all > 0 && <Badge variant="secondary" className="h-5 px-1.5">{counts.all}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1">
            <IconShieldCheck className="w-3.5 h-3.5" />
            Approvals
            {counts.approvals > 0 && <Badge variant="default" className="h-5 px-1.5 bg-amber-500">{counts.approvals}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="ready" className="gap-1">
            <IconPlayerPlay className="w-3.5 h-3.5" />
            Ready
            {counts.ready > 0 && <Badge variant="secondary" className="h-5 px-1.5">{counts.ready}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="failed" className="gap-1">
            <IconAlertTriangle className="w-3.5 h-3.5" />
            Failed
            {counts.failed > 0 && <Badge variant="destructive" className="h-5 px-1.5">{counts.failed}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="quarantine" className="gap-1">
            Quarantine
            {counts.quarantine > 0 && <Badge variant="secondary" className="h-5 px-1.5">{counts.quarantine}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 overflow-hidden mt-0">
          <ScrollArea style={{ height: maxHeight }}>
            <div className="p-4 space-y-2">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <IconInbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No items in this category</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <InboxItemRow
                    key={item.id}
                    item={item}
                    onApprove={onApprove}
                    onRun={onRun}
                    onRetry={onRetry}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// =============================================================================
// Inbox Item Row
// =============================================================================

interface InboxItemRowProps {
  item: InboxItem;
  onApprove?: (id: string) => Promise<void>;
  onRun?: (id: string) => Promise<void>;
  onRetry?: (id: string) => Promise<void>;
}

function InboxItemRow({ item, onApprove, onRun, onRetry }: InboxItemRowProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const typeConfig = {
    approval: {
      icon: IconShieldCheck,
      color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    },
    ready: {
      icon: IconPlayerPlay,
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    },
    failed: {
      icon: IconAlertTriangle,
      color: 'bg-red-500/10 text-red-500 border-red-500/20',
    },
    quarantine: {
      icon: IconInbox,
      color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    },
  };

  const config = typeConfig[item.type];
  const Icon = config.icon;

  const handleAction = async (action: () => Promise<void>) => {
    setIsProcessing(true);
    try {
      await action();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
      {/* Type indicator */}
      <div className={`p-2 rounded-lg ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <Link href={item.href} className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
        )}
      </Link>

      {/* Time */}
      <span className="text-xs text-muted-foreground shrink-0">
        {formatTimeSafe(item.time)}
      </span>

      {/* Priority */}
      {item.priority === 'high' && (
        <Badge variant="destructive" className="shrink-0">High</Badge>
      )}

      {/* Actions */}
      <div className="flex gap-1 shrink-0">
        {item.type === 'approval' && onApprove && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-green-500/20 hover:text-green-500"
            onClick={() => handleAction(() => onApprove(item.id))}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <IconLoader2 className="w-4 h-4 animate-spin" />
            ) : (
              <IconCheck className="w-4 h-4" />
            )}
          </Button>
        )}
        {item.type === 'ready' && onRun && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-blue-500/20 hover:text-blue-500"
            onClick={() => handleAction(() => onRun(item.id))}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <IconLoader2 className="w-4 h-4 animate-spin" />
            ) : (
              <IconPlayerPlay className="w-4 h-4" />
            )}
          </Button>
        )}
        {item.type === 'failed' && onRetry && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-orange-500/20 hover:text-orange-500"
            onClick={() => handleAction(() => onRetry(item.id))}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <IconLoader2 className="w-4 h-4 animate-spin" />
            ) : (
              <IconRefresh className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default ExecutionInbox;
