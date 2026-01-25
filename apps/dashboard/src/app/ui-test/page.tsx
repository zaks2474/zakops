'use client';

/**
 * Phase 4 UI Component Test Page
 *
 * Displays all Phase 4 components for visual testing and verification.
 * Visit: http://localhost:3003/ui-test
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Phase 4 Components
import { TodayNextUpStrip } from '@/components/dashboard/TodayNextUpStrip';
import { ExecutionInbox } from '@/components/dashboard/ExecutionInbox';
import { ApprovalQueue } from '@/components/approvals/ApprovalQueue';
import { ApprovalBadge } from '@/components/approvals/ApprovalBadge';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { OperatorHQ } from '@/components/operator-hq/OperatorHQ';
import { DiligenceChecklist } from '@/components/diligence/DiligenceChecklist';
import { GlobalSearch } from '@/components/global-search';

// Mock data for testing
const mockApprovals = [
  {
    action_id: 'test-1',
    title: 'Test Approval 1',
    action_type: 'send_email',
    risk_level: 'high',
    status: 'PENDING_APPROVAL',
  },
];

const mockScheduledActions = [
  {
    action_id: 'test-2',
    title: 'Follow up with broker',
    action_type: 'send_email',
    risk_level: 'low',
    status: 'QUEUED',
    scheduled_for: new Date(Date.now() + 3600000).toISOString(),
  },
];

const mockDeals = [
  {
    deal_id: 'DEAL-TEST-001',
    canonical_name: 'Test Deal Company',
    display_name: 'Test Deal Company',
    stage: 'screening',
    days_since_update: 14,
    priority: 'HIGHEST',
  },
];

const mockQuarantineItems = [
  {
    id: 'QI-TEST-001',
    company_name: 'Unknown Company',
    email_subject: 'New Investment Opportunity',
    sender: 'broker@example.com',
    urgency: 'MEDIUM',
    created_at: new Date().toISOString(),
  },
];

const mockActions = [
  {
    action_id: 'ACT-001',
    title: 'Send NDA to broker',
    action_type: 'send_email',
    risk_level: 'low',
    status: 'READY',
    updated_at: new Date().toISOString(),
  },
  {
    action_id: 'ACT-002',
    title: 'Request CIM',
    action_type: 'send_email',
    risk_level: 'medium',
    status: 'PENDING_APPROVAL',
    updated_at: new Date().toISOString(),
  },
];

export default function UITestPage() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <div className="flex flex-col min-h-screen p-8 space-y-8 bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phase 4 UI Component Test</h1>
          <p className="text-muted-foreground">
            All Phase 4 components rendered for visual verification
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          Visit: /ui-test
        </Badge>
      </div>

      {/* TodayNextUpStrip */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            TodayNextUpStrip
            <Badge>Dashboard Component</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TodayNextUpStrip
            pendingApprovals={mockApprovals as any}
            scheduledActions={mockScheduledActions as any}
            urgentDeals={mockDeals as any}
            quarantineItems={mockQuarantineItems as any}
          />
        </CardContent>
      </Card>

      {/* ExecutionInbox */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ExecutionInbox
            <Badge>Dashboard Component</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExecutionInbox
            actions={mockActions as any}
            quarantineItems={mockQuarantineItems as any}
            maxHeight="400px"
          />
        </CardContent>
      </Card>

      {/* ApprovalQueue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ApprovalQueue
            <Badge>Approval Component</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalQueue maxHeight="300px" />
        </CardContent>
      </Card>

      {/* ApprovalBadge */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ApprovalBadge
            <Badge>Header Component</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Count variant:</span>
            <ApprovalBadge variant="count" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Full variant:</span>
            <ApprovalBadge variant="full" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Icon variant:</span>
            <ApprovalBadge variant="icon" />
          </div>
          <p className="text-sm text-muted-foreground ml-4">
            (Shows nothing if no pending approvals)
          </p>
        </CardContent>
      </Card>

      {/* GlobalSearch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            GlobalSearch
            <Badge>Header Component</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <GlobalSearch />
          <p className="text-sm text-muted-foreground">
            Press <kbd className="px-2 py-1 bg-muted rounded">Cmd+K</kbd> or{' '}
            <kbd className="px-2 py-1 bg-muted rounded">Ctrl+K</kbd> to open
          </p>
        </CardContent>
      </Card>

      {/* DiligenceChecklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            DiligenceChecklist
            <Badge>Deal Component</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DiligenceChecklist dealId="DEAL-2026-001" />
        </CardContent>
      </Card>

      {/* OnboardingWizard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            OnboardingWizard
            <Badge>Onboarding Component</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showOnboarding ? (
            <div className="max-w-2xl mx-auto">
              <OnboardingWizard
                onComplete={(state) => {
                  console.log('Onboarding complete:', state);
                  setShowOnboarding(false);
                  alert('Onboarding complete! Check console for state.');
                }}
                onSkip={() => {
                  setShowOnboarding(false);
                }}
              />
            </div>
          ) : (
            <Button onClick={() => setShowOnboarding(true)}>
              Show Onboarding Wizard
            </Button>
          )}
        </CardContent>
      </Card>

      {/* OperatorHQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            OperatorHQ
            <Badge>HQ Component</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[500px]">
          <OperatorHQ />
        </CardContent>
      </Card>

      {/* Route Links */}
      <Card>
        <CardHeader>
          <CardTitle>All Phase 4 Routes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a href="/dashboard" className="text-primary hover:underline">
              /dashboard
            </a>
            <a href="/hq" className="text-primary hover:underline">
              /hq
            </a>
            <a href="/onboarding" className="text-primary hover:underline">
              /onboarding
            </a>
            <a href="/deals" className="text-primary hover:underline">
              /deals
            </a>
            <a href="/deals/DEAL-2026-001" className="text-primary hover:underline">
              /deals/DEAL-2026-001
            </a>
            <a href="/actions" className="text-primary hover:underline">
              /actions
            </a>
            <a href="/quarantine" className="text-primary hover:underline">
              /quarantine
            </a>
            <a href="/chat" className="text-primary hover:underline">
              /chat
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
