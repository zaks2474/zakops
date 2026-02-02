'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendarEvent,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconDatabase,
  IconFileText,
  IconHistory,
  IconLink,
  IconLock,
  IconMessage,
  IconRefresh,
  IconSend,
  IconBolt,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  getDeal,
  getDealEvents,
  getDealCaseFile,
  getDealEnrichment,
  getDealMaterials,
  getKineticActions,
  getCapabilities,
  approveKineticAction,
  runKineticAction,
  cancelKineticAction,
  retryKineticAction,
  updateKineticActionInputs,
  transitionDeal,
  addDealNote,
  type DealDetail,
  type DealEvent,
  type DealEnrichment,
  type MaterialLink,
  type DealMaterials,
  type KineticAction,
  type Capability,
} from '@/lib/api';
import { toast } from 'sonner';
import { ActionCard } from '@/components/actions/action-card';
import { format } from 'date-fns';

const STAGE_COLORS: Record<string, string> = {
  inbound: 'bg-slate-500',
  screening: 'bg-blue-500',
  qualified: 'bg-cyan-500',
  loi: 'bg-teal-500',
  diligence: 'bg-green-500',
  closing: 'bg-emerald-500',
  portfolio: 'bg-green-700',
  junk: 'bg-red-700',
  archived: 'bg-gray-500',
};

export default function DealWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;

  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [events, setEvents] = useState<DealEvent[]>([]);
  const [caseFile, setCaseFile] = useState<unknown>(null);
  const [enrichment, setEnrichment] = useState<DealEnrichment | null>(null);
  const [materials, setMaterials] = useState<DealMaterials | null>(null);
  const [actions, setActions] = useState<KineticAction[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transition dialog state
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState('');
  const [transitionReason, setTransitionReason] = useState('');
  const [transitionApprovedBy, setTransitionApprovedBy] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  // Note dialog state
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dealData, eventsData, caseFileData, enrichmentData, materialsData, actionsData, capabilitiesData] = await Promise.all([
        getDeal(dealId),
        getDealEvents(dealId, 50),
        getDealCaseFile(dealId),
        getDealEnrichment(dealId),
        getDealMaterials(dealId),
        getKineticActions({ deal_id: dealId }),
        getCapabilities(),
      ]);

      if (!dealData) {
        setError('Deal not found');
        return;
      }

      setDeal(dealData);
      setEvents(eventsData);
      setCaseFile(caseFileData);
      setEnrichment(enrichmentData);
      setMaterials(materialsData);
      setActions(actionsData);
      setCapabilities(capabilitiesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deal');
    } finally {
      setLoading(false);
    }
  };

  // Action handlers for Kinetic Actions
  const getCapabilityForAction = (action: KineticAction): Capability | undefined => {
    return capabilities.find(c => c.capability_id === action.capability_id || c.action_type === action.action_type);
  };

  const handleApprove = async (actionId: string, approvedBy: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await approveKineticAction(actionId, approvedBy);
      if (result.success) {
        toast.success('Action approved');
        fetchData();
        return { success: true };
      } else {
        const error = result.error || 'Failed to approve action';
        toast.error(error);
        return { success: false, error };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to approve action';
      toast.error(error);
      return { success: false, error };
    }
  };

  const handleRun = async (actionId: string): Promise<{ success: boolean; error?: string; reason?: string }> => {
    try {
      const result = await runKineticAction(actionId);
      if (result.success) {
        toast.success('Action started');
        fetchData();
        return { success: true };
      } else {
        const error = result.error || 'Failed to run action';
        // Don't show toast for idempotency cases
        if (result.reason !== 'already_processing' && result.reason !== 'already_completed') {
          toast.error(error);
        }
        return { success: false, error, reason: result.reason };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to run action';
      toast.error(error);
      return { success: false, error };
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
        const error = result.error || 'Failed to cancel action';
        toast.error(error);
        return { success: false, error };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to cancel action';
      toast.error(error);
      return { success: false, error };
    }
  };

  const handleRetry = async (actionId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await retryKineticAction(actionId);
      if (result.success) {
        toast.success('Action retry started');
        fetchData();
        return { success: true };
      } else {
        const error = result.error || 'Failed to retry action';
        toast.error(error);
        return { success: false, error };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to retry action';
      toast.error(error);
      return { success: false, error };
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
        const error = result.error || 'Failed to update inputs';
        toast.error(error);
        return { success: false, error };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to update inputs';
      toast.error(error);
      return { success: false, error };
    }
  };

  useEffect(() => {
    fetchData();
  }, [dealId]);

  const handleTransition = async () => {
    if (!selectedTransition || !transitionReason || !transitionApprovedBy) return;

    setTransitioning(true);
    try {
      const result = await transitionDeal(dealId, selectedTransition, transitionReason, transitionApprovedBy);
      if (result.success) {
        setShowTransitionDialog(false);
        setSelectedTransition('');
        setTransitionReason('');
        setTransitionApprovedBy('');
        fetchData(); // Refresh data
      } else {
        alert(`Transition failed: ${result.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransitioning(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;

    setAddingNote(true);
    try {
      const result = await addDealNote(dealId, noteContent);
      if (result.success) {
        setShowNoteDialog(false);
        setNoteContent('');
        fetchData(); // Refresh to show new event
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className='flex flex-1 flex-col min-h-0 gap-4 p-4 md:p-6'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-4 w-96' />
        <div className='grid gap-4 md:grid-cols-3'>
          <div className='md:col-span-2 space-y-4'>
            <Skeleton className='h-64 w-full' />
            <Skeleton className='h-96 w-full' />
          </div>
          <div className='space-y-4'>
            <Skeleton className='h-48 w-full' />
            <Skeleton className='h-48 w-full' />
          </div>
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className='flex flex-1 flex-col min-h-0 items-center justify-center gap-4 p-8'>
        <IconAlertTriangle className='h-12 w-12 text-destructive' />
        <h2 className='text-xl font-semibold'>Failed to load deal</h2>
        <p className='text-muted-foreground max-w-md text-center'>
          {error || `Deal "${dealId}" not found or could not be loaded`}
        </p>
        <p className='text-xs text-muted-foreground'>
          Endpoint: /api/deals/{dealId}
        </p>
        <div className='flex gap-2'>
          <Button onClick={() => router.push('/deals')} variant='outline'>
            <IconArrowLeft className='mr-2 h-4 w-4' />
            Back to Deals
          </Button>
          <Button onClick={fetchData} variant='outline'>
            <IconRefresh className='mr-2 h-4 w-4' />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const allowedTransitions = deal.state_machine?.allowed_transitions || [];

  return (
    <div className='flex flex-1 flex-col min-h-0 overflow-y-auto gap-4 p-4 md:p-6' data-testid='deal-detail-scroll'>
      {/* Header */}
      <div className='flex items-start justify-between shrink-0'>
        <div>
          <div className='flex items-center gap-2 mb-2'>
            <Button variant='ghost' size='sm' onClick={() => router.push('/deals')}>
              <IconArrowLeft className='mr-2 h-4 w-4' />
              Deals
            </Button>
          </div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {deal.canonical_name || deal.deal_id}
          </h1>
          <div className='flex items-center gap-2 mt-1'>
            <Badge variant='outline' className='gap-1'>
              <span
                className={`h-2 w-2 rounded-full ${STAGE_COLORS[deal.stage] || 'bg-gray-500'}`}
              />
              {deal.stage}
            </Badge>
            <Badge variant='secondary'>{deal.status}</Badge>
            {deal.metadata?.priority && (
              <Badge
                variant={deal.metadata.priority === 'HIGHEST' ? 'destructive' : 'secondary'}
              >
                {deal.metadata.priority}
              </Badge>
            )}
            <span className='text-sm text-muted-foreground'>{deal.deal_id}</span>
          </div>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => setShowNoteDialog(true)}>
            Add Note
          </Button>
          <Link href={`/chat?deal_id=${dealId}`}>
            <Button variant='outline' size='sm'>
              <IconMessage className='mr-2 h-4 w-4' />
              Chat
            </Button>
          </Link>
          <Button onClick={fetchData} variant='outline' size='sm'>
            <IconRefresh className='mr-2 h-4 w-4' />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className='grid gap-4 md:grid-cols-3'>
        {/* Left Column - Main Content */}
        <div className='md:col-span-2 space-y-4'>
          {/* Tabs */}
          <Tabs defaultValue='overview'>
            <TabsList>
              <TabsTrigger value='overview'>Overview</TabsTrigger>
              <TabsTrigger value='actions'>
                <IconBolt className='h-4 w-4 mr-1' />
                Actions {actions.length > 0 ? `(${actions.length})` : ''}
              </TabsTrigger>
              <TabsTrigger value='pipeline'>
                <IconPlayerPlay className='h-4 w-4 mr-1' />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value='materials'>
                Materials {materials?.correspondence?.length ? `(${materials.correspondence.length})` : ''}
              </TabsTrigger>
              <TabsTrigger value='case-file'>Case File</TabsTrigger>
              <TabsTrigger value='events'>Events ({events.length})</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value='overview' className='space-y-4'>
              <div className='grid gap-4 md:grid-cols-2'>
                {/* Deal Info */}
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-base'>Deal Information</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>Stage</span>
                      <span className='font-medium'>{deal.stage}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>Status</span>
                      <span className='font-medium'>{deal.status}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>Created</span>
                      <span className='font-medium'>
                        {deal.created_at ? format(new Date(deal.created_at), 'MMM d, yyyy') : '-'}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>Updated</span>
                      <span className='font-medium'>
                        {deal.updated_at ? format(new Date(deal.updated_at), 'MMM d, yyyy') : '-'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Broker Info */}
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-base'>Broker</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>Name</span>
                      <span className='font-medium'>{deal.broker?.name || '-'}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>Email</span>
                      <span className='font-medium text-sm'>{deal.broker?.email || '-'}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>Company</span>
                      <span className='font-medium'>{deal.broker?.company || '-'}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Financials */}
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-base'>Financials</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>Asking Price</span>
                      <span className='font-medium'>
                        {deal.metadata?.asking_price != null
                          ? `$${deal.metadata.asking_price.toLocaleString()}`
                          : <span className='text-muted-foreground'>TBD</span>}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>EBITDA</span>
                      <span className='font-medium'>
                        {deal.metadata?.ebitda != null
                          ? `$${deal.metadata.ebitda.toLocaleString()}`
                          : <span className='text-muted-foreground'>TBD</span>}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>NDA Status</span>
                      <span className='font-medium'>
                        {deal.metadata?.nda_status || <span className='text-muted-foreground'>Unknown</span>}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>CIM Received</span>
                      <span className='font-medium'>
                        {deal.metadata?.cim_received === true ? 'Yes' : deal.metadata?.cim_received === false ? 'No' : <span className='text-muted-foreground'>Unknown</span>}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Company Info */}
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-base'>Company</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>Sector</span>
                      <span className='font-medium'>
                        {deal.company_info?.sector || <span className='text-muted-foreground'>Unknown</span>}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>Location</span>
                      <span className='font-medium'>
                        {deal.company_info?.location
                          ? `${deal.company_info.location.city || 'Unknown'}, ${deal.company_info.location.state || 'Unknown'}`
                          : <span className='text-muted-foreground'>Unknown</span>}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Actions Tab */}
            <TabsContent value='actions'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <IconBolt className='h-5 w-5' />
                    Actions for this Deal
                  </CardTitle>
                  <CardDescription>
                    Workflow actions - approve, execute, and track
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {actions.length === 0 ? (
                    <div className='text-center py-8 text-muted-foreground'>
                      <IconBolt className='h-12 w-12 mx-auto mb-2 opacity-50' />
                      <p>No actions for this deal</p>
                      <Link href={`/actions?deal_id=${dealId}`}>
                        <Button variant='link'>Go to Actions Command Center</Button>
                      </Link>
                    </div>
                  ) : (
                    <ScrollArea className='h-[500px]'>
                      <div className='space-y-4'>
                        {actions.map((action) => (
                          <ActionCard
                            key={action.action_id}
                            action={action}
                            capability={getCapabilityForAction(action)}
                            onApprove={handleApprove}
                            onRun={handleRun}
                            onCancel={handleCancel}
                            onRetry={handleRetry}
                            onUpdateInputs={handleUpdateInputs}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  {actions.length > 0 && (
                    <div className='mt-4 pt-4 border-t'>
                      <Link href={`/actions?deal_id=${dealId}`}>
                        <Button variant='outline' size='sm'>
                          <IconBolt className='mr-2 h-4 w-4' />
                          View in Command Center
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pipeline Outputs Tab */}
            <TabsContent value='pipeline'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <IconPlayerPlay className='h-5 w-5' />
                    Pipeline Outputs
                  </CardTitle>
                  <CardDescription>
                    Automated pipeline actions and their outputs. These actions run after email approval to extract, enrich, and index materials.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Filter for pipeline actions (follow-on actions that run automatically)
                    const pipelineTypes = [
                      'DEAL.APPEND_EMAIL_MATERIALS',
                      'DEAL.EXTRACT_EMAIL_ARTIFACTS',
                      'DEAL.ENRICH_MATERIALS',
                      'DEAL.DEDUPE_AND_PLACE_MATERIALS',
                      'DEAL.BACKFILL_SENDER_HISTORY',
                      'RAG.REINDEX_DEAL',
                    ];
                    const pipelineActions = actions.filter(a => pipelineTypes.includes(a.action_type || ''));

                    if (pipelineActions.length === 0) {
                      return (
                        <div className='text-center py-8 text-muted-foreground'>
                          <IconPlayerPlay className='h-12 w-12 mx-auto mb-2 opacity-50' />
                          <p>No pipeline actions for this deal yet</p>
                          <p className='text-sm mt-2'>
                            Pipeline actions are created automatically when emails are approved from Quarantine.
                          </p>
                        </div>
                      );
                    }

                    // Group by parent chain for better visualization
                    const completedCount = pipelineActions.filter(a => a.status === 'COMPLETED').length;
                    const pendingCount = pipelineActions.filter(a => a.status === 'READY' || a.status === 'PENDING_APPROVAL').length;
                    const failedCount = pipelineActions.filter(a => a.status === 'FAILED').length;

                    return (
                      <div className='space-y-4'>
                        {/* Summary */}
                        <div className='flex items-center gap-4 text-sm'>
                          <Badge variant='outline' className='gap-1'>
                            <IconCheck className='h-3 w-3 text-green-600' />
                            {completedCount} completed
                          </Badge>
                          {pendingCount > 0 && (
                            <Badge variant='outline' className='gap-1'>
                              <IconClock className='h-3 w-3 text-amber-600' />
                              {pendingCount} pending
                            </Badge>
                          )}
                          {failedCount > 0 && (
                            <Badge variant='destructive' className='gap-1'>
                              <IconAlertTriangle className='h-3 w-3' />
                              {failedCount} failed
                            </Badge>
                          )}
                        </div>

                        <Separator />

                        {/* Pipeline Actions List */}
                        <ScrollArea className='h-[450px]'>
                          <div className='space-y-3'>
                            {pipelineActions.map((action) => {
                              const outputs = (action.outputs || {}) as Record<string, unknown>;
                              const hasOutputs = Object.keys(outputs).length > 0;

                              return (
                                <Collapsible key={action.action_id} defaultOpen={hasOutputs}>
                                  <div className='border rounded-lg'>
                                    <CollapsibleTrigger className='flex items-center gap-3 w-full p-3 hover:bg-muted/50 text-left'>
                                      <IconChevronRight className='h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90' />
                                      <div className='flex-1 min-w-0'>
                                        <div className='flex items-center gap-2'>
                                          <span className='font-medium text-sm truncate'>{action.title || action.action_type}</span>
                                          <Badge
                                            variant={
                                              action.status === 'COMPLETED' ? 'secondary' :
                                              action.status === 'FAILED' ? 'destructive' :
                                              action.status === 'PROCESSING' ? 'default' : 'outline'
                                            }
                                            className='text-xs'
                                          >
                                            {action.status}
                                          </Badge>
                                        </div>
                                        <div className='text-xs text-muted-foreground mt-0.5'>
                                          {action.action_type} &bull; {action.completed_at ? format(new Date(action.completed_at), 'MMM d, HH:mm') : 'pending'}
                                        </div>
                                      </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <div className='px-3 pb-3 border-t pt-3 bg-muted/30'>
                                        {!hasOutputs ? (
                                          <p className='text-sm text-muted-foreground'>No outputs recorded</p>
                                        ) : (
                                          <div className='space-y-2'>
                                            <div className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>Outputs</div>
                                            <div className='grid gap-2 text-sm'>
                                              {Object.entries(outputs).map(([key, value]) => {
                                                // Skip internal/chain keys
                                                if (key.startsWith('_')) return null;
                                                // Format value for display
                                                let displayValue: string;
                                                if (typeof value === 'string') {
                                                  displayValue = value.length > 100 ? value.slice(0, 100) + '...' : value;
                                                } else if (Array.isArray(value)) {
                                                  displayValue = `[${value.length} items]`;
                                                } else if (typeof value === 'object' && value !== null) {
                                                  displayValue = JSON.stringify(value).slice(0, 100) + (JSON.stringify(value).length > 100 ? '...' : '');
                                                } else {
                                                  displayValue = String(value);
                                                }

                                                return (
                                                  <div key={key} className='flex items-start gap-2'>
                                                    <span className='font-mono text-xs text-muted-foreground min-w-[120px]'>{key}:</span>
                                                    <span className='text-xs break-all'>{displayValue}</span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </CollapsibleContent>
                                  </div>
                                </Collapsible>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Materials Tab */}
            <TabsContent value='materials'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <IconLink className='h-5 w-5' />
                    Deal Materials
                  </CardTitle>
                  <CardDescription>
                    Filesystem-backed correspondence bundles under <code>07-Correspondence/</code> (append-only). Follow-up emails
                    in the same Gmail thread auto-append via <code>DEAL.APPEND_EMAIL_MATERIALS</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!materials ? (
                    <div className='text-center py-8 text-muted-foreground'>
                      <IconLink className='h-12 w-12 mx-auto mb-2 opacity-50' />
                      <p>No materials view available yet</p>
                      <p className='text-sm mt-2'>
                        This deal may not have a folder yet, or <code>07-Correspondence/</code> has no bundles.
                      </p>
                    </div>
                  ) : (
                    <div className='space-y-4'>
                      <div className='rounded-lg border bg-muted/30 p-3 text-sm'>
                        <div className='text-xs text-muted-foreground mb-1'>Deal folder</div>
                        <div className='font-mono text-xs break-all'>{materials.deal_path}</div>
                      </div>

                      {/* Summary stats */}
                      {(() => {
                        const corr = Array.isArray(materials.correspondence) ? materials.correspondence : [];
                        const aggLinks = materials.aggregate_links as any;
                        const primaryCount = aggLinks?.summary?.primary_count || (Array.isArray(aggLinks?.primary_links) ? aggLinks.primary_links.length : 0);
                        const trackingCount = aggLinks?.summary?.tracking_count || (Array.isArray(aggLinks?.tracking_links) ? aggLinks.tracking_links.length : 0);
                        const pending = Array.isArray(materials.pending_auth) ? materials.pending_auth : [];
                        const attachments = corr.flatMap((b: any) => (Array.isArray(b.attachments) ? b.attachments : []));
                        return (
                          <div className='flex flex-wrap gap-4 text-sm'>
                            <span className='text-muted-foreground'>
                              Bundles: <strong>{corr.length}</strong>
                            </span>
                            <span className='text-muted-foreground'>
                              Links: <strong>{primaryCount}</strong>
                              {trackingCount > 0 && (
                                <span className='text-xs ml-1'>({trackingCount} tracking hidden)</span>
                              )}
                            </span>
                            {pending.length > 0 && (
                              <span className='text-amber-600'>
                                <IconLock className='inline h-4 w-4 mr-1' />
                                {pending.length} pending-auth
                              </span>
                            )}
                            {attachments.length > 0 && (
                              <span className='text-muted-foreground'>
                                Attachments: <strong>{attachments.length}</strong>
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      <Separator />

                      {/* Pending auth links */}
                      {Array.isArray(materials.pending_auth) && materials.pending_auth.length > 0 && (
                        <div className='space-y-2'>
                          <h4 className='font-medium flex items-center gap-2'>
                            <IconLock className='h-4 w-4 text-amber-600' />
                            Pending-auth links
                          </h4>
                          <div className='space-y-2'>
                            {materials.pending_auth.slice(0, 25).map((l: any, idx: number) => (
                              <div key={`${l.url}-${idx}`} className='rounded border p-2 text-sm'>
                                <div className='flex items-start justify-between gap-2'>
                                  <div className='min-w-0 flex-1'>
                                    <div className='text-xs text-muted-foreground'>
                                      {l.type || 'other'}{l.bundle_id ? ` • bundle ${l.bundle_id}` : ''}
                                    </div>
                                    <a
                                      href={l.url}
                                      target='_blank'
                                      rel='noopener noreferrer'
                                      className='text-blue-600 hover:underline text-xs break-all'
                                    >
                                      {l.url}
                                    </a>
                                  </div>
                                  <Badge variant='outline' className='text-amber-600 gap-1 shrink-0'>
                                    <IconLock className='h-3 w-3' />
                                    Auth
                                  </Badge>
                                </div>
                              </div>
                            ))}
                            {materials.pending_auth.length > 25 && (
                              <div className='text-xs text-muted-foreground'>+ {materials.pending_auth.length - 25} more…</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Classified Links */}
                      <div className='space-y-4'>
                        <h4 className='font-medium'>Classified Links</h4>
                        {(() => {
                          const aggLinks = materials.aggregate_links as any;
                          const primaryLinks = Array.isArray(aggLinks?.primary_links) ? aggLinks.primary_links : [];
                          const trackingLinks = Array.isArray(aggLinks?.tracking_links) ? aggLinks.tracking_links : [];
                          const socialLinks = Array.isArray(aggLinks?.social_links) ? aggLinks.social_links : [];
                          const unsubscribeLinks = Array.isArray(aggLinks?.unsubscribe_links) ? aggLinks.unsubscribe_links : [];
                          const summary = aggLinks?.summary || {};

                          const totalLinks = primaryLinks.length + trackingLinks.length + socialLinks.length + unsubscribeLinks.length;

                          if (totalLinks === 0) {
                            return <p className='text-sm text-muted-foreground'>No links yet</p>;
                          }

                          return (
                            <div className='space-y-4'>
                              {/* Summary badges */}
                              <div className='flex flex-wrap gap-2 text-xs'>
                                <Badge variant='secondary'>
                                  {primaryLinks.length} primary
                                </Badge>
                                {trackingLinks.length > 0 && (
                                  <Badge variant='outline' className='text-muted-foreground'>
                                    {trackingLinks.length} tracking (hidden)
                                  </Badge>
                                )}
                                {socialLinks.length > 0 && (
                                  <Badge variant='outline' className='text-muted-foreground'>
                                    {socialLinks.length} social
                                  </Badge>
                                )}
                                {unsubscribeLinks.length > 0 && (
                                  <Badge variant='outline' className='text-muted-foreground'>
                                    {unsubscribeLinks.length} unsubscribe
                                  </Badge>
                                )}
                                {summary.duplicates_removed > 0 && (
                                  <Badge variant='outline' className='text-green-600'>
                                    {summary.duplicates_removed} dupes removed
                                  </Badge>
                                )}
                              </div>

                              {/* Primary links - always shown */}
                              {primaryLinks.length > 0 && (
                                <div>
                                  <div className='text-sm font-medium mb-2'>
                                    Primary Links ({primaryLinks.length})
                                  </div>
                                  <div className='space-y-1'>
                                    {primaryLinks.slice(0, 15).map((l: any, idx: number) => (
                                      <div key={`${l.url || l.canonical_url}-${idx}`} className='rounded border px-2 py-1 text-xs'>
                                        <div className='flex items-start justify-between gap-2'>
                                          <a
                                            href={l.url || l.canonical_url}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='text-blue-600 hover:underline break-all'
                                          >
                                            {l.url || l.canonical_url}
                                          </a>
                                          {l.category && l.category !== 'other' && (
                                            <Badge variant='outline' className='text-xs shrink-0'>
                                              {l.category}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                    {primaryLinks.length > 15 && (
                                      <div className='text-xs text-muted-foreground'>+ {primaryLinks.length - 15} more…</div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Tracking links - collapsible */}
                              {trackingLinks.length > 0 && (
                                <Collapsible>
                                  <CollapsibleTrigger className='flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground'>
                                    <IconChevronRight className='h-4 w-4 transition-transform group-data-[state=open]:rotate-90' />
                                    Show {trackingLinks.length} tracking links
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className='mt-2'>
                                    <div className='space-y-1 border-l-2 border-muted pl-3'>
                                      {trackingLinks.slice(0, 20).map((l: any, idx: number) => (
                                        <div key={`tracking-${idx}`} className='text-xs text-muted-foreground truncate'>
                                          {(l.url || l.canonical_url || '').slice(0, 80)}...
                                        </div>
                                      ))}
                                      {trackingLinks.length > 20 && (
                                        <div className='text-xs text-muted-foreground'>+ {trackingLinks.length - 20} more…</div>
                                      )}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {/* Social links - collapsible */}
                              {socialLinks.length > 0 && (
                                <Collapsible>
                                  <CollapsibleTrigger className='flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground'>
                                    <IconChevronRight className='h-4 w-4 transition-transform group-data-[state=open]:rotate-90' />
                                    Show {socialLinks.length} social links
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className='mt-2'>
                                    <div className='space-y-1'>
                                      {socialLinks.map((l: any, idx: number) => (
                                        <div key={`social-${idx}`} className='rounded border px-2 py-1 text-xs'>
                                          <a
                                            href={l.url || l.canonical_url}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='text-blue-600 hover:underline break-all'
                                          >
                                            {l.url || l.canonical_url}
                                          </a>
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {/* Unsubscribe links - collapsible */}
                              {unsubscribeLinks.length > 0 && (
                                <Collapsible>
                                  <CollapsibleTrigger className='flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground'>
                                    <IconChevronRight className='h-4 w-4 transition-transform group-data-[state=open]:rotate-90' />
                                    Show {unsubscribeLinks.length} unsubscribe links
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className='mt-2'>
                                    <div className='space-y-1 text-xs text-muted-foreground'>
                                      {unsubscribeLinks.map((l: any, idx: number) => (
                                        <div key={`unsub-${idx}`} className='truncate'>
                                          {l.url || l.canonical_url}
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      <Separator />

                      {/* Correspondence bundles */}
                      <div className='space-y-2'>
                        <h4 className='font-medium'>Correspondence bundles</h4>
                        {Array.isArray(materials.correspondence) && materials.correspondence.length > 0 ? (
                          <div className='space-y-2'>
                            {materials.correspondence.map((b: any, idx: number) => (
                              <details key={`${b.bundle_id}-${idx}`} className='rounded-lg border p-3'>
                                <summary className='cursor-pointer list-none'>
                                  <div className='flex items-start justify-between gap-2'>
                                    <div className='min-w-0 flex-1'>
                                      <div className='font-medium truncate'>{b.subject || b.bundle_id || 'Bundle'}</div>
                                      <div className='text-xs text-muted-foreground truncate'>
                                        {b.from ? `From: ${b.from}` : '—'}{b.date ? ` • ${b.date}` : ''}
                                      </div>
                                      <div className='flex flex-wrap items-center gap-2 mt-2'>
                                        <Badge variant='outline' className='text-xs'>
                                          {b.format || 'bundle'}
                                        </Badge>
                                        {Array.isArray(b.attachments) && b.attachments.length > 0 && (
                                          <Badge variant='secondary' className='text-xs'>
                                            {b.attachments.length} attachment{b.attachments.length === 1 ? '' : 's'}
                                          </Badge>
                                        )}
                                        {Array.isArray((b.links as any)?.all) && (b.links as any).all.length > 0 && (
                                          <Badge variant='outline' className='text-xs'>
                                            {(b.links as any).all.length} link{(b.links as any).all.length === 1 ? '' : 's'}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </summary>

                                <div className='mt-3 space-y-3'>
                                  <div className='text-xs text-muted-foreground'>
                                    Path: <span className='font-mono break-all'>{b.bundle_path}</span>
                                  </div>

                                  {Array.isArray(b.attachments) && b.attachments.length > 0 && (
                                    <div className='space-y-1'>
                                      <div className='text-sm font-medium'>Attachments</div>
                                      <div className='space-y-1'>
                                        {b.attachments.map((a: any, aIdx: number) => (
                                          <div key={`${a.filename}-${aIdx}`} className='rounded border px-2 py-1 text-xs'>
                                            <div className='flex items-center justify-between gap-2'>
                                              <span className='truncate'>{a.filename}</span>
                                              {a.size_bytes ? (
                                                <span className='text-muted-foreground shrink-0'>
                                                  {Math.round(Number(a.size_bytes) / 1024)} KB
                                                </span>
                                              ) : null}
                                            </div>
                                            {a.path && (
                                              <div className='text-muted-foreground font-mono break-all mt-1'>{a.path}</div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {Array.isArray((b.links as any)?.all) && (b.links as any).all.length > 0 && (
                                    <div className='space-y-1'>
                                      <div className='text-sm font-medium'>Links</div>
                                      <div className='space-y-1'>
                                        {(b.links as any).all.slice(0, 12).map((l: any, lIdx: number) => (
                                          <div key={`${l.url}-${lIdx}`} className='rounded border px-2 py-1 text-xs'>
                                            <a
                                              href={l.url}
                                              target='_blank'
                                              rel='noopener noreferrer'
                                              className='text-blue-600 hover:underline break-all'
                                            >
                                              {l.url}
                                            </a>
                                          </div>
                                        ))}
                                        {(b.links as any).all.length > 12 && (
                                          <div className='text-xs text-muted-foreground'>
                                            + {(b.links as any).all.length - 12} more…
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </details>
                            ))}
                          </div>
                        ) : (
                          <p className='text-sm text-muted-foreground'>No correspondence bundles yet</p>
                        )}
                      </div>

                      {/* Legacy enrichment (optional) */}
                      {enrichment && enrichment.materials.total > 0 && (
                        <>
                          <Separator />
                          <div className='space-y-2'>
                            <h4 className='font-medium'>Legacy enrichment links</h4>
                            <p className='text-xs text-muted-foreground'>
                              This section reflects legacy registry enrichment. The filesystem-backed materials above are the source of truth.
                            </p>
                            <ScrollArea className='h-[260px]'>
                              <div className='space-y-3 pr-2'>
                                {Object.entries(enrichment.materials.by_type).map(([linkType, links]) => (
                                  <div key={linkType}>
                                    <h5 className='text-sm font-medium mb-1 capitalize'>
                                      {linkType.replace(/_/g, ' ')} ({(links as MaterialLink[]).length})
                                    </h5>
                                    <div className='space-y-1'>
                                      {(links as MaterialLink[]).slice(0, 8).map((link, idx) => (
                                        <div key={`${link.normalized_url}-${idx}`} className='rounded border px-2 py-1 text-xs'>
                                          <a
                                            href={link.url}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='text-blue-600 hover:underline break-all'
                                          >
                                            {link.url}
                                          </a>
                                        </div>
                                      ))}
                                      {(links as MaterialLink[]).length > 8 && (
                                        <div className='text-xs text-muted-foreground'>+ {(links as MaterialLink[]).length - 8} more…</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Case File Tab */}
            <TabsContent value='case-file'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <IconFileText className='h-5 w-5' />
                    Case File
                  </CardTitle>
                  <CardDescription>
                    Projected deal state from event history
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {caseFile ? (
                    <ScrollArea className='h-[500px]'>
                      <pre className='text-sm bg-muted p-4 rounded-lg overflow-auto'>
                        {JSON.stringify(caseFile, null, 2)}
                      </pre>
                    </ScrollArea>
                  ) : (
                    <div className='text-center py-8 text-muted-foreground'>
                      <IconFileText className='h-12 w-12 mx-auto mb-2 opacity-50' />
                      <p>No case file available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value='events'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <IconHistory className='h-5 w-5' />
                    Event History
                  </CardTitle>
                  <CardDescription>
                    {events.length} event{events.length !== 1 ? 's' : ''} recorded
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {events.length === 0 ? (
                    <div className='text-center py-8 text-muted-foreground'>
                      <IconHistory className='h-12 w-12 mx-auto mb-2 opacity-50' />
                      <p>No events recorded</p>
                    </div>
                  ) : (
                    <ScrollArea className='h-[500px]'>
                      <div className='space-y-4'>
                        {events.map((event, i) => (
                          <div key={event.event_id || i} className='relative pl-6 pb-4 border-l-2 border-muted last:pb-0'>
                            <div className='absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-background border-2 border-primary' />
                            <div className='flex items-start justify-between'>
                              <div>
                                <p className='font-medium'>{event.event_type}</p>
                                {event.actor && (
                                  <p className='text-sm text-muted-foreground'>by {event.actor}</p>
                                )}
                              </div>
                              <span className='text-xs text-muted-foreground'>
                                {event.timestamp
                                  ? format(new Date(event.timestamp), 'MMM d, yyyy HH:mm')
                                  : '-'}
                              </span>
                            </div>
                            {event.data && (
                              <pre className='mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32'>
                                {JSON.stringify(event.data, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Actions Rail */}
        <div className='space-y-4'>
          {/* Stage Transitions */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Stage Transitions</CardTitle>
              <CardDescription>
                {deal.state_machine?.advisory_context || 'Move deal to next stage'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allowedTransitions.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  No transitions available (terminal stage)
                </p>
              ) : (
                <div className='flex flex-wrap gap-2'>
                  {allowedTransitions.map((stage) => (
                    <Button
                      key={stage}
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        setSelectedTransition(stage);
                        setShowTransitionDialog(true);
                      }}
                    >
                      {stage}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Actions */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <IconBolt className='h-5 w-5' />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {actions.length === 0 ? (
                <div className='text-center py-4 text-muted-foreground'>
                  <IconBolt className='h-8 w-8 mx-auto mb-2 opacity-50' />
                  <p className='text-sm'>No actions</p>
                </div>
              ) : (
                <ScrollArea className='h-[200px]'>
                  <div className='space-y-2'>
                    {actions.slice(0, 5).map((action) => (
                      <div
                        key={action.action_id}
                        className='rounded-lg border p-2 cursor-pointer hover:bg-accent'
                        onClick={() => router.push(`/actions?deal_id=${dealId}&selected=${action.action_id}`)}
                      >
                        <p className='text-sm font-medium truncate'>{action.title}</p>
                        <p className='text-xs text-muted-foreground'>
                          {format(new Date(action.updated_at), 'MMM d, HH:mm')}
                        </p>
                        <Badge
                          variant={
                            action.status === 'FAILED' ? 'destructive' :
                            action.status === 'PENDING_APPROVAL' ? 'default' :
                            action.status === 'PROCESSING' ? 'secondary' :
                            'outline'
                          }
                          className='mt-1'
                        >
                          {action.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                    {actions.length > 5 && (
                      <p className='text-xs text-muted-foreground text-center'>
                        +{actions.length - 5} more
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Quick Links</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {deal.folder_path && (
                <p className='text-sm'>
                  <span className='text-muted-foreground'>Folder: </span>
                  <code className='text-xs bg-muted px-1 py-0.5 rounded'>
                    {deal.folder_path}
                  </code>
                </p>
              )}
              <Link href={`/actions?deal_id=${dealId}`}>
                <Button variant='outline' size='sm' className='w-full justify-start'>
                  <IconCalendarEvent className='mr-2 h-4 w-4' />
                  View All Actions
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transition Dialog */}
      <Dialog open={showTransitionDialog} onOpenChange={setShowTransitionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transition to {selectedTransition}</DialogTitle>
            <DialogDescription>
              Move this deal from {deal.stage} to {selectedTransition}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label>Reason for transition</Label>
              <Textarea
                placeholder='Describe why this transition is happening...'
                value={transitionReason}
                onChange={(e) => setTransitionReason(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label>Approved by</Label>
              <Input
                placeholder='Your name or ID'
                value={transitionApprovedBy}
                onChange={(e) => setTransitionApprovedBy(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowTransitionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTransition}
              disabled={!transitionReason || !transitionApprovedBy || transitioning}
            >
              {transitioning ? 'Transitioning...' : 'Confirm Transition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note to this deal&apos;s event history
            </DialogDescription>
          </DialogHeader>
          <div className='py-4'>
            <Textarea
              placeholder='Enter your note...'
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowNoteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddNote}
              disabled={!noteContent.trim() || addingNote}
            >
              <IconSend className='mr-2 h-4 w-4' />
              {addingNote ? 'Adding...' : 'Add Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
