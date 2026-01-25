/**
 * DealHeader Component
 *
 * Header for deal workspace showing:
 * - Deal name and stage
 * - Priority badge
 * - Key metrics (EBITDA, Revenue, Price)
 * - Quick actions
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  IconArrowLeft,
  IconDots,
  IconFolder,
  IconMail,
  IconEdit,
  IconArchive,
  IconTrash,
  IconExternalLink,
  IconClock,
  IconBuilding,
  IconMapPin,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { Deal, DealStage, Priority } from '@/types/api';
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from '@/types/execution-contracts';

// =============================================================================
// Types
// =============================================================================

interface DealHeaderProps {
  deal: Deal;
  onStageChange?: (stage: DealStage) => void;
  onArchive?: () => void;
  onEdit?: () => void;
  onOpenFolder?: () => void;
  showBackLink?: boolean;
  className?: string;
}

// =============================================================================
// Priority Config
// =============================================================================

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  HIGH: { label: 'High Priority', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
  MEDIUM: { label: 'Medium', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  LOW: { label: 'Low', className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
};

// =============================================================================
// Component
// =============================================================================

export function DealHeader({
  deal,
  onStageChange,
  onArchive,
  onEdit,
  onOpenFolder,
  showBackLink = true,
  className = '',
}: DealHeaderProps) {
  const stageLabel = DEAL_STAGE_LABELS[deal.stage];
  const stageColor = DEAL_STAGE_COLORS[deal.stage];
  const priorityConfig = PRIORITY_CONFIG[deal.metadata.priority];

  // Format currency
  const formatCurrency = (value: number | null) => {
    if (!value) return '—';
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  // Get stage badge color
  const getStageBadgeClass = () => {
    switch (stageColor) {
      case 'blue':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'cyan':
        return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
      case 'green':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'yellow':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'orange':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'purple':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'gray':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'slate':
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <div className={`border-b bg-card ${className}`}>
      {/* Top row: Back link, name, actions */}
      <div className="px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {showBackLink && (
              <Link href="/deals">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <IconArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
            )}

            <div>
              {/* Deal name */}
              <h1 className="text-xl font-semibold flex items-center gap-3">
                {deal.display_name || deal.canonical_name}
                <Badge variant="outline" className={getStageBadgeClass()}>
                  {stageLabel}
                </Badge>
                <Badge variant="outline" className={priorityConfig.className}>
                  {priorityConfig.label}
                </Badge>
              </h1>

              {/* Company info row */}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {deal.company_info.company_name && (
                  <span className="flex items-center gap-1">
                    <IconBuilding className="w-3.5 h-3.5" />
                    {deal.company_info.company_name}
                  </span>
                )}
                {deal.company_info.location && (
                  <span className="flex items-center gap-1">
                    <IconMapPin className="w-3.5 h-3.5" />
                    {deal.company_info.location}
                  </span>
                )}
                {deal.company_info.sector && (
                  <Badge variant="outline" className="text-xs">
                    {deal.company_info.sector}
                  </Badge>
                )}
              </div>

              {/* Broker info */}
              {deal.broker.name && (
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <IconUser className="w-3.5 h-3.5" />
                  <span>
                    {deal.broker.name}
                    {deal.broker.company && ` at ${deal.broker.company}`}
                  </span>
                  {deal.broker.email && (
                    <a
                      href={`mailto:${deal.broker.email}`}
                      className="text-primary hover:underline"
                    >
                      {deal.broker.email}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Last updated */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <IconClock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(deal.updated_at), { addSuffix: true })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Last updated</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Quick actions */}
            {onOpenFolder && deal.folder_path && (
              <Button variant="ghost" size="sm" onClick={onOpenFolder}>
                <IconFolder className="w-4 h-4 mr-1" />
                Files
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <IconDots className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <IconEdit className="w-4 h-4 mr-2" />
                    Edit Deal
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <IconMail className="w-4 h-4 mr-2" />
                  Email Broker
                </DropdownMenuItem>
                {deal.folder_path && (
                  <DropdownMenuItem onClick={onOpenFolder}>
                    <IconExternalLink className="w-4 h-4 mr-2" />
                    Open Folder
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onArchive && (
                  <DropdownMenuItem onClick={onArchive} className="text-destructive">
                    <IconArchive className="w-4 h-4 mr-2" />
                    Archive Deal
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="px-6 py-3 border-t bg-muted/30 flex items-center gap-8">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Asking
          </span>
          <span className="font-semibold">
            {formatCurrency(deal.metadata.asking_price)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            EBITDA
          </span>
          <span className="font-semibold">
            {formatCurrency(deal.metadata.ebitda)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Revenue
          </span>
          <span className="font-semibold">
            {formatCurrency(deal.metadata.revenue)}
          </span>
        </div>

        {deal.metadata.employees && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Employees
            </span>
            <span className="font-semibold">{deal.metadata.employees}</span>
          </div>
        )}

        {/* NDA Status */}
        {deal.metadata.nda_status !== 'none' && (
          <Badge
            variant="outline"
            className={
              deal.metadata.nda_status === 'signed'
                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                : deal.metadata.nda_status === 'requested'
                ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                : 'bg-red-500/10 text-red-500 border-red-500/20'
            }
          >
            NDA: {deal.metadata.nda_status}
          </Badge>
        )}

        {/* CIM indicator */}
        {deal.metadata.cim_received && (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            CIM Received
          </Badge>
        )}
      </div>
    </div>
  );
}

export default DealHeader;
