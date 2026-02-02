'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  IconSearch,
  IconBriefcase,
  IconLoader2,
  IconShieldCheck,
  IconInbox,
  IconListCheck,
  IconArrowRight,
  IconPlus,
  IconSettings,
  IconHelp,
  IconCommand,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

interface DealSearchResult {
  deal_id: string;
  canonical_name: string;
  stage: string;
  status: string;
  broker_name?: string;
}

interface ActionSearchResult {
  action_id: string;
  title: string;
  action_type: string;
  status: string;
  deal_name?: string;
}

interface QuarantineSearchResult {
  id: string;
  company_name: string | null;
  email_subject: string | null;
  sender: string | null;
  classification: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: typeof IconSearch;
  shortcut?: string;
  action: () => void;
}

// Simple in-memory cache with TTL
const searchCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds

type SearchMode = 'all' | 'deals' | 'actions' | 'quarantine' | 'commands';

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [mode, setMode] = React.useState<SearchMode>('all');
  const [results, setResults] = React.useState<DealSearchResult[]>([]);
  const [actionResults, setActionResults] = React.useState<ActionSearchResult[]>([]);
  const [quarantineResults, setQuarantineResults] = React.useState<QuarantineSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [allDeals, setAllDeals] = React.useState<DealSearchResult[]>([]);
  const [allActions, setAllActions] = React.useState<ActionSearchResult[]>([]);
  const [allQuarantine, setAllQuarantine] = React.useState<QuarantineSearchResult[]>([]);
  const router = useRouter();
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Quick actions
  const quickActions: QuickAction[] = React.useMemo(() => [
    {
      id: 'new-deal',
      label: 'Create New Deal',
      icon: IconPlus,
      shortcut: 'N',
      action: () => {
        setOpen(false);
        router.push('/deals/new');
      },
    },
    {
      id: 'pending-approvals',
      label: 'View Pending Approvals',
      icon: IconShieldCheck,
      shortcut: 'A',
      action: () => {
        setOpen(false);
        router.push('/actions?status=PENDING_APPROVAL');
      },
    },
    {
      id: 'quarantine',
      label: 'Review Quarantine',
      icon: IconInbox,
      shortcut: 'Q',
      action: () => {
        setOpen(false);
        router.push('/quarantine');
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: IconSettings,
      action: () => {
        setOpen(false);
        router.push('/settings');
      },
    },
  ], [router]);

  // Register global keyboard shortcut
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Load all data on first open (client-side search approach)
  React.useEffect(() => {
    if (open) {
      if (allDeals.length === 0) loadAllDeals();
      if (allActions.length === 0) loadAllActions();
      if (allQuarantine.length === 0) loadAllQuarantine();
    }
  }, [open]);

  // Reset mode when dialog closes
  React.useEffect(() => {
    if (!open) {
      setMode('all');
      setQuery('');
    }
  }, [open]);

  // Debounced search
  React.useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      // Show recent/all items when no query
      setResults(allDeals.slice(0, 5));
      setActionResults(allActions.filter(a => a.status === 'PENDING_APPROVAL').slice(0, 3));
      setQuarantineResults(allQuarantine.slice(0, 3));
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchAll(query.toLowerCase());
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, allDeals, allActions, allQuarantine, mode]);

  const loadAllDeals = async () => {
    // Check cache first
    const cacheKey = 'all_deals';
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const deals = cached.data as DealSearchResult[];
      setAllDeals(deals);
      setResults(deals.slice(0, 10));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/deals?status=active');
      if (!res.ok) throw new Error('Failed to fetch deals');
      const data = await res.json();

      // Handle both array and object response formats
      const deals: DealSearchResult[] = (Array.isArray(data) ? data : data.deals || []).map((d: Record<string, unknown>) => {
        const broker = (d as any).broker;
        const brokerName =
          broker && typeof broker === 'object' ? (broker as any).name : undefined;
        return {
          deal_id: d.deal_id as string,
          canonical_name: (d.canonical_name || d.deal_id) as string,
          stage: d.stage as string,
          status: d.status as string,
          broker_name: (brokerName || (d as any).broker_name) as string | undefined,
        };
      });

      // Cache the results
      searchCache.set(cacheKey, { data: deals, timestamp: Date.now() });
      setAllDeals(deals);
      setResults(deals.slice(0, 10));
    } catch (err) {
      console.error('Failed to load deals for search:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllActions = async () => {
    const cacheKey = 'all_actions';
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setAllActions(cached.data as ActionSearchResult[]);
      return;
    }

    try {
      const res = await fetch('/api/actions?pending_only=true');
      if (!res.ok) return;
      const data = await res.json();
      const actions: ActionSearchResult[] = (Array.isArray(data) ? data : data.actions || []).map((a: Record<string, unknown>) => ({
        action_id: a.action_id as string,
        title: a.title as string,
        action_type: a.action_type as string,
        status: a.status as string,
        deal_name: a.deal_name as string | undefined,
      }));
      searchCache.set(cacheKey, { data: actions, timestamp: Date.now() });
      setAllActions(actions);
    } catch (err) {
      console.error('Failed to load actions for search:', err);
    }
  };

  const loadAllQuarantine = async () => {
    const cacheKey = 'all_quarantine';
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setAllQuarantine(cached.data as QuarantineSearchResult[]);
      return;
    }

    try {
      const res = await fetch('/api/quarantine?status=pending');
      if (!res.ok) return;
      const data = await res.json();
      const items: QuarantineSearchResult[] = (Array.isArray(data) ? data : data.items || []).map((q: Record<string, unknown>) => ({
        id: q.id as string,
        company_name: q.company_name as string | null,
        email_subject: q.email_subject as string | null,
        sender: q.sender as string | null,
        classification: q.classification as string,
      }));
      searchCache.set(cacheKey, { data: items, timestamp: Date.now() });
      setAllQuarantine(items);
    } catch (err) {
      console.error('Failed to load quarantine for search:', err);
    }
  };

  const searchAll = (searchQuery: string) => {
    // Search deals
    const filteredDeals = allDeals.filter((deal) => {
      const searchFields = [
        deal.canonical_name,
        deal.deal_id,
        deal.broker_name,
        deal.stage,
        deal.status,
      ]
        .filter(Boolean)
        .map((s) => s?.toLowerCase() || '');

      return searchFields.some((field) => field.includes(searchQuery));
    });
    setResults(filteredDeals.slice(0, mode === 'all' ? 5 : 20));

    // Search actions
    const filteredActions = allActions.filter((action) => {
      const searchFields = [
        action.title,
        action.action_id,
        action.action_type,
        action.deal_name,
      ]
        .filter(Boolean)
        .map((s) => s?.toLowerCase() || '');

      return searchFields.some((field) => field.includes(searchQuery));
    });
    setActionResults(filteredActions.slice(0, mode === 'all' ? 3 : 20));

    // Search quarantine
    const filteredQuarantine = allQuarantine.filter((item) => {
      const searchFields = [
        item.company_name,
        item.email_subject,
        item.sender,
      ]
        .filter(Boolean)
        .map((s) => s?.toLowerCase() || '');

      return searchFields.some((field) => field.includes(searchQuery));
    });
    setQuarantineResults(filteredQuarantine.slice(0, mode === 'all' ? 3 : 20));
  };

  const handleSelectDeal = (dealId: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/deals/${dealId}`);
  };

  const handleSelectAction = (actionId: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/actions?selected=${actionId}`);
  };

  const handleSelectQuarantine = (id: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/quarantine?selected=${id}`);
  };

  const hasResults = results.length > 0 || actionResults.length > 0 || quarantineResults.length > 0;
  const totalResults = results.length + actionResults.length + quarantineResults.length;

  const getStageColor = (stage: string): string => {
    const colors: Record<string, string> = {
      inbound: 'bg-slate-500',
      screening: 'bg-blue-500',
      qualified: 'bg-cyan-500',
      loi: 'bg-teal-500',
      diligence: 'bg-green-500',
      closing: 'bg-emerald-500',
      portfolio: 'bg-green-700',
      junk: 'bg-red-700',
    };
    return colors[stage] || 'bg-gray-500';
  };

  return (
    <>
      <Button
        variant='outline'
        className='bg-background text-muted-foreground relative h-9 w-full justify-start rounded-[0.5rem] text-sm font-normal shadow-none sm:pr-12 md:w-40 lg:w-64'
        onClick={() => setOpen(true)}
        data-testid='global-search-trigger'
      >
        <IconSearch className='mr-2 h-4 w-4' />
        Search deals...
        <kbd className='bg-muted pointer-events-none absolute top-[0.3rem] right-[0.3rem] hidden h-6 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex'>
          <span className='text-xs'>⌘</span>K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title='Search Deals'
        description='Search for deals by name, ID, broker, or stage'
      >
        <CommandInput
          placeholder='Search deals...'
          value={query}
          onValueChange={setQuery}
          data-testid='global-search-input'
        />
        <CommandList data-testid='global-search-results'>
          {loading && (
            <div className='flex items-center justify-center py-6'>
              <IconLoader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          )}

          {/* Quick Actions - show when no query */}
          {!loading && !query && (
            <CommandGroup heading='Quick Actions'>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.id}
                    onSelect={action.action}
                    className='flex items-center justify-between'
                  >
                    <div className='flex items-center gap-2'>
                      <Icon className='h-4 w-4 text-muted-foreground' />
                      <span>{action.label}</span>
                    </div>
                    {action.shortcut && (
                      <CommandShortcut>⌘{action.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {!loading && !hasResults && query && (
            <CommandEmpty>No results found for &quot;{query}&quot;</CommandEmpty>
          )}

          {/* Deals */}
          {!loading && results.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={query ? 'Deals' : 'Recent Deals'}>
                {results.map((deal) => (
                  <CommandItem
                    key={deal.deal_id}
                    value={`deal ${deal.canonical_name} ${deal.deal_id}`}
                    onSelect={() => handleSelectDeal(deal.deal_id)}
                    className='flex items-center justify-between'
                    data-testid={`search-result-${deal.deal_id}`}
                  >
                    <div className='flex items-center gap-2'>
                      <IconBriefcase className='h-4 w-4 text-muted-foreground' />
                      <div className='flex flex-col'>
                        <span className='font-medium'>{deal.canonical_name}</span>
                        <span className='text-xs text-muted-foreground'>
                          {deal.deal_id}
                          {deal.broker_name && ` • ${deal.broker_name}`}
                        </span>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline' className='gap-1 text-xs'>
                        <span className={`h-2 w-2 rounded-full ${getStageColor(deal.stage)}`} />
                        {deal.stage}
                      </Badge>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Actions */}
          {!loading && actionResults.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={query ? 'Actions' : 'Pending Approvals'}>
                {actionResults.map((action) => (
                  <CommandItem
                    key={action.action_id}
                    value={`action ${action.title} ${action.action_id}`}
                    onSelect={() => handleSelectAction(action.action_id)}
                    className='flex items-center justify-between'
                  >
                    <div className='flex items-center gap-2'>
                      <IconShieldCheck className='h-4 w-4 text-amber-500' />
                      <div className='flex flex-col'>
                        <span className='font-medium'>{action.title}</span>
                        <span className='text-xs text-muted-foreground'>
                          {action.action_type}
                          {action.deal_name && ` • ${action.deal_name}`}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant='outline'
                      className={`text-xs ${
                        action.status === 'PENDING_APPROVAL'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : action.status === 'READY'
                          ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          : action.status === 'FAILED'
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : ''
                      }`}
                    >
                      {action.status.replace('_', ' ')}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Quarantine */}
          {!loading && quarantineResults.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading='Quarantine'>
                {quarantineResults.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`quarantine ${item.company_name || item.email_subject || item.id}`}
                    onSelect={() => handleSelectQuarantine(item.id)}
                    className='flex items-center justify-between'
                  >
                    <div className='flex items-center gap-2'>
                      <IconInbox className='h-4 w-4 text-purple-500' />
                      <div className='flex flex-col'>
                        <span className='font-medium'>
                          {item.company_name || item.email_subject || 'Unknown'}
                        </span>
                        {item.sender && (
                          <span className='text-xs text-muted-foreground'>
                            from {item.sender}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant='outline'
                      className={`text-xs ${
                        item.classification === 'DEAL_SIGNAL'
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : item.classification === 'UNCERTAIN'
                          ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                          : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                      }`}
                    >
                      {item.classification}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
