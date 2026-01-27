'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  IconAlertTriangle,
  IconRefresh,
  IconSearch,
  IconFilter,
  IconPlus,
  IconLoader2,
  IconBolt,
  IconClock,
  IconCircleCheck,
  IconCircleX,
  IconShieldCheck,
  IconPlayerPlay,
  IconAlertCircle,
  IconInfoCircle,
  IconTrash,
  IconArchive,
  IconChevronDown,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import {
  getKineticActions,
  getKineticAction,
  getCapabilities,
  getActionMetrics,
  approveKineticAction,
  runKineticAction,
  cancelKineticAction,
  retryKineticAction,
  updateKineticActionInputs,
  createKineticAction,
  bulkArchiveKineticActions,
  bulkDeleteKineticActions,
  clearCompletedActions,
  type KineticAction,
  type KineticActionStatus,
  type Capability,
  type ActionMetrics,
  KINETIC_ACTION_STATUSES,
} from '@/lib/api';
import { ActionCard } from '@/components/actions/action-card';
import { ActionInputForm, validateFormValues } from '@/components/actions/action-input-form';

// Tab definitions with their filter criteria
const STATUS_TABS = [
  { value: 'all', label: 'All', icon: IconBolt },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval', icon: IconShieldCheck },
  { value: 'READY', label: 'Ready', icon: IconClock },
  { value: 'PROCESSING', label: 'Processing', icon: IconPlayerPlay },
  { value: 'COMPLETED', label: 'Completed', icon: IconCircleCheck },
  { value: 'FAILED', label: 'Failed', icon: IconCircleX },
] as const;

// Polling configuration
const POLL_INTERVAL_MS = 3000; // Poll every 3 seconds
const POLL_TIMEOUT_MS = 120000; // Stop polling after 2 minutes
const TERMINAL_STATUSES: KineticActionStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

// API configuration - log warning if misconfigured
const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export default function ActionsCommandCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-persisted filters
  const initialStatus = searchParams.get('status') || 'all';
  const initialType = searchParams.get('type') || '';
  const initialDealId = searchParams.get('deal_id') || '';
  const initialSearch = searchParams.get('q') || '';
  const initialSelectedId = searchParams.get('selected') || '';

  // State
  const [actions, setActions] = useState<KineticAction[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [metrics, setMetrics] = useState<ActionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiConfigWarning, setApiConfigWarning] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [dealIdFilter, setDealIdFilter] = useState(initialDealId);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  // UI state
  const [selectedActionId, setSelectedActionId] = useState<string | null>(initialSelectedId || null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeStatFilter, setActiveStatFilter] = useState<string | null>(null);
  const [createCapability, setCreateCapability] = useState<Capability | null>(null);
  const [createInputs, setCreateInputs] = useState<Record<string, unknown>>({});
  const [createDealId, setCreateDealId] = useState('');
  const [creating, setCreating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState<{ operation: 'archive' | 'delete'; age: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Polling state
  const pollingRef = useRef<{ actionId: string; startTime: number; intervalId: NodeJS.Timeout } | null>(null);

  // Validate API configuration on mount
  useEffect(() => {
    // Check if API is reachable
    const checkApi = async () => {
      try {
        const response = await fetch('/api/version');
        if (!response.ok) {
          setApiConfigWarning(`API returned status ${response.status}. Backend may be down.`);
        }
      } catch (err) {
        setApiConfigWarning('Cannot reach API. Ensure backend is running on port 8091.');
        console.error('API check failed:', err);
      }
    };
    checkApi();

    // Log configuration in dev
    if (process.env.NODE_ENV === 'development') {
      console.log('[Actions] API Base URL:', API_BASE_URL);
      console.log('[Actions] API requests will proxy through Next.js to backend (port 8091)');
    }
  }, []);

  // Update URL when filters change
  const updateUrl = useCallback((params: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    router.replace(`/actions?${newParams.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [actionsData, capabilitiesData, metricsData] = await Promise.all([
        getKineticActions({
          status: statusFilter !== 'all' ? statusFilter as KineticActionStatus : undefined,
          type: typeFilter || undefined,
          deal_id: dealIdFilter || undefined,
        }),
        getCapabilities(),
        getActionMetrics(),
      ]);
      setActions(actionsData);
      setCapabilities(capabilitiesData);
      setMetrics(metricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load actions');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, dealIdFilter]);

  // Stop any active polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current.intervalId);
      pollingRef.current = null;
    }
  }, []);

  // Poll for action status until terminal or timeout
  const pollForAction = useCallback(async (actionId: string) => {
    stopPolling();

    const startTime = Date.now();

    const poll = async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > POLL_TIMEOUT_MS) {
        stopPolling();
        toast.warning('Polling timed out. The action may still be processing.');
        return;
      }

      try {
        const action = await getKineticAction(actionId);
        if (action) {
          // Update the action in state
          setActions(prev => prev.map(a => a.action_id === actionId ? action : a));

          // If terminal state, stop polling and show toast
          if (TERMINAL_STATUSES.includes(action.status)) {
            stopPolling();
            if (action.status === 'COMPLETED') {
              toast.success(`Action completed: ${action.title}`);
            } else if (action.status === 'FAILED') {
              toast.error(`Action failed: ${action.error?.message || 'Unknown error'}`);
            } else if (action.status === 'CANCELLED') {
              toast.info(`Action cancelled: ${action.title}`);
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        // Don't stop polling on transient errors
      }
    };

    // Start polling
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    pollingRef.current = { actionId, startTime, intervalId };

    // Also poll immediately
    poll();
  }, [stopPolling]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds for PROCESSING actions
    const interval = setInterval(() => {
      if (actions.some(a => a.status === 'PROCESSING')) {
        fetchData();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle stat card click - filter by that metric
  const handleStatCardClick = (filterId: string) => {
    if (activeStatFilter === filterId) {
      // Toggle off - clear filter
      setActiveStatFilter(null);
    } else {
      // Set filter and sync with tabs
      setActiveStatFilter(filterId);
      // Sync tab filter for relevant statuses
      if (filterId === 'pending_approval') {
        setStatusFilter('PENDING_APPROVAL');
        updateUrl({ status: 'PENDING_APPROVAL' });
      } else if (filterId === 'processing') {
        setStatusFilter('PROCESSING');
        updateUrl({ status: 'PROCESSING' });
      } else if (filterId === 'failed_24h') {
        setStatusFilter('FAILED');
        updateUrl({ status: 'FAILED' });
      } else if (filterId === 'completed_24h') {
        setStatusFilter('COMPLETED');
        updateUrl({ status: 'COMPLETED' });
      }
    }
  };

  // Client-side search filtering
  const filteredActions = useMemo(() => {
    let result = actions;

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.action_type.toLowerCase().includes(q) ||
          a.deal_id.toLowerCase().includes(q) ||
          a.action_id.toLowerCase().includes(q)
      );
    }

    // Apply 24h time filter for stat cards
    if (activeStatFilter === 'completed_24h' || activeStatFilter === 'failed_24h' || activeStatFilter === 'success_rate') {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      result = result.filter(a => {
        const completedAt = a.completed_at ? new Date(a.completed_at) : null;
        return completedAt && completedAt >= twentyFourHoursAgo;
      });
    }

    return result;
  }, [actions, searchQuery, activeStatFilter]);

  // Get counts by status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: actions.length };
    Array.from(KINETIC_ACTION_STATUSES).forEach(s => { counts[s] = 0; });
    actions.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
    return counts;
  }, [actions]);

  // Get unique action types for filter
  const actionTypes = useMemo(() => {
    return Array.from(new Set(actions.map(a => a.action_type))).sort();
  }, [actions]);

  // Get capability for an action
  const getCapabilityForAction = (action: KineticAction): Capability | undefined => {
    return capabilities.find(c => c.capability_id === action.capability_id || c.action_type === action.action_type);
  };

  // Selected action
  const selectedAction = selectedActionId ? actions.find(a => a.action_id === selectedActionId) : null;
  const selectedCapability = selectedAction ? getCapabilityForAction(selectedAction) : undefined;

  // Action handlers - return { success, error } for inline display
  const handleApprove = async (actionId: string, approvedBy: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await approveKineticAction(actionId, approvedBy);
      if (result.success) {
        toast.success('Action approved - now READY to run');
        // Start polling to track any auto-execution
        pollForAction(actionId);
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to approve action' };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve action';
      return { success: false, error: message };
    }
  };

  const handleRun = async (actionId: string): Promise<{ success: boolean; error?: string; reason?: string }> => {
    try {
      const result = await runKineticAction(actionId);
      if (result.success) {
        toast.success('Action started - monitoring progress...');
        // Start polling to track execution
        pollForAction(actionId);
        return { success: true };
      } else {
        // Handle idempotency - already running/completed
        if (result.reason === 'already_processing' || result.reason === 'already_completed') {
          toast.info(result.error || 'Action already in progress');
          // Still refresh to sync state
          fetchData();
          return { success: true, reason: result.reason };
        } else {
          return { success: false, error: result.error || 'Failed to run action', reason: result.reason };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run action';
      return { success: false, error: message };
    }
  };

  const handleCancel = async (actionId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await cancelKineticAction(actionId, reason);
      if (result.success) {
        toast.success('Action cancelled');
        fetchData();
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to cancel action' };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel action';
      return { success: false, error: message };
    }
  };

  const handleRetry = async (actionId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await retryKineticAction(actionId);
      if (result.success) {
        toast.success('Action retry started');
        // Start polling to track execution
        pollForAction(actionId);
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to retry action' };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retry action';
      return { success: false, error: message };
    }
  };

  const handleUpdateInputs = async (actionId: string, inputs: Record<string, unknown>): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await updateKineticActionInputs(actionId, inputs);
      if (result.success) {
        toast.success('Action inputs updated');
        fetchData();
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to update inputs' };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update inputs';
      return { success: false, error: message };
    }
  };

  const handleRefresh = async () => {
    await fetchData();
  };

  const handleCreateAction = async () => {
    if (!createCapability || !createDealId.trim()) return;

    // Validate inputs
    const { valid, errors } = validateFormValues(createInputs, createCapability.input_schema);
    if (!valid) {
      toast.error('Validation errors: ' + errors.join(', '));
      return;
    }

    setCreating(true);
    try {
      const result = await createKineticAction({
        deal_id: createDealId.trim(),
        action_type: createCapability.action_type,
        capability_id: createCapability.capability_id,
        title: createCapability.title,
        inputs: createInputs,
      });
      if (result.success) {
        toast.success('Action created');
        setShowCreateDialog(false);
        setCreateCapability(null);
        setCreateInputs({});
        setCreateDealId('');
        fetchData();
        // Select the new action
        if (result.action_id) {
          setSelectedActionId(result.action_id);
          updateUrl({ selected: result.action_id });
        }
      } else {
        toast.error(result.error || 'Failed to create action');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create action');
    } finally {
      setCreating(false);
    }
  };

  // Handle clear completed actions
  const handleClearCompleted = async (operation: 'archive' | 'delete', age: string) => {
    setIsClearing(true);
    try {
      const result = await clearCompletedActions(operation, age as 'all' | '7d' | '30d');

      if (!result.success) {
        toast.error(result.error || 'Failed to clear actions');
        return;
      }

      const actionText = operation === 'archive' ? 'archived' : 'deleted';
      toast.success(`${result.affected_count ?? 0} action(s) ${actionText}`);
      setShowClearConfirm(null);
      fetchData(); // Refresh to get updated list
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear actions');
    } finally {
      setIsClearing(false);
    }
  };

  // Bulk selection handlers
  const toggleSelectAction = (actionId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionId)) {
        newSet.delete(actionId);
      } else {
        newSet.add(actionId);
      }
      return newSet;
    });
  };

  const selectAllFiltered = () => {
    if (selectedIds.size === filteredActions.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all filtered
      setSelectedIds(new Set(filteredActions.map(a => a.action_id)));
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;
    setIsClearing(true);
    try {
      const result = await bulkArchiveKineticActions(Array.from(selectedIds));
      if (!result.success) {
        toast.error(result.error || 'Failed to archive actions');
        return;
      }
      toast.success(`${result.archived_count ?? selectedIds.size} action(s) archived`);
      setSelectedIds(new Set());
      fetchData(); // Refresh list
    } catch (err) {
      toast.error('Failed to archive actions');
    } finally {
      setIsClearing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsClearing(true);
    try {
      const result = await bulkDeleteKineticActions(Array.from(selectedIds));
      if (!result.success) {
        toast.error(result.error || 'Failed to delete actions');
        return;
      }
      toast.success(`${result.deleted_count ?? selectedIds.size} action(s) deleted`);
      setSelectedIds(new Set());
      fetchData(); // Refresh list
    } catch (err) {
      toast.error('Failed to delete actions');
    } finally {
      setIsClearing(false);
    }
  };

  // Error state
  if (error) {
    return (
      <div className="flex flex-1 flex-col min-h-0 items-center justify-center gap-4 p-8">
        <IconAlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Failed to load actions</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline">
          <IconRefresh className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto gap-4 p-4 md:p-6" data-testid="actions-scroll">
      {/* API Configuration Warning */}
      {apiConfigWarning && (
        <Alert variant="destructive" className="shrink-0">
          <IconAlertCircle className="h-4 w-4" />
          <AlertTitle>API Configuration Issue</AlertTitle>
          <AlertDescription>
            {apiConfigWarning}
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 ml-2"
              onClick={() => {
                setApiConfigWarning(null);
                fetchData();
              }}
            >
              Dismiss and retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <IconBolt className="h-6 w-6 text-primary" />
            Actions Command Center
          </h1>
          <p className="text-muted-foreground">
            Manage, approve, and execute workflow actions
          </p>
        </div>
        <div className="flex gap-2">
          {/* Clear Completed Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isClearing}>
                {isClearing ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconTrash className="mr-2 h-4 w-4" />
                )}
                Clear
                <IconChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Clear completed actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowClearConfirm({ operation: 'archive', age: 'all' })}>
                <IconArchive className="mr-2 h-4 w-4" />
                Archive All Completed
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowClearConfirm({ operation: 'delete', age: 'all' })}
                className="text-destructive focus:text-destructive"
              >
                <IconTrash className="mr-2 h-4 w-4" />
                Delete All Completed
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowClearConfirm({ operation: 'archive', age: '7d' })}>
                <IconArchive className="mr-2 h-4 w-4" />
                Archive older than 7 days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowClearConfirm({ operation: 'archive', age: '30d' })}>
                <IconArchive className="mr-2 h-4 w-4" />
                Archive older than 30 days
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowClearConfirm({ operation: 'delete', age: '7d' })}
                className="text-destructive focus:text-destructive"
              >
                <IconTrash className="mr-2 h-4 w-4" />
                Delete older than 7 days
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <IconRefresh className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {capabilities.length > 0 && (
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <IconPlus className="mr-2 h-4 w-4" />
              New Action
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Cards - Clickable to filter */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-4 shrink-0">
          <button
            onClick={() => handleStatCardClick('pending_approval')}
            className={`text-left rounded-xl border transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeStatFilter === 'pending_approval'
                ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5'
                : 'bg-card hover:bg-accent/50 hover:border-amber-500/50'
            }`}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                Pending Approval
                {activeStatFilter === 'pending_approval' && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                )}
              </CardDescription>
              <CardTitle className="text-3xl text-amber-500">
                {metrics.queue_lengths?.PENDING_APPROVAL ?? statusCounts['PENDING_APPROVAL'] ?? 0}
              </CardTitle>
            </CardHeader>
          </button>
          <button
            onClick={() => handleStatCardClick('processing')}
            className={`text-left rounded-xl border transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeStatFilter === 'processing'
                ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/5'
                : 'bg-card hover:bg-accent/50 hover:border-purple-500/50'
            }`}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                Processing
                {activeStatFilter === 'processing' && (
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                )}
              </CardDescription>
              <CardTitle className="text-3xl text-purple-500">
                {metrics.queue_lengths?.PROCESSING ?? statusCounts['PROCESSING'] ?? 0}
              </CardTitle>
            </CardHeader>
          </button>
          <button
            onClick={() => handleStatCardClick('success_rate')}
            className={`text-left rounded-xl border transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeStatFilter === 'success_rate'
                ? 'border-green-500 ring-2 ring-green-500/20 bg-green-500/5'
                : 'bg-card hover:bg-accent/50 hover:border-green-500/50'
            }`}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                24h Success Rate
                {activeStatFilter === 'success_rate' && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </CardDescription>
              <CardTitle className="text-3xl text-green-500">
                {metrics.total_24h > 0
                  ? `${Math.round(metrics.success_rate_24h * 100)}%`
                  : '-'}
              </CardTitle>
            </CardHeader>
          </button>
          <button
            onClick={() => handleStatCardClick('failed_24h')}
            className={`text-left rounded-xl border transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeStatFilter === 'failed_24h'
                ? 'border-destructive ring-2 ring-destructive/20 bg-destructive/5'
                : 'bg-card hover:bg-accent/50 hover:border-destructive/50'
            }`}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                Failed (24h)
                {activeStatFilter === 'failed_24h' && (
                  <span className="w-2 h-2 rounded-full bg-destructive" />
                )}
              </CardDescription>
              <CardTitle className="text-3xl text-destructive">
                {metrics.failed_24h ?? statusCounts['FAILED'] ?? 0}
              </CardTitle>
            </CardHeader>
          </button>
        </div>
      )}

      {/* Fallback metrics when Kinetic API not available - Clickable to filter */}
      {!metrics && !loading && (
        <div className="grid gap-4 md:grid-cols-4 shrink-0">
          <button
            onClick={() => handleStatCardClick('pending_approval')}
            className={`text-left rounded-xl border transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeStatFilter === 'pending_approval'
                ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5'
                : 'bg-card hover:bg-accent/50 hover:border-amber-500/50'
            }`}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                Pending Approval
                {activeStatFilter === 'pending_approval' && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                )}
              </CardDescription>
              <CardTitle className="text-3xl text-amber-500">
                {statusCounts['PENDING_APPROVAL'] ?? 0}
              </CardTitle>
            </CardHeader>
          </button>
          <button
            onClick={() => {
              if (activeStatFilter === 'ready') {
                setActiveStatFilter(null);
              } else {
                setActiveStatFilter('ready');
                setStatusFilter('READY');
                updateUrl({ status: 'READY' });
              }
            }}
            className={`text-left rounded-xl border transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeStatFilter === 'ready'
                ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5'
                : 'bg-card hover:bg-accent/50 hover:border-blue-500/50'
            }`}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                Ready
                {activeStatFilter === 'ready' && (
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </CardDescription>
              <CardTitle className="text-3xl text-blue-500">
                {statusCounts['READY'] ?? 0}
              </CardTitle>
            </CardHeader>
          </button>
          <button
            onClick={() => {
              if (activeStatFilter === 'completed') {
                setActiveStatFilter(null);
              } else {
                setActiveStatFilter('completed');
                setStatusFilter('COMPLETED');
                updateUrl({ status: 'COMPLETED' });
              }
            }}
            className={`text-left rounded-xl border transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeStatFilter === 'completed'
                ? 'border-green-500 ring-2 ring-green-500/20 bg-green-500/5'
                : 'bg-card hover:bg-accent/50 hover:border-green-500/50'
            }`}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                Completed
                {activeStatFilter === 'completed' && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </CardDescription>
              <CardTitle className="text-3xl text-green-500">
                {statusCounts['COMPLETED'] ?? 0}
              </CardTitle>
            </CardHeader>
          </button>
          <button
            onClick={() => {
              if (activeStatFilter === 'failed') {
                setActiveStatFilter(null);
              } else {
                setActiveStatFilter('failed');
                setStatusFilter('FAILED');
                updateUrl({ status: 'FAILED' });
              }
            }}
            className={`text-left rounded-xl border transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              activeStatFilter === 'failed'
                ? 'border-destructive ring-2 ring-destructive/20 bg-destructive/5'
                : 'bg-card hover:bg-accent/50 hover:border-destructive/50'
            }`}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                Failed
                {activeStatFilter === 'failed' && (
                  <span className="w-2 h-2 rounded-full bg-destructive" />
                )}
              </CardDescription>
              <CardTitle className="text-3xl text-destructive">
                {statusCounts['FAILED'] ?? 0}
              </CardTitle>
            </CardHeader>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search actions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              updateUrl({ q: e.target.value });
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={typeFilter || '__all__'}
          onValueChange={(v) => {
            const val = v === '__all__' ? '' : v;
            setTypeFilter(val);
            updateUrl({ type: val });
          }}
        >
          <SelectTrigger className="w-[200px]">
            <IconFilter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {actionTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {dealIdFilter && (
          <Badge variant="secondary" className="gap-1">
            Deal: {dealIdFilter}
            <button
              className="ml-1 hover:text-destructive"
              onClick={() => {
                setDealIdFilter('');
                updateUrl({ deal_id: '' });
              }}
            >
              x
            </button>
          </Badge>
        )}
      </div>

      {/* Main Content: Tabs + Detail Panel */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Actions List */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              updateUrl({ status: v === 'all' ? '' : v });
            }}
            className="flex flex-col h-full"
          >
            <TabsList className="shrink-0 flex-wrap h-auto">
              {STATUS_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="gap-1">
                  <Icon className="h-4 w-4" />
                  {label}
                  {statusCounts[value] > 0 && (
                    <Badge
                      variant={value === 'FAILED' ? 'destructive' : 'secondary'}
                      className="ml-1"
                    >
                      {statusCounts[value]}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 min-h-0 mt-4">
              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-4 p-3 mb-4 bg-muted/50 rounded-lg border border-muted-foreground/20">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkArchive}
                      disabled={isClearing}
                    >
                      <IconArchive className="h-4 w-4 mr-2" />
                      Archive Selected
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={isClearing}
                    >
                      <IconTrash className="h-4 w-4 mr-2" />
                      Delete Selected
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : filteredActions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <IconBolt className="h-12 w-12 mb-2 opacity-50" />
                  <p>No actions found</p>
                  {(searchQuery || typeFilter || dealIdFilter) && (
                    <Button
                      variant="link"
                      onClick={() => {
                        setSearchQuery('');
                        setTypeFilter('');
                        setDealIdFilter('');
                        updateUrl({ q: '', type: '', deal_id: '' });
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-full pr-4">
                  {/* Select All Header */}
                  <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground border-b mb-2">
                    <Checkbox
                      checked={selectedIds.size === filteredActions.length && filteredActions.length > 0}
                      onCheckedChange={selectAllFiltered}
                    />
                    <span>Select All ({filteredActions.length})</span>
                  </div>

                  <div className="space-y-2">
                    {filteredActions.map((action) => (
                      <div key={action.action_id} className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedIds.has(action.action_id)}
                          onCheckedChange={() => toggleSelectAction(action.action_id)}
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <ActionCard
                            action={action}
                            capability={getCapabilityForAction(action)}
                            compact
                            selected={action.action_id === selectedActionId}
                            onSelect={() => {
                              setSelectedActionId(action.action_id);
                              updateUrl({ selected: action.action_id });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </Tabs>
        </div>

        {/* Detail Panel */}
        <div className="hidden lg:block">
          {selectedAction ? (
            <ScrollArea className="h-full">
              <ActionCard
                action={selectedAction}
                capability={selectedCapability}
                onApprove={handleApprove}
                onRun={handleRun}
                onCancel={handleCancel}
                onRetry={handleRetry}
                onUpdateInputs={handleUpdateInputs}
                onRefresh={handleRefresh}
              />
            </ScrollArea>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground py-12">
                <IconBolt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select an action to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Mobile: Show selected action in expanded view */}
      {selectedAction && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-background border-t shadow-lg max-h-[60vh] overflow-y-auto p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Action Details</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedActionId(null);
                updateUrl({ selected: '' });
              }}
            >
              Close
            </Button>
          </div>
          <ActionCard
            action={selectedAction}
            capability={selectedCapability}
            onApprove={handleApprove}
            onRun={handleRun}
            onCancel={handleCancel}
            onRetry={handleRetry}
            onUpdateInputs={handleUpdateInputs}
            onRefresh={handleRefresh}
          />
        </div>
      )}

      {/* Create Action Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Action</DialogTitle>
            <DialogDescription>
              Select a capability and configure the action inputs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Capability Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Capability</label>
              <Select
                value={createCapability?.capability_id || '__none__'}
                onValueChange={(v) => {
                  const cap = capabilities.find(c => c.capability_id === v);
                  setCreateCapability(cap || null);
                  setCreateInputs({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a capability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Select a capability</span>
                  </SelectItem>
                  {capabilities.map((cap) => (
                    <SelectItem key={cap.capability_id} value={cap.capability_id}>
                      <div>
                        <span className="font-medium">{cap.title}</span>
                        <Badge
                          variant={
                            cap.risk_level === 'high'
                              ? 'destructive'
                              : cap.risk_level === 'medium'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="ml-2"
                        >
                          {cap.risk_level}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createCapability && (
                <p className="text-sm text-muted-foreground">{createCapability.description}</p>
              )}
            </div>

            {/* Deal ID */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Deal ID</label>
              <Input
                placeholder="DEAL-2025-001"
                value={createDealId}
                onChange={(e) => setCreateDealId(e.target.value)}
              />
            </div>

            {/* Dynamic Inputs */}
            {createCapability && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Inputs</label>
                <ActionInputForm
                  schema={createCapability.input_schema}
                  values={createInputs}
                  onChange={setCreateInputs}
                  disabled={creating}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setCreateCapability(null);
                setCreateInputs({});
                setCreateDealId('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAction}
              disabled={!createCapability || !createDealId.trim() || creating}
            >
              {creating ? (
                <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <IconPlus className="h-4 w-4 mr-1" />
              )}
              Create Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Completed Confirmation Dialog */}
      <Dialog open={!!showClearConfirm} onOpenChange={(open) => !open && setShowClearConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {showClearConfirm?.operation === 'archive' ? 'Archive' : 'Delete'} Completed Actions
            </DialogTitle>
            <DialogDescription>
              {showClearConfirm?.operation === 'archive'
                ? 'Archived actions will be hidden from the default view but can be restored later.'
                : 'This will permanently delete the selected actions. This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {showClearConfirm?.age === 'all' && 'This will affect all completed actions.'}
              {showClearConfirm?.age === '7d' && 'This will affect completed actions older than 7 days.'}
              {showClearConfirm?.age === '30d' && 'This will affect completed actions older than 30 days.'}
            </p>
            <div className="mt-4 p-3 rounded-lg bg-muted">
              <p className="text-sm font-medium">
                {actions.filter(a => {
                  if (a.status !== 'COMPLETED') return false;
                  if (showClearConfirm?.age === 'all') return true;
                  const completedAt = a.completed_at ? new Date(a.completed_at) : null;
                  if (!completedAt) return false;
                  const daysDiff = Math.floor((Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
                  if (showClearConfirm?.age === '7d') return daysDiff >= 7;
                  if (showClearConfirm?.age === '30d') return daysDiff >= 30;
                  return false;
                }).length} action(s) will be {showClearConfirm?.operation === 'archive' ? 'archived' : 'deleted'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={showClearConfirm?.operation === 'delete' ? 'destructive' : 'default'}
              onClick={() => showClearConfirm && handleClearCompleted(showClearConfirm.operation, showClearConfirm.age)}
              disabled={isClearing}
            >
              {isClearing ? (
                <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : showClearConfirm?.operation === 'archive' ? (
                <IconArchive className="h-4 w-4 mr-1" />
              ) : (
                <IconTrash className="h-4 w-4 mr-1" />
              )}
              {showClearConfirm?.operation === 'archive' ? 'Archive' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
