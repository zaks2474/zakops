/**
 * Agent Activity Page
 *
 * Full history view of all agent activity.
 * Uses useAgentActivity hook as single source of truth.
 */

'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconRobot,
  IconRefresh,
  IconSearch,
  IconClock,
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
  IconPlayerPlay,
  IconFileText,
  IconMail,
  IconShieldCheck,
  IconChartBar,
  IconActivity,
} from '@tabler/icons-react';
import { useAgentActivity, useAgentStatus } from '@/hooks/useAgentActivity';
import type { AgentActivityEvent, AgentRecentRun, AgentEventType } from '@/types/agent-activity';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

// =============================================================================
// Tab Definitions
// =============================================================================

const ACTIVITY_TABS = [
  { value: 'all', label: 'All Activity', icon: IconActivity },
  { value: 'deals', label: 'Deals', icon: IconChartBar },
  { value: 'documents', label: 'Documents', icon: IconFileText },
  { value: 'communications', label: 'Communications', icon: IconMail },
  { value: 'approvals', label: 'Approvals', icon: IconShieldCheck },
] as const;

// Event type to tab mapping
const EVENT_TYPE_TO_TAB: Record<string, string> = {
  'deal.created': 'deals',
  'deal.scored': 'deals',
  'deal.analyzed': 'deals',
  'deal.stage_changed': 'deals',
  'doc.extracted': 'documents',
  'doc.summarized': 'documents',
  'doc.indexed': 'documents',
  'email.drafted': 'communications',
  'email.sent': 'communications',
  'loi.drafted': 'communications',
  'approval.requested': 'approvals',
  'approval.approved': 'approvals',
  'approval.rejected': 'approvals',
};

// =============================================================================
// Helper Functions
// =============================================================================

function getEventIcon(type: AgentEventType) {
  if (type.startsWith('deal.')) return IconChartBar;
  if (type.startsWith('doc.')) return IconFileText;
  if (type.startsWith('email.') || type.startsWith('loi.')) return IconMail;
  if (type.startsWith('approval.')) return IconShieldCheck;
  if (type.startsWith('agent.')) return IconRobot;
  return IconActivity;
}

function getRunStatusBadge(status: AgentRecentRun['status']) {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-green-500"><IconCircleCheck className="h-3 w-3 mr-1" />Completed</Badge>;
    case 'failed':
      return <Badge variant="destructive"><IconCircleX className="h-3 w-3 mr-1" />Failed</Badge>;
    case 'cancelled':
      return <Badge variant="secondary"><IconAlertTriangle className="h-3 w-3 mr-1" />Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function AgentActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state
  const initialTab = searchParams.get('tab') || 'all';
  const initialSearch = searchParams.get('q') || '';
  const initialSelectedRun = searchParams.get('run') || '';
  const urlHighlight = searchParams.get('highlight') || null;

  // Local state
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialSelectedRun || null);
  const [highlightedStat, setHighlightedStat] = useState<string | null>(null);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(urlHighlight);

  // Helper to handle stat click with temporary highlight on both card and section
  const handleStatClick = (stat: string, action: () => void) => {
    action();
    // Highlight the stat card
    setHighlightedStat(stat);
    setTimeout(() => setHighlightedStat(null), 2000);
    // Highlight the corresponding section
    setHighlightedSection(stat);
    setTimeout(() => setHighlightedSection(null), 2000);
  };

  // Ref for scrolling to highlighted event
  const highlightedRef = useRef<HTMLDivElement>(null);

  // Handle URL highlight on mount
  useEffect(() => {
    if (urlHighlight) {
      setHighlightedEventId(urlHighlight);

      // Scroll to highlighted event
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      // Auto-clear highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedEventId(null);
        // Clear URL param
        router.replace('/agent/activity', { scroll: false });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [urlHighlight, router]);

  // Clear highlight when user clicks any event
  const clearHighlight = () => {
    if (highlightedEventId) {
      setHighlightedEventId(null);
      if (urlHighlight) {
        router.replace('/agent/activity', { scroll: false });
      }
    }
  };

  // Data from hook
  const { data, isLoading, error, refetch } = useAgentActivity();
  const status = useAgentStatus();

  // URL update helper
  const updateUrl = (params: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    router.replace(`/agent/activity?${newParams.toString()}`, { scroll: false });
  };

  // Filter events by tab and search
  const filteredEvents = useMemo(() => {
    if (!data?.recent) return [];

    let events = [...data.recent];

    // Filter by tab
    if (activeTab !== 'all') {
      events = events.filter(e => EVENT_TYPE_TO_TAB[e.type] === activeTab);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter(
        e =>
          e.label.toLowerCase().includes(q) ||
          e.dealName?.toLowerCase().includes(q) ||
          e.dealId?.toLowerCase().includes(q)
      );
    }

    return events;
  }, [data?.recent, activeTab, searchQuery]);

  // Filter runs by search
  const filteredRuns = useMemo(() => {
    if (!data?.recentRuns) return [];

    if (!searchQuery.trim()) return data.recentRuns;

    const q = searchQuery.toLowerCase();
    return data.recentRuns.filter(
      r =>
        r.summary.toLowerCase().includes(q) ||
        r.dealName?.toLowerCase().includes(q) ||
        r.dealId?.toLowerCase().includes(q)
    );
  }, [data?.recentRuns, searchQuery]);

  // Selected run details
  const selectedRun = selectedRunId ? filteredRuns.find(r => r.runId === selectedRunId) : null;

  // Error state
  if (error) {
    return (
      <div className="flex flex-1 flex-col min-h-0 items-center justify-center gap-4 p-8">
        <IconAlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Failed to load agent activity</h2>
        <p className="text-muted-foreground">{error.message}</p>
        <Button onClick={() => refetch()} variant="outline">
          <IconRefresh className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <IconRobot className="h-6 w-6 text-primary" />
            Agent Activity
          </h1>
          <p className="text-muted-foreground">
            View all agent actions and history
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <Badge
            variant={
              status === 'waiting_approval' ? 'destructive' :
              status === 'working' ? 'default' :
              'secondary'
            }
            className="gap-1"
          >
            {status === 'working' && <IconPlayerPlay className="h-3 w-3 animate-pulse" />}
            {status === 'waiting_approval' && <IconShieldCheck className="h-3 w-3" />}
            {status === 'idle' && <IconClock className="h-3 w-3" />}
            {status === 'waiting_approval' ? 'Needs Approval' :
             status === 'working' ? 'Working' : 'Idle'}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <IconRefresh className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards - Clickable to filter */}
      {data?.stats && (
        <div className="grid gap-4 md:grid-cols-4 shrink-0">
          <StatCard
            label="Tools Called Today"
            value={data.stats.toolsCalledToday}
            active={activeTab === 'all'}
            highlighted={highlightedStat === 'tools'}
            onClick={() => handleStatClick('tools', () => {
              setActiveTab('all');
              updateUrl({ tab: '' });
            })}
          />
          <StatCard
            label="Approvals Processed"
            value={data.stats.approvalsProcessed}
            active={activeTab === 'approvals'}
            highlighted={highlightedStat === 'approvals'}
            onClick={() => handleStatClick('approvals', () => {
              setActiveTab('approvals');
              updateUrl({ tab: 'approvals' });
            })}
          />
          <StatCard
            label="Deals Analyzed"
            value={data.stats.dealsAnalyzed}
            active={activeTab === 'deals'}
            highlighted={highlightedStat === 'deals'}
            onClick={() => handleStatClick('deals', () => {
              setActiveTab('deals');
              updateUrl({ tab: 'deals' });
            })}
          />
          <StatCard
            label="Runs (24h)"
            value={data.stats.runsCompleted24h}
            active={false}
            highlighted={highlightedStat === 'runs'}
            onClick={() => handleStatClick('runs', () => {
              document.getElementById('runs-section')?.scrollIntoView({ behavior: 'smooth' });
            })}
          />
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activity..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              updateUrl({ q: e.target.value });
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Main Content: Events + Runs */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Events */}
        <div
          id="activity-section"
          className={cn(
            'lg:col-span-2 flex flex-col min-h-0 transition-all duration-300 rounded-lg',
            highlightedSection && highlightedSection !== 'runs' && 'ring-2 ring-primary bg-primary/5 p-2 -m-2'
          )}
        >
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v);
              updateUrl({ tab: v === 'all' ? '' : v });
            }}
            className="flex flex-col h-full"
          >
            <TabsList className="shrink-0 flex-wrap h-auto">
              {ACTIVITY_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="gap-1">
                  <Icon className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 min-h-0 mt-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <IconActivity className="h-12 w-12 mb-2 opacity-50" />
                  <p>No activity found</p>
                  {searchQuery && (
                    <Button
                      variant="link"
                      onClick={() => {
                        setSearchQuery('');
                        updateUrl({ q: '' });
                      }}
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-2">
                    {filteredEvents.map((event) => (
                      <div
                        key={event.id}
                        ref={event.id === highlightedEventId ? highlightedRef : undefined}
                      >
                        <EventCard
                          event={event}
                          highlighted={event.id === highlightedEventId}
                          onClearHighlight={clearHighlight}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </Tabs>
        </div>

        {/* Recent Runs */}
        <div
          id="runs-section"
          className={cn(
            'flex flex-col min-h-0 transition-all duration-300 rounded-lg p-2 -m-2',
            highlightedStat === 'runs' && 'ring-2 ring-primary bg-primary/5'
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Runs</h2>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredRuns.length === 0 ? (
            <Card className="flex-1 flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground py-12">
                <IconRobot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No runs found</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-4">
                {filteredRuns.map((run) => (
                  <RunCard
                    key={run.runId}
                    run={run}
                    selected={run.runId === selectedRunId}
                    onSelect={() => {
                      setSelectedRunId(run.runId);
                      updateUrl({ run: run.runId });
                    }}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Current Run Banner (if any) */}
      {data?.currentRun && (
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="w-80 shadow-lg border-primary">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <IconPlayerPlay className="h-4 w-4 animate-pulse text-primary" />
                  Active Run
                </CardTitle>
                <Badge variant="default" className="bg-primary">
                  {data.currentRun.status === 'running' ? 'Running' : 'Awaiting Approval'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{data.currentRun.progressLabel}</p>
              {data.currentRun.dealName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Deal: {data.currentRun.dealName}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Started {formatDistanceToNow(new Date(data.currentRun.startedAt), { addSuffix: true })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Stat Card Component (clickable)
// =============================================================================

function StatCard({
  label,
  value,
  active,
  highlighted,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  highlighted: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:bg-accent/50',
        active && 'border-primary bg-primary/5',
        highlighted && 'ring-2 ring-primary animate-pulse'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

// =============================================================================
// Event Card Component (expandable)
// =============================================================================

function EventCard({
  event,
  highlighted = false,
  onClearHighlight,
}: {
  event: AgentActivityEvent;
  highlighted?: boolean;
  onClearHighlight?: () => void;
}) {
  const [expanded, setExpanded] = useState(highlighted);
  const Icon = getEventIcon(event.type);

  const handleClick = () => {
    setExpanded(!expanded);
    // Clear URL-based highlight when user interacts
    onClearHighlight?.();
  };

  return (
    <Card
      className={cn(
        'transition-all cursor-pointer',
        expanded ? 'bg-accent/30 ring-1 ring-primary/20' : 'hover:bg-accent/50',
        highlighted && 'ring-2 ring-primary animate-pulse'
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{event.label}</p>
            <div className="flex items-center gap-2 mt-1">
              {event.dealName && (
                <Link
                  href={`/deals/${event.dealId}`}
                  className="text-xs text-muted-foreground hover:text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  {event.dealName}
                </Link>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
              </span>
            </div>

            {/* Expanded details */}
            {expanded && (
              <div className="mt-3 pt-3 border-t space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Event Type</span>
                    <p className="font-mono text-xs">{event.type}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Timestamp</span>
                    <p className="text-xs">{format(new Date(event.timestamp), 'PPpp')}</p>
                  </div>
                  {event.dealId && (
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Deal ID</span>
                      <p className="font-mono text-xs">{event.dealId}</p>
                    </div>
                  )}
                </div>
                {event.dealId && (
                  <div className="flex gap-2 pt-2">
                    <Link href={`/deals/${event.dealId}`} onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline">
                        <IconChartBar className="h-3 w-3 mr-1" />
                        View Deal
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Run Card Component
// =============================================================================

function RunCard({
  run,
  selected,
  onSelect,
}: {
  run: AgentRecentRun;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-colors ${
        selected ? 'border-primary bg-accent' : 'hover:bg-accent/50'
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getRunStatusBadge(run.status)}
            </div>
            <p className="text-sm font-medium truncate">{run.summary}</p>
            {run.dealName && (
              <p className="text-xs text-muted-foreground mt-1">
                {run.dealName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>{run.toolsCalled} tools</span>
          <span>{run.approvalsRequested} approvals</span>
          <span>{formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}</span>
        </div>
      </CardContent>
    </Card>
  );
}
