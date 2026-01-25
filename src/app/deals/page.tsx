'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  IconAlertTriangle,
  IconBox,
  IconRefresh,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTrash,
  IconX,
  IconLayoutKanban,
  IconTable,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { archiveDeal, bulkArchiveDeals, getDeals, type Deal } from '@/lib/api';
import { DealBoard } from '@/components/deals/DealBoard';

const STAGES = [
  'inbound',
  'screening',
  'qualified',
  'loi',
  'diligence',
  'closing',
  'integration',
  'operations',
  'growth',
  'exit_planning'
];

const STATUSES = ['active', 'junk', 'merged'];

// Sentinel value for "all" filter (empty string breaks Radix Select)
const ALL_FILTER = '__all__';

type SortField = 'canonical_name' | 'stage' | 'broker' | 'days_since_update' | 'priority';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'table' | 'board';

export default function DealsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  // View mode from URL
  const initialView = (searchParams.get('view') as ViewMode) || 'table';
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);

  // Filters from URL (convert empty to sentinel for Select component)
  const stageFilterRaw = searchParams.get('stage') || '';
  const statusFilterRaw = searchParams.get('status') || 'active';
  const searchQuery = searchParams.get('q') || '';

  // For Select value binding (Select doesn't accept empty string)
  const stageFilter = stageFilterRaw || ALL_FILTER;
  const statusFilter = statusFilterRaw || ALL_FILTER;

  // Sort state
  const [sortField, setSortField] = useState<SortField>('days_since_update');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (stageFilterRaw) params.stage = stageFilterRaw;
      if (statusFilterRaw) params.status = statusFilterRaw;
      const data = await getDeals(params);
      setDeals(data);
      setSelectedDealIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [stageFilterRaw, statusFilterRaw]);

  // Update URL params (convert sentinel back to empty for URL)
  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const actualValue = value === ALL_FILTER ? '' : value;
    if (actualValue) {
      params.set(key, actualValue);
    } else {
      params.delete(key);
    }
    router.push(`/deals?${params.toString()}`);
  };

  // Update view mode
  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    const params = new URLSearchParams(searchParams.toString());
    if (mode === 'table') {
      params.delete('view');
    } else {
      params.set('view', mode);
    }
    router.push(`/deals?${params.toString()}`);
  };

  // Filter by search query
  const filteredDeals = deals.filter(deal => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      deal.canonical_name?.toLowerCase().includes(q) ||
      deal.deal_id.toLowerCase().includes(q) ||
      deal.broker?.toLowerCase().includes(q)
    );
  });

  // Sort deals
  const sortedDeals = [...filteredDeals].sort((a, b) => {
    let aVal: string | number | null = null;
    let bVal: string | number | null = null;

    switch (sortField) {
      case 'canonical_name':
        aVal = a.canonical_name || '';
        bVal = b.canonical_name || '';
        break;
      case 'stage':
        aVal = STAGES.indexOf(a.stage);
        bVal = STAGES.indexOf(b.stage);
        break;
      case 'broker':
        aVal = a.broker || '';
        bVal = b.broker || '';
        break;
      case 'days_since_update':
        aVal = a.days_since_update ?? 999;
        bVal = b.days_since_update ?? 999;
        break;
      case 'priority':
        const priorityOrder = { HIGHEST: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
        aVal = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
        bVal = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
        break;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    return sortOrder === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <IconSortAscending className='h-4 w-4 ml-1' />
    ) : (
      <IconSortDescending className='h-4 w-4 ml-1' />
    );
  };

  const openDeleteDialog = (dealIds: string[]) => {
    setDeleteTargetIds(dealIds);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteTargetIds.length === 0) {
      setDeleteDialogOpen(false);
      return;
    }
    setDeleting(true);
    try {
      let operator = 'operator';
      try {
        const saved = window.localStorage.getItem('zakops_operator_name');
        if (saved && saved.trim()) operator = saved.trim();
      } catch {
        // ignore
      }

      if (deleteTargetIds.length === 1) {
        await archiveDeal(deleteTargetIds[0], { operator });
      } else {
        await bulkArchiveDeals(deleteTargetIds, { operator });
      }

      setDeals(prev => prev.filter(d => !deleteTargetIds.includes(d.deal_id)));
      setSelectedDealIds(prev => {
        const next = new Set(prev);
        for (const id of deleteTargetIds) next.delete(id);
        return next;
      });

      toast.success(
        deleteTargetIds.length === 1
          ? 'Deal deleted (archived)'
          : `Deleted (archived) ${deleteTargetIds.length} deals`
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
        <h2 className='text-xl font-semibold'>Failed to load deals</h2>
        <p className='text-muted-foreground'>{error}</p>
        <Button onClick={fetchData} variant='outline'>
          <IconRefresh className='mr-2 h-4 w-4' />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col min-h-0 gap-4 p-4 md:p-6'>
      {/* Header - fixed */}
      <div className='flex items-center justify-between shrink-0'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Deals</h1>
          <p className='text-muted-foreground'>
            Manage your deal pipeline
          </p>
        </div>
        <div className='flex items-center gap-2'>
          {/* View Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => updateViewMode(v as ViewMode)}>
            <TabsList className='h-9'>
              <TabsTrigger value='table' className='gap-1.5 px-3'>
                <IconTable className='h-4 w-4' />
                Table
              </TabsTrigger>
              <TabsTrigger value='board' className='gap-1.5 px-3'>
                <IconLayoutKanban className='h-4 w-4' />
                Board
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={fetchData} variant='outline' size='sm' disabled={loading}>
            <IconRefresh className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Board View */}
      {viewMode === 'board' && (
        <div className='flex-1 min-h-0'>
          <DealBoard />
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <>
          {/* Filters - fixed */}
          <Card className='shrink-0'>
            <CardContent className='pt-6'>
              <div className='flex flex-wrap gap-4'>
                {/* Search */}
                <div className='flex-1 min-w-[200px]'>
                  <div className='relative'>
                    <IconSearch className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                    <Input
                      placeholder='Search deals...'
                      value={searchQuery}
                      onChange={(e) => updateFilter('q', e.target.value)}
                      className='pl-9'
                    />
                    {searchQuery && (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0'
                        onClick={() => updateFilter('q', '')}
                      >
                        <IconX className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Stage filter */}
                <Select value={stageFilter} onValueChange={(v) => updateFilter('stage', v)}>
                  <SelectTrigger className='w-[180px]'>
                    <SelectValue placeholder='All stages' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All stages</SelectItem>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status filter */}
                <Select value={statusFilter} onValueChange={(v) => updateFilter('status', v)}>
                  <SelectTrigger className='w-[150px]'>
                    <SelectValue placeholder='Status' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Clear filters */}
                {(stageFilter !== ALL_FILTER || statusFilter !== 'active' || searchQuery) && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                      router.push('/deals?status=active');
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Deals Table - scrollable */}
      <Card className='flex-1 min-h-0 flex flex-col overflow-hidden'>
        <CardHeader className='pb-3 shrink-0'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <CardTitle className='flex items-center gap-2'>
              <IconBox className='h-5 w-5' />
              {sortedDeals.length} Deal{sortedDeals.length !== 1 ? 's' : ''}
            </CardTitle>
            {selectedDealIds.size > 0 && (
              <div className='flex items-center gap-2'>
                <Button
                  variant='destructive'
                  size='sm'
                  onClick={() => openDeleteDialog(Array.from(selectedDealIds))}
                  disabled={loading || deleting}
                >
                  <IconTrash className='mr-2 h-4 w-4' />
                  Delete ({selectedDealIds.size})
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setSelectedDealIds(new Set())}
                  disabled={loading || deleting}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className='flex-1 min-h-0 overflow-y-auto' data-testid='deals-scroll'>
          {loading ? (
            <div className='space-y-2'>
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          ) : sortedDeals.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-muted-foreground'>
              <IconBox className='h-12 w-12 mb-2 opacity-50' />
              <p>No deals found</p>
              <p className='text-sm'>Try adjusting your filters</p>
            </div>
          ) : (
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[36px]'>
                      {(() => {
                        const selectedVisible = sortedDeals.filter(d => selectedDealIds.has(d.deal_id)).length;
                        const allVisibleSelected = sortedDeals.length > 0 && selectedVisible === sortedDeals.length;
                        const someVisibleSelected = selectedVisible > 0 && selectedVisible < sortedDeals.length;
                        const checked: boolean | 'indeterminate' = allVisibleSelected
                          ? true
                          : someVisibleSelected
                          ? 'indeterminate'
                          : false;

                        return (
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => {
                              setSelectedDealIds(prev => {
                                const next = new Set(prev);
                                if (allVisibleSelected) {
                                  for (const d of sortedDeals) next.delete(d.deal_id);
                                } else {
                                  for (const d of sortedDeals) next.add(d.deal_id);
                                }
                                return next;
                              });
                            }}
                            aria-label='Select all visible deals'
                          />
                        );
                      })()}
                    </TableHead>
                    <TableHead
                      className='cursor-pointer hover:bg-accent'
                      onClick={() => toggleSort('canonical_name')}
                    >
                      <div className='flex items-center'>
                        Deal Name
                        <SortIcon field='canonical_name' />
                      </div>
                    </TableHead>
                    <TableHead
                      className='cursor-pointer hover:bg-accent'
                      onClick={() => toggleSort('stage')}
                    >
                      <div className='flex items-center'>
                        Stage
                        <SortIcon field='stage' />
                      </div>
                    </TableHead>
                    <TableHead
                      className='cursor-pointer hover:bg-accent'
                      onClick={() => toggleSort('broker')}
                    >
                      <div className='flex items-center'>
                        Broker
                        <SortIcon field='broker' />
                      </div>
                    </TableHead>
                    <TableHead
                      className='cursor-pointer hover:bg-accent'
                      onClick={() => toggleSort('priority')}
                    >
                      <div className='flex items-center'>
                        Priority
                        <SortIcon field='priority' />
                      </div>
                    </TableHead>
                    <TableHead
                      className='cursor-pointer hover:bg-accent text-right'
                      onClick={() => toggleSort('days_since_update')}
                    >
                      <div className='flex items-center justify-end'>
                        Last Update
                        <SortIcon field='days_since_update' />
                      </div>
                    </TableHead>
                    <TableHead className='w-[60px]' />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDeals.map((deal) => (
                    <TableRow
                      key={deal.deal_id}
                      className='cursor-pointer hover:bg-accent'
                      onClick={() => router.push(`/deals/${deal.deal_id}`)}
                    >
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className='w-[36px]'
                      >
                        <Checkbox
                          checked={selectedDealIds.has(deal.deal_id)}
                          onCheckedChange={() => {
                            setSelectedDealIds(prev => {
                              const next = new Set(prev);
                              if (next.has(deal.deal_id)) next.delete(deal.deal_id);
                              else next.add(deal.deal_id);
                              return next;
                            });
                          }}
                          aria-label={`Select deal ${deal.deal_id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className='font-medium'>
                            {deal.canonical_name || deal.deal_id}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            {deal.deal_id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>{deal.stage}</Badge>
                      </TableCell>
                      <TableCell>
                        {deal.broker || '-'}
                      </TableCell>
                      <TableCell>
                        {deal.priority ? (
                          <Badge
                            variant={
                              deal.priority === 'HIGHEST'
                                ? 'destructive'
                                : deal.priority === 'HIGH'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {deal.priority}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        {deal.days_since_update !== undefined
                          ? `${deal.days_since_update}d ago`
                          : '-'}
                      </TableCell>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className='text-right'
                      >
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => openDeleteDialog([deal.deal_id])}
                          aria-label={`Delete deal ${deal.deal_id}`}
                          disabled={deleting}
                        >
                          <IconTrash className='h-4 w-4' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargetIds.length === 1 ? 'Delete deal?' : `Delete ${deleteTargetIds.length} deals?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This hides the deal from the Deals list (soft delete / archive). It does not delete files, events, or audit history.
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
