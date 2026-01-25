'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconExternalLink,
  IconLink,
  IconLock,
  IconMail,
  IconMailOff,
  IconRefresh,
  IconShare,
  IconTrash,
  IconX
} from '@tabler/icons-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  approveQuarantineItem,
  cancelKineticAction,
  deleteQuarantineItem,
  bulkDeleteQuarantineItems,
  getKineticAction,
  getQuarantinePreview,
  getQuarantineQueue,
  rejectQuarantineItem,
  type QuarantineItem,
  type QuarantinePreview
} from '@/lib/api';
import { format } from 'date-fns';
import { toast } from 'sonner';

const TERMINAL_ACTION_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

export default function QuarantinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSelectedId = searchParams.get('selected') || null;

  const [items, setItems] = useState<QuarantineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedActionId, setSelectedActionId] = useState<string | null>(initialSelectedId);
  const [preview, setPreview] = useState<QuarantinePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [operatorName, setOperatorName] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showFullBody, setShowFullBody] = useState(false);
  const [working, setWorking] = useState(false);

  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const itemsData = await getQuarantineQueue({ limit: 200, offset: 0 });
      setItems(itemsData);
      setSelectedForDelete(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quarantine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('zakops_operator_name');
      if (saved) setOperatorName(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (operatorName.trim()) {
        window.localStorage.setItem('zakops_operator_name', operatorName.trim());
      }
    } catch {
      // ignore
    }
  }, [operatorName]);

  const selectedItem = useMemo(() => {
    if (!selectedActionId) return null;
    return items.find(i => (i.action_id || i.id || i.quarantine_id) === selectedActionId) || null;
  }, [items, selectedActionId]);

  useEffect(() => {
    if (loading) return;
    if (items.length === 0) {
      setSelectedActionId(null);
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const stillExists = selectedActionId && items.some(i => (i.action_id || i.id || i.quarantine_id) === selectedActionId);
    if (!stillExists) {
      const first = items[0];
      setSelectedActionId((first.action_id || first.id || first.quarantine_id) ?? null);
    }
  }, [items, loading, selectedActionId]);

  const loadPreview = async (actionId: string) => {
    setPreviewLoading(true);
    setPreviewError(null);
    setShowFullBody(false);
    try {
      const data = await getQuarantinePreview(actionId);
      setPreview(data);
      if (!data) setPreviewError('Preview not found');
    } catch (err) {
      setPreview(null);
      setPreviewError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedActionId) return;
    loadPreview(selectedActionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedActionId]);

  const pollActionUntilTerminal = async (actionId: string, opts?: { timeoutMs?: number; intervalMs?: number }) => {
    const timeoutMs = opts?.timeoutMs ?? 120_000;
    const intervalMs = opts?.intervalMs ?? 1200;
    const start = Date.now();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const action = await getKineticAction(actionId);
      if (!action) throw new Error(`Action not found: ${actionId}`);
      if (TERMINAL_ACTION_STATUSES.has(action.status)) return action;
      if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for action to complete');
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  };

  const handleApprove = async () => {
    if (!selectedActionId) return;
    if (!operatorName.trim()) {
      toast.error('Enter your name/initials to approve');
      return;
    }

    setWorking(true);
    try {
      const started = await approveQuarantineItem(selectedActionId, operatorName.trim());
      if (!started.success) {
        toast.error(started.error || 'Failed to approve');
        return;
      }

      toast.message('Running approval…');
      const finalAction = await pollActionUntilTerminal(selectedActionId);
      if (finalAction.status !== 'COMPLETED') {
        const errMsg = finalAction.error?.message || 'Approval failed';
        toast.error(errMsg);
        return;
      }

      const dealId = (finalAction.outputs as Record<string, unknown> | null | undefined)?.deal_id as string | undefined;
      if (!dealId) {
        toast.success('Approved (no deal_id returned)');
      } else {
        toast.success(`Deal created: ${dealId}`);
      }

      setItems(prev => prev.filter(i => (i.action_id || i.id || i.quarantine_id) !== selectedActionId));
      setSelectedActionId(null);
      setPreview(null);

      if (dealId) {
        router.push(`/deals/${encodeURIComponent(dealId)}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setWorking(false);
    }
  };

  const handleReject = async () => {
    if (!selectedActionId) return;
    if (!operatorName.trim()) {
      toast.error('Enter your name/initials to reject');
      return;
    }
    if (!preview?.message_id) {
      toast.error('Missing message_id for this item; cannot reject safely');
      return;
    }

    setWorking(true);
    try {
      // Atomic endpoint handles: create reject action, execute it, cancel original
      const result = await rejectQuarantineItem({
        originalActionId: selectedActionId,
        messageId: preview.message_id,
        threadId: preview.thread_id || undefined,
        reason: rejectReason.trim() || undefined,
        rejectedBy: operatorName.trim(),
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to reject');
        return;
      }

      toast.success('Rejected (non-deal)');
      setItems(prev => prev.filter(i => (i.action_id || i.id || i.quarantine_id) !== selectedActionId));
      setSelectedActionId(null);
      setPreview(null);
      setRejectReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setWorking(false);
    }
  };

  const openDeleteDialog = (actionIds: string[]) => {
    setDeleteTargetIds(actionIds);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteTargetIds.length === 0) {
      setDeleteDialogOpen(false);
      return;
    }

    setDeleting(true);
    try {
      const deletedBy = operatorName.trim() || 'operator';
      if (deleteTargetIds.length === 1) {
        await deleteQuarantineItem(deleteTargetIds[0], { deletedBy });
      } else {
        await bulkDeleteQuarantineItems(deleteTargetIds, { deletedBy });
      }

      setItems(prev => prev.filter(i => !deleteTargetIds.includes((i.action_id || i.id || i.quarantine_id || '').toString())));
      setSelectedForDelete(prev => {
        const next = new Set(prev);
        for (const id of deleteTargetIds) next.delete(id);
        return next;
      });

      if (selectedActionId && deleteTargetIds.includes(selectedActionId)) {
        setSelectedActionId(null);
        setPreview(null);
      }

      toast.success(
        deleteTargetIds.length === 1
          ? 'Removed from quarantine'
          : `Removed ${deleteTargetIds.length} items from quarantine`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      fetchData();
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTargetIds([]);
    }
  };

  if (error) {
    return (
      <div className='flex flex-1 flex-col min-h-0 items-center justify-center gap-4 p-8'>
        <IconAlertTriangle className='h-12 w-12 text-destructive' />
        <h2 className='text-xl font-semibold'>Failed to load quarantine</h2>
        <p className='text-muted-foreground'>{error}</p>
        <Button onClick={fetchData} variant='outline'>
          <IconRefresh className='mr-2 h-4 w-4' />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col min-h-0 overflow-hidden gap-4 p-4 md:p-6' data-testid='quarantine-scroll'>
      {/* Header */}
      <div className='flex items-center justify-between shrink-0'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Quarantine</h1>
          <p className='text-muted-foreground'>
            Decision point for deal-signal emails (Approve → create deal; Reject → mark non-deal)
          </p>
        </div>
        <Button onClick={fetchData} variant='outline' size='sm' disabled={loading}>
          <IconRefresh className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className='flex flex-1 min-h-0 gap-4 overflow-hidden'>
        {/* Left: Queue */}
        <Card className='w-full md:w-[420px] flex flex-col min-h-0'>
          <CardHeader className='shrink-0'>
            <CardTitle className='flex items-center gap-2'>
              <IconAlertTriangle className='h-5 w-5' />
              Queue
              {items.length > 0 && (() => {
                const selectedVisible = items.filter(i => {
                  const id = (i.action_id || i.id || i.quarantine_id || '').toString();
                  return id && selectedForDelete.has(id);
                }).length;
                const allVisibleSelected = items.length > 0 && selectedVisible === items.length;
                const someVisibleSelected = selectedVisible > 0 && selectedVisible < items.length;
                const checked: boolean | 'indeterminate' = allVisibleSelected
                  ? true
                  : someVisibleSelected
                  ? 'indeterminate'
                  : false;

                return (
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => {
                      setSelectedForDelete(prev => {
                        const next = new Set(prev);
                        if (allVisibleSelected) {
                          for (const i of items) {
                            const id = (i.action_id || i.id || i.quarantine_id || '').toString();
                            if (id) next.delete(id);
                          }
                        } else {
                          for (const i of items) {
                            const id = (i.action_id || i.id || i.quarantine_id || '').toString();
                            if (id) next.add(id);
                          }
                        }
                        return next;
                      });
                    }}
                    aria-label='Select all quarantine items'
                  />
                );
              })()}
            </CardTitle>
            <CardDescription>
              {loading ? 'Loading…' : `${items.length} item${items.length === 1 ? '' : 's'} pending approval`}
            </CardDescription>
            {selectedForDelete.size > 0 && (
              <div className='flex items-center gap-2 pt-2'>
                <Button
                  variant='destructive'
                  size='sm'
                  onClick={() => openDeleteDialog(Array.from(selectedForDelete))}
                  disabled={loading || deleting || working}
                >
                  <IconTrash className='mr-2 h-4 w-4' />
                  Delete ({selectedForDelete.size})
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setSelectedForDelete(new Set())}
                  disabled={loading || deleting || working}
                >
                  Clear
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className='flex-1 min-h-0'>
            {loading ? (
              <div className='space-y-2'>
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className='h-20 w-full' />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-12 text-muted-foreground'>
                <IconCheck className='h-12 w-12 mb-2 opacity-50 text-green-500' />
                <p className='text-lg font-medium'>All clear!</p>
                <p className='text-sm'>No items in quarantine</p>
              </div>
            ) : (
              <ScrollArea className='h-full'>
                <div className='space-y-2 pr-2'>
                  {items.map((item, i) => {
                    const id = (item.action_id || item.id || item.quarantine_id || String(i)).toString();
                    const isSelected = id === selectedActionId;
                    const isChecked = selectedForDelete.has(id);
                    const subj = item.email_subject || item.subject || 'Unknown subject';
                    const from = item.sender || item.from || 'Unknown sender';
                    const received = item.received_at || item.timestamp;
                    return (
                      <div
                        key={id}
                        className={[
                          'w-full text-left rounded-lg border p-3 transition-colors',
                          isSelected ? 'bg-accent border-accent' : 'hover:bg-accent/50',
                        ].join(' ')}
                      >
                        <div className='flex items-start gap-2'>
                          <div onClick={(e) => e.stopPropagation()} className='pt-0.5'>
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => {
                                setSelectedForDelete(prev => {
                                  const next = new Set(prev);
                                  if (next.has(id)) next.delete(id);
                                  else next.add(id);
                                  return next;
                                });
                              }}
                              aria-label={`Select quarantine item ${id}`}
                            />
                          </div>

                          <button
                            className='min-w-0 flex-1 text-left'
                            onClick={() => setSelectedActionId(id)}
                          >
                            <p className='font-medium truncate'>{subj}</p>
                            <p className='text-sm text-muted-foreground truncate'>From: {from}</p>
                            <div className='flex flex-wrap items-center gap-2 mt-2'>
                              {item.urgency && (
                                <Badge variant={item.urgency === 'high' ? 'destructive' : 'secondary'} className='text-xs'>
                                  {item.urgency}
                                </Badge>
                              )}
                              {item.classification && (
                                <Badge variant='outline' className='text-xs'>
                                  {item.classification}
                                </Badge>
                              )}
                              <Badge variant='outline' className='text-xs'>
                                {item.status || 'PENDING'}
                              </Badge>
                              <span className='text-xs text-muted-foreground'>
                                {received ? format(new Date(received), 'MMM d, HH:mm') : '-'}
                              </span>
                            </div>
                          </button>

                          <div onClick={(e) => e.stopPropagation()} className='shrink-0'>
                            <Button
                              variant='ghost'
                              size='icon'
                              onClick={() => openDeleteDialog([id])}
                              aria-label={`Delete quarantine item ${id}`}
                              disabled={deleting || working}
                            >
                              <IconTrash className='h-4 w-4' />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Right: Preview + Decision */}
        <Card className='flex-1 flex flex-col min-h-0 overflow-hidden'>
          <CardHeader className='shrink-0'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div className='min-w-0'>
                <CardTitle className='flex items-center gap-2'>
                  <IconMail className='h-5 w-5' />
                  {selectedItem ? (selectedItem.email_subject || selectedItem.subject || 'Email preview') : 'Select an item'}
                </CardTitle>
                <CardDescription className='truncate'>
                  {selectedItem ? `From: ${selectedItem.sender || selectedItem.from || 'Unknown'}` : ' '}
                </CardDescription>
              </div>
              <div className='flex gap-2'>
                <Button variant='outline' onClick={() => { setSelectedActionId(null); setPreview(null); }} disabled={!selectedActionId || working}>
                  <IconX className='mr-2 h-4 w-4' />
                  Clear
                </Button>
                <Button onClick={handleReject} variant='destructive' disabled={!preview || working}>
                  Reject
                </Button>
                <Button onClick={handleApprove} disabled={!preview || working}>
                  Approve
                </Button>
              </div>
            </div>

            <div className='grid gap-3 mt-3 md:grid-cols-2'>
              <div className='space-y-1'>
                <Label htmlFor='operator'>Operator</Label>
                <Input
                  id='operator'
                  placeholder='e.g., zaks'
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  disabled={working}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='reject-reason'>Reject reason (optional)</Label>
                <Input
                  id='reject-reason'
                  placeholder='e.g., receipt/newsletter/not a deal'
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  disabled={working}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className='flex-1 min-h-0 overflow-hidden'>
            {!selectedActionId ? (
              <div className='h-full flex flex-col items-center justify-center text-muted-foreground'>
                <IconAlertTriangle className='h-12 w-12 mb-2 opacity-50' />
                <p>Select an item from the queue to review</p>
              </div>
            ) : previewLoading ? (
              <div className='space-y-3'>
                <Skeleton className='h-6 w-2/3' />
                <Skeleton className='h-6 w-3/4' />
                <Skeleton className='h-40 w-full' />
              </div>
            ) : previewError ? (
              <div className='h-full flex flex-col items-center justify-center text-muted-foreground gap-2'>
                <IconAlertTriangle className='h-10 w-10 opacity-50' />
                <p className='text-sm'>{previewError}</p>
                <Button variant='outline' size='sm' onClick={() => selectedActionId && loadPreview(selectedActionId)}>
                  <IconRefresh className='mr-2 h-4 w-4' />
                  Retry preview
                </Button>
              </div>
            ) : !preview ? (
              <div className='h-full flex flex-col items-center justify-center text-muted-foreground'>
                <IconAlertTriangle className='h-10 w-10 mb-2 opacity-50' />
                <p>No preview available</p>
              </div>
            ) : (
              <ScrollArea className='h-full pr-2'>
                <div className='space-y-4'>
                  {/* Summary */}
                  <div>
                    <h3 className='font-medium mb-2'>Summary</h3>
                    {preview.summary?.length ? (
                      <ul className='list-disc pl-5 space-y-1 text-sm'>
                        {preview.summary.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className='text-sm text-muted-foreground'>No summary available</p>
                    )}
                  </div>

                  <Separator />

                  {/* Key fields */}
                  <div className='grid gap-3 md:grid-cols-2'>
                    <div className='space-y-1'>
                      <div className='text-xs text-muted-foreground'>Company guess</div>
                      <div className='text-sm font-medium break-all'>
                        {(preview.extracted_fields as any)?.company_guess || '—'}
                      </div>
                    </div>
                    <div className='space-y-1'>
                      <div className='text-xs text-muted-foreground'>Broker email</div>
                      <div className='text-sm font-medium break-all'>
                        {(preview.extracted_fields as any)?.broker_email || '—'}
                      </div>
                    </div>
                    <div className='space-y-1'>
                      <div className='text-xs text-muted-foreground'>Asking/price</div>
                      <div className='text-sm font-medium break-all'>
                        {(preview.extracted_fields as any)?.asking_price || '—'}
                      </div>
                    </div>
                    <div className='space-y-1'>
                      <div className='text-xs text-muted-foreground'>Thread</div>
                      <div className='text-sm font-medium break-all'>
                        {preview.thread_id || '—'}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Links - with collapsible sections for better UX */}
                  <div>
                    <h3 className='font-medium mb-2'>Links</h3>
                    {(() => {
                      const groups = (preview.links as any)?.groups as Record<string, any[]> | undefined;
                      const stats = (preview.links as any)?.stats as {
                        total_raw?: number;
                        unique_count?: number;
                        duplicates_removed?: number;
                        tracking_count?: number;
                      } | undefined;

                      const hasAny = groups && Object.values(groups).some(v => Array.isArray(v) && v.length > 0);
                      if (!hasAny) return <p className='text-sm text-muted-foreground'>No links detected</p>;

                      // Category display order and config
                      const categoryConfig: Record<string, { label: string; icon: React.ReactNode; defaultOpen: boolean; variant: 'default' | 'muted' }> = {
                        deal_material: { label: 'Deal Materials', icon: <IconLink className='h-4 w-4' />, defaultOpen: true, variant: 'default' },
                        calendar: { label: 'Meeting Links', icon: <IconMail className='h-4 w-4' />, defaultOpen: true, variant: 'default' },
                        tracking: { label: 'Tracking Links', icon: <IconShare className='h-4 w-4 text-muted-foreground' />, defaultOpen: false, variant: 'muted' },
                        social: { label: 'Social Media', icon: <IconShare className='h-4 w-4' />, defaultOpen: false, variant: 'muted' },
                        unsubscribe: { label: 'Unsubscribe/Preferences', icon: <IconMailOff className='h-4 w-4' />, defaultOpen: false, variant: 'muted' },
                        portal: { label: 'Portals/Login', icon: <IconLock className='h-4 w-4' />, defaultOpen: false, variant: 'muted' },
                        contact: { label: 'Contact', icon: <IconMail className='h-4 w-4' />, defaultOpen: true, variant: 'default' },
                        other: { label: 'Other Links', icon: <IconLink className='h-4 w-4' />, defaultOpen: false, variant: 'muted' },
                      };

                      // Display order (deal materials first)
                      const orderedCategories = ['deal_material', 'calendar', 'contact', 'other', 'tracking', 'social', 'unsubscribe', 'portal'];

                      return (
                        <div className='space-y-2'>
                          {/* Stats summary */}
                          {stats && (stats.duplicates_removed ?? 0) > 0 && (
                            <div className='text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 mb-2'>
                              {stats.unique_count} unique links (removed {stats.duplicates_removed} duplicates from {stats.total_raw} total)
                            </div>
                          )}

                          {orderedCategories.map((category) => {
                            const links = groups[category];
                            if (!Array.isArray(links) || links.length === 0) return null;
                            const config = categoryConfig[category] || { label: category, icon: <IconLink className='h-4 w-4' />, defaultOpen: false, variant: 'muted' as const };

                            return (
                              <Collapsible key={category} defaultOpen={config.defaultOpen}>
                                <CollapsibleTrigger className='flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded px-2 py-1.5 group'>
                                  <IconChevronRight className='h-4 w-4 transition-transform group-data-[state=open]:rotate-90' />
                                  {config.icon}
                                  <span className={`text-sm font-medium ${config.variant === 'muted' ? 'text-muted-foreground' : ''}`}>
                                    {config.label}
                                  </span>
                                  <Badge variant={config.variant === 'muted' ? 'outline' : 'secondary'} className='ml-auto text-xs'>
                                    {links.length}
                                  </Badge>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className='space-y-1 pl-6 pt-1'>
                                    {links.slice(0, 12).map((l: any, idx: number) => (
                                      <div key={`${l.url}-${idx}`} className='flex items-start justify-between gap-2 rounded border px-2 py-1 text-xs'>
                                        <a
                                          href={l.original_url || l.url}
                                          target='_blank'
                                          rel='noopener noreferrer'
                                          className='text-blue-600 hover:underline break-all min-w-0'
                                          title={l.original_url || l.url}
                                        >
                                          {l.url}
                                        </a>
                                        <div className='flex items-center gap-1 shrink-0'>
                                          {l.auth_required && (
                                            <Badge variant='outline' className='gap-1 text-amber-600'>
                                              <IconLock className='h-3 w-3' />
                                              Auth
                                            </Badge>
                                          )}
                                          {l.resolved_url && (
                                            <Badge variant='outline' className='gap-1 text-green-600'>
                                              Resolved
                                            </Badge>
                                          )}
                                          <IconExternalLink className='h-3 w-3 text-muted-foreground' />
                                        </div>
                                      </div>
                                    ))}
                                    {links.length > 12 && (
                                      <div className='text-xs text-muted-foreground pl-2'>
                                        + {links.length - 12} more…
                                      </div>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  <Separator />

                  {/* Attachments */}
                  <div>
                    <h3 className='font-medium mb-2'>Attachments</h3>
                    {(() => {
                      const att = (preview.attachments as any)?.items as any[] | undefined;
                      if (!att || att.length === 0) return <p className='text-sm text-muted-foreground'>No attachments</p>;
                      return (
                        <div className='space-y-2'>
                          {att.map((a, idx) => (
                            <div key={`${a.filename}-${idx}`} className='rounded border p-2 text-sm'>
                              <div className='flex items-center justify-between gap-2'>
                                <div className='min-w-0'>
                                  <div className='font-medium truncate'>{a.filename}</div>
                                  <div className='text-xs text-muted-foreground truncate'>
                                    {a.mime_type || 'unknown'}{a.size_bytes ? ` • ${Math.round(a.size_bytes / 1024)} KB` : ''}
                                  </div>
                                </div>
                                {a.downloaded_path ? (
                                  <Badge variant='secondary' className='text-xs'>Downloaded</Badge>
                                ) : (
                                  <Badge variant='outline' className='text-xs'>Not downloaded</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <Separator />

                  {/* Email body */}
                  <div>
                    <div className='flex items-center justify-between gap-2 mb-2'>
                      <h3 className='font-medium'>Email</h3>
                      <Button variant='outline' size='sm' onClick={() => setShowFullBody(v => !v)}>
                        {showFullBody ? 'Collapse' : 'Expand'}
                      </Button>
                    </div>
                    <div className='rounded border bg-muted p-3 text-sm whitespace-pre-wrap'>
                      {showFullBody
                        ? ((preview.email as any)?.body || '—')
                        : ((preview.email as any)?.body_snippet || (preview.email as any)?.body || '—')}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargetIds.length === 1 ? 'Delete quarantine item?' : `Delete ${deleteTargetIds.length} quarantine items?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item(s) from the Quarantine decision queue. It does not approve/reject and does not modify Gmail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
