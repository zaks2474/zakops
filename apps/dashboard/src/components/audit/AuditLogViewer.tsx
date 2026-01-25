/**
 * AuditLogViewer Component
 *
 * Displays audit logs with:
 * - Timeline view of events
 * - Actor filter
 * - Action filter
 * - Request ID visible and copyable
 * - Export JSON/CSV functionality
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  IconDownload,
  IconCopy,
  IconCheck,
  IconFilter,
  IconSearch,
  IconUser,
  IconRobot,
  IconClock,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { format, formatDistanceToNow } from 'date-fns';

// =============================================================================
// Types
// =============================================================================

export interface AuditLogEntry {
  id: string;
  request_id: string;
  timestamp: string;
  actor: {
    type: 'user' | 'agent' | 'system';
    id: string;
    name?: string;
  };
  action: string;
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  details?: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'pending';
  metadata?: {
    ip_address?: string;
    user_agent?: string;
    duration_ms?: number;
  };
}

interface AuditLogViewerProps {
  entries: AuditLogEntry[];
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

// =============================================================================
// Helper Components
// =============================================================================

function CopyableRequestId({ requestId }: { requestId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(requestId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [requestId]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="max-w-[120px] truncate">{requestId}</span>
            {copied ? (
              <IconCheck className="w-3 h-3 text-green-500" />
            ) : (
              <IconCopy className="w-3 h-3" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {copied ? 'Copied!' : 'Click to copy request ID'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ActorIcon({ type }: { type: 'user' | 'agent' | 'system' }) {
  switch (type) {
    case 'user':
      return <IconUser className="w-4 h-4" />;
    case 'agent':
      return <IconRobot className="w-4 h-4" />;
    case 'system':
      return <IconClock className="w-4 h-4" />;
  }
}

function OutcomeBadge({ outcome }: { outcome: 'success' | 'failure' | 'pending' }) {
  const variants = {
    success: 'bg-green-500/10 text-green-500 border-green-500/20',
    failure: 'bg-red-500/10 text-red-500 border-red-500/20',
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  };

  return (
    <Badge variant="outline" className={variants[outcome]}>
      {outcome}
    </Badge>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AuditLogViewer({
  entries,
  onRefresh,
  isLoading = false,
  className = '',
}: AuditLogViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Get unique actors and actions for filters
  const { uniqueActors, uniqueActions } = useMemo(() => {
    const actors = new Set<string>();
    const actions = new Set<string>();

    entries.forEach((entry) => {
      actors.add(entry.actor.type);
      actions.add(entry.action);
    });

    return {
      uniqueActors: Array.from(actors),
      uniqueActions: Array.from(actions),
    };
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          entry.request_id.toLowerCase().includes(query) ||
          entry.action.toLowerCase().includes(query) ||
          entry.actor.name?.toLowerCase().includes(query) ||
          entry.resource.name?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Actor filter
      if (actorFilter !== 'all' && entry.actor.type !== actorFilter) {
        return false;
      }

      // Action filter
      if (actionFilter !== 'all' && entry.action !== actionFilter) {
        return false;
      }

      return true;
    });
  }, [entries, searchQuery, actorFilter, actionFilter]);

  // Toggle entry expansion
  const toggleExpanded = useCallback((id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Export functions
  const exportAsJson = useCallback(() => {
    const data = JSON.stringify(filteredEntries, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredEntries]);

  const exportAsCsv = useCallback(() => {
    const headers = [
      'Timestamp',
      'Request ID',
      'Actor Type',
      'Actor ID',
      'Actor Name',
      'Action',
      'Resource Type',
      'Resource ID',
      'Resource Name',
      'Outcome',
    ];

    const rows = filteredEntries.map((entry) => [
      entry.timestamp,
      entry.request_id,
      entry.actor.type,
      entry.actor.id,
      entry.actor.name || '',
      entry.action,
      entry.resource.type,
      entry.resource.id,
      entry.resource.name || '',
      entry.outcome,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredEntries]);

  return (
    <Card className={className} data-testid="audit-log-viewer">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconClock className="w-5 h-5" />
            Audit Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportAsJson}
              disabled={filteredEntries.length === 0}
            >
              <IconDownload className="w-4 h-4 mr-1" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportAsCsv}
              disabled={filteredEntries.length === 0}
            >
              <IconDownload className="w-4 h-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by request ID, action, or actor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Select value={actorFilter} onValueChange={setActorFilter}>
            <SelectTrigger className="w-[150px]">
              <IconFilter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Actor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actors</SelectItem>
              {uniqueActors.map((actor) => (
                <SelectItem key={actor} value={actor}>
                  {actor.charAt(0).toUpperCase() + actor.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <IconFilter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredEntries.length} of {entries.length} entries
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit log entries found
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isExpanded = expandedEntries.has(entry.id);

              return (
                <div
                  key={entry.id}
                  className="border rounded-lg overflow-hidden"
                  data-testid="audit-log-entry"
                >
                  {/* Entry header */}
                  <button
                    className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left"
                    onClick={() => toggleExpanded(entry.id)}
                  >
                    {/* Expand/collapse icon */}
                    {isExpanded ? (
                      <IconChevronDown className="w-4 h-4 shrink-0" />
                    ) : (
                      <IconChevronRight className="w-4 h-4 shrink-0" />
                    )}

                    {/* Timeline indicator */}
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />

                    {/* Actor */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ActorIcon type={entry.actor.type} />
                      <span className="text-sm font-medium">
                        {entry.actor.name || entry.actor.id}
                      </span>
                    </div>

                    {/* Action */}
                    <span className="text-sm">{entry.action}</span>

                    {/* Resource */}
                    <span className="text-sm text-muted-foreground">
                      {entry.resource.type}:{' '}
                      {entry.resource.name || entry.resource.id}
                    </span>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Outcome */}
                    <OutcomeBadge outcome={entry.outcome} />

                    {/* Timestamp */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(entry.timestamp), {
                              addSuffix: true,
                            })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {format(new Date(entry.timestamp), 'PPpp')}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t bg-muted/30">
                      <div className="grid grid-cols-2 gap-4 p-3">
                        {/* Request ID */}
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">
                            Request ID
                          </span>
                          <div className="mt-1">
                            <CopyableRequestId requestId={entry.request_id} />
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">
                            Timestamp
                          </span>
                          <div className="mt-1 text-sm">
                            {format(new Date(entry.timestamp), 'PPpp')}
                          </div>
                        </div>

                        {/* Actor ID */}
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">
                            Actor ID
                          </span>
                          <div className="mt-1 text-sm font-mono">
                            {entry.actor.id}
                          </div>
                        </div>

                        {/* Resource ID */}
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">
                            Resource ID
                          </span>
                          <div className="mt-1 text-sm font-mono">
                            {entry.resource.id}
                          </div>
                        </div>

                        {/* Duration */}
                        {entry.metadata?.duration_ms && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">
                              Duration
                            </span>
                            <div className="mt-1 text-sm">
                              {entry.metadata.duration_ms}ms
                            </div>
                          </div>
                        )}

                        {/* IP Address */}
                        {entry.metadata?.ip_address && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">
                              IP Address
                            </span>
                            <div className="mt-1 text-sm font-mono">
                              {entry.metadata.ip_address}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Details JSON */}
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Details
                          </span>
                          <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-40 font-mono">
                            {JSON.stringify(entry.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default AuditLogViewer;
