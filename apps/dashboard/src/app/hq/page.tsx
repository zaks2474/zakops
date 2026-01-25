'use client';

import { useEffect, useState } from 'react';
import { OperatorHQ } from '@/components/operator-hq/OperatorHQ';
import {
  getDeals,
  getKineticActions,
  getQuarantineQueue,
  getAgentActivity,
  type Deal,
  type KineticAction,
  type QuarantineItem,
  type AgentActivityResponse,
} from '@/lib/api';
import type { PipelineStats, DealStage } from '@/types/api';

// Valid pipeline stages that match the PipelineStats interface
const PIPELINE_STAGES: DealStage[] = [
  'inbound',
  'screening',
  'qualified',
  'loi',
  'diligence',
  'closing',
  'portfolio',
];

export default function OperatorHQPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [pendingActions, setPendingActions] = useState<KineticAction[]>([]);
  const [quarantineItems, setQuarantineItems] = useState<QuarantineItem[]>([]);
  const [agentActivity, setAgentActivity] = useState<AgentActivityResponse | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [dealsData, pendingData, quarantineData, activityData] = await Promise.all([
        getDeals({ status: 'active' }),
        // Fetch actions with PENDING_APPROVAL status specifically
        getKineticActions({ status: 'PENDING_APPROVAL' }),
        // Fetch quarantine queue (pending items)
        getQuarantineQueue(),
        // Fetch agent activity for events count (using centralized API function)
        getAgentActivity(100),
      ]);
      setDeals(dealsData);
      setPendingActions(pendingData);
      setQuarantineItems(quarantineData);
      setAgentActivity(activityData);
    } catch (err) {
      console.error('Failed to load HQ data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate deals by stage for all pipeline stages
  const dealsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = deals.filter(d => d.stage === stage).length;
    return acc;
  }, {} as Record<DealStage, number>);

  // Get events count from agent activity stats
  const events24h = agentActivity?.stats?.runsCompleted24h ?? 0;

  const stats: PipelineStats = {
    total_active_deals: deals.length,
    pending_actions: pendingActions.length,
    quarantine_pending: quarantineItems.length, // getQuarantineQueue already returns pending items
    recent_events_24h: events24h,
    deals_by_stage: dealsByStage,
  };

  // Map KineticAction status to ActionStatus (PROCESSING -> RUNNING)
  const mapStatus = (status: string): 'PENDING_APPROVAL' | 'QUEUED' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REJECTED' => {
    if (status === 'PROCESSING') return 'RUNNING';
    return status as 'PENDING_APPROVAL' | 'QUEUED' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REJECTED';
  };

  // Map KineticAction to Action type - OperatorHQ only uses status and risk_level
  const actionsForHQ = pendingActions.map(a => ({
    action_id: a.action_id,
    deal_id: a.deal_id,
    capability_id: a.capability_id ?? '',
    action_type: a.action_type,
    title: a.title,
    summary: a.summary ?? null,
    status: mapStatus(a.status),
    created_at: a.created_at,
    updated_at: a.updated_at,
    started_at: a.started_at ?? null,
    completed_at: a.completed_at ?? null,
    scheduled_for: null,
    duration_seconds: null,
    created_by: a.created_by ?? 'system',
    source: 'system' as const,
    risk_level: 'medium' as const,
    requires_human_review: true,
    idempotency_key: null,
    inputs: a.inputs,
    outputs: a.outputs ?? {},
    retry_count: a.retry_count,
    max_retries: a.max_retries,
    next_retry_at: null,
    parent_action_id: null,
    root_action_id: null,
    chain_depth: 0,
    audit_trail: [],
    artifacts: [],
    error_message: a.error?.message ?? null,
  }));

  return (
    <OperatorHQ
      stats={stats}
      pendingActions={actionsForHQ}
      isLoading={isLoading}
      onRefresh={fetchData}
      className='flex-1'
    />
  );
}
