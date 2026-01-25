/**
 * OperatorHQ Component
 *
 * Central command center for operators showing:
 * - Today's stats
 * - Pending approvals
 * - Active deals by stage
 * - Recent activity
 * - Quick actions
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  IconTrendingUp,
  IconInbox,
  IconShieldCheck,
  IconClock,
  IconRobot,
  IconArrowRight,
  IconRefresh,
  IconAlertTriangle,
  IconCheck,
  IconActivity,
} from '@tabler/icons-react';
import { ApprovalQueue } from '@/components/approvals/ApprovalQueue';
import { PipelineOverview } from './PipelineOverview';
import { ActivityFeed } from './ActivityFeed';
import { QuickStats } from './QuickStats';
import type { PipelineStats, DealEvent, Action } from '@/types/api';

// =============================================================================
// Types
// =============================================================================

interface OperatorHQProps {
  stats?: PipelineStats;
  recentEvents?: DealEvent[];
  pendingActions?: Action[];
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function OperatorHQ({
  stats,
  recentEvents = [],
  pendingActions = [],
  isLoading = false,
  onRefresh,
  className = '',
}: OperatorHQProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'activity'>('overview');

  // Count urgent items
  const urgentCount = pendingActions.filter((a) => a.risk_level === 'high').length;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <IconActivity className="w-5 h-5 text-primary" />
            Operator HQ
          </h1>
          <p className="text-sm text-muted-foreground">
            Your command center for deal operations
          </p>
        </div>

        <div className="flex items-center gap-3">
          {urgentCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <IconAlertTriangle className="w-3 h-3" />
              {urgentCount} urgent
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <IconRefresh className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick stats row */}
      <QuickStats stats={stats} isLoading={isLoading} />

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="h-full flex flex-col"
        >
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 pt-2">
            <TabsTrigger value="overview" className="gap-2">
              <IconTrendingUp className="w-4 h-4" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="approvals" className="gap-2">
              <IconShieldCheck className="w-4 h-4" />
              Approvals
              {pendingActions.filter((a) => a.status === 'PENDING_APPROVAL').length > 0 && (
                <Badge variant="default" className="ml-1 h-5 px-1.5 bg-amber-500">
                  {pendingActions.filter((a) => a.status === 'PENDING_APPROVAL').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <IconClock className="w-4 h-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-hidden mt-0 p-6">
            <PipelineOverview stats={stats} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="approvals" className="flex-1 overflow-hidden mt-0">
            <ApprovalQueue
              variant="full"
              maxHeight="calc(100vh - 16rem)"
            />
          </TabsContent>

          <TabsContent value="activity" className="flex-1 overflow-hidden mt-0 p-6">
            <ActivityFeed events={recentEvents} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default OperatorHQ;
