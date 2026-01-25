/**
 * PipelineOverview Component
 *
 * Visual overview of deal pipeline by stage.
 */

'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  IconArrowRight,
  IconBriefcase,
} from '@tabler/icons-react';
import type { PipelineStats, DealStage } from '@/types/api';
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from '@/types/execution-contracts';

// =============================================================================
// Types
// =============================================================================

interface PipelineOverviewProps {
  stats?: PipelineStats;
  isLoading?: boolean;
  className?: string;
}

// =============================================================================
// Stage Config
// =============================================================================

const PIPELINE_STAGES: DealStage[] = [
  'inbound',
  'screening',
  'qualified',
  'loi',
  'diligence',
  'closing',
  'portfolio',
];

function getStageColorClass(color: string): string {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    emerald: 'bg-emerald-500',
    gray: 'bg-gray-500',
    slate: 'bg-slate-500',
  };
  return colorMap[color] || 'bg-gray-500';
}

// =============================================================================
// Component
// =============================================================================

export function PipelineOverview({
  stats,
  isLoading = false,
  className = '',
}: PipelineOverviewProps) {
  const dealsByStage = stats?.deals_by_stage ?? {};
  const totalDeals = stats?.total_active_deals ?? 0;

  // Calculate max for relative sizing
  const maxDeals = Math.max(...Object.values(dealsByStage), 1);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stage cards */}
      <div className="grid grid-cols-7 gap-4">
        {PIPELINE_STAGES.map((stage) => {
          const count = dealsByStage[stage] ?? 0;
          const percentage = totalDeals > 0 ? (count / totalDeals) * 100 : 0;
          const color = DEAL_STAGE_COLORS[stage];

          return (
            <Link key={stage} href={`/deals?stage=${stage}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        color === 'blue'
                          ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          : color === 'cyan'
                          ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
                          : color === 'green'
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : color === 'yellow'
                          ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                          : color === 'orange'
                          ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                          : color === 'purple'
                          ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                          : color === 'emerald'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                      }`}
                    >
                      {DEAL_STAGE_LABELS[stage]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-10 w-16 bg-muted animate-pulse rounded" />
                  ) : (
                    <div className="space-y-2">
                      <p className="text-3xl font-bold">{count}</p>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getStageColorClass(color)} transition-all duration-300`}
                          style={{ width: `${(count / maxDeals) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Pipeline flow visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline Flow</CardTitle>
          <CardDescription>
            Deal distribution across pipeline stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1">
            {PIPELINE_STAGES.map((stage, idx) => {
              const count = dealsByStage[stage] ?? 0;
              const width = totalDeals > 0 ? (count / totalDeals) * 100 : 14;
              const color = DEAL_STAGE_COLORS[stage];

              return (
                <div
                  key={stage}
                  className="relative group"
                  style={{ width: `${Math.max(width, 5)}%` }}
                >
                  <div
                    className={`h-8 ${getStageColorClass(color)} ${
                      idx === 0 ? 'rounded-l-lg' : ''
                    } ${idx === PIPELINE_STAGES.length - 1 ? 'rounded-r-lg' : ''}`}
                  />
                  {/* Tooltip */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-popover border rounded-lg px-2 py-1 shadow-lg whitespace-nowrap">
                      <p className="text-xs font-medium">{DEAL_STAGE_LABELS[stage]}</p>
                      <p className="text-xs text-muted-foreground">{count} deals</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4">
            {PIPELINE_STAGES.map((stage) => {
              const color = DEAL_STAGE_COLORS[stage];
              return (
                <div key={stage} className="flex items-center gap-2 text-xs">
                  <div className={`w-3 h-3 rounded ${getStageColorClass(color)}`} />
                  <span className="text-muted-foreground">{DEAL_STAGE_LABELS[stage]}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link href="/deals" className="flex-1">
          <Button variant="outline" className="w-full">
            <IconBriefcase className="w-4 h-4 mr-2" />
            View All Deals
            <IconArrowRight className="w-4 h-4 ml-auto" />
          </Button>
        </Link>
        <Link href="/quarantine" className="flex-1">
          <Button variant="outline" className="w-full">
            Review Quarantine
            <Badge variant="secondary" className="ml-2">
              {stats?.quarantine_pending ?? 0}
            </Badge>
            <IconArrowRight className="w-4 h-4 ml-auto" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default PipelineOverview;
