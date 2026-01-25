/**
 * AgentDemoStep Component
 *
 * Interactive demo of agent capabilities during onboarding.
 * Uses mock-first approach - shows what agent can do without real backend.
 */

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  IconRobot,
  IconPlayerPlay,
  IconChartBar,
  IconFileText,
  IconMail,
  IconShieldCheck,
  IconCircleCheck,
  IconLoader2,
  IconSparkles,
  IconActivity,
  IconUserCheck,
  IconChevronRight,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useAskAgent } from '@/components/agent/AgentDrawer';

// =============================================================================
// Types
// =============================================================================

interface AgentDemoStepProps {
  onDemoComplete?: () => void;
  className?: string;
}

interface DemoEvent {
  id: string;
  type: 'start' | 'progress' | 'approval' | 'complete' | 'result';
  label: string;
  timestamp: Date;
}

// =============================================================================
// Capability Cards Configuration
// =============================================================================

interface Capability {
  id: string;
  title: string;
  description: string;
  icon: typeof IconChartBar;
  demoPrompt: string;
}

const CAPABILITIES: Capability[] = [
  {
    id: 'analyze',
    title: 'Analyze Deals',
    description: 'Automatically extract financials, score buy box fit, and identify risks',
    icon: IconChartBar,
    demoPrompt: 'Analyze the financials for TechWidget Inc and score the buy box fit',
  },
  {
    id: 'draft',
    title: 'Draft Communications',
    description: 'Generate broker responses, LOI drafts, and follow-up emails',
    icon: IconMail,
    demoPrompt: 'Draft a response to the broker expressing interest in TechWidget Inc',
  },
  {
    id: 'human',
    title: 'Human-in-the-Loop',
    description: 'All critical actions require your approval before execution',
    icon: IconUserCheck,
    demoPrompt: 'Show me what actions are pending my approval',
  },
  {
    id: 'track',
    title: 'Track Progress',
    description: 'Monitor deal pipeline, upcoming tasks, and agent activity',
    icon: IconActivity,
    demoPrompt: 'What deals need my attention today?',
  },
];

// =============================================================================
// Mock Deal Results
// =============================================================================

const MOCK_DEAL = {
  company: 'TechWidget Inc',
  asking: '$960,000',
  revenue: '$1.2M',
  ebitda: '$320K',
  buyBoxFit: 78,
  recommendation: 'Strong candidate. Revenue multiple of 0.8x is attractive. Recommend proceeding to screening call with broker.',
};

// =============================================================================
// Component
// =============================================================================

export function AgentDemoStep({ onDemoComplete, className = '' }: AgentDemoStepProps) {
  const [demoStarted, setDemoStarted] = useState(false);
  const [demoPhase, setDemoPhase] = useState<'idle' | 'analyzing' | 'approval' | 'complete'>('idle');
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [showResults, setShowResults] = useState(false);
  const askAgent = useAskAgent();

  // Handle capability card click - opens Agent Drawer with demo prompt
  const handleCapabilityClick = useCallback((capability: Capability) => {
    askAgent({
      dealId: 'DEMO-001',
      dealName: 'TechWidget Inc (Demo)',
      initialQuestion: capability.demoPrompt,
    });
  }, [askAgent]);

  // Add event to timeline
  const addEvent = useCallback((type: DemoEvent['type'], label: string) => {
    setEvents((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type,
        label,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Start the demo
  const startDemo = useCallback(async () => {
    setDemoStarted(true);
    setDemoPhase('analyzing');
    setEvents([]);
    setShowResults(false);

    addEvent('start', 'Starting analysis of TechWidget Inc...');

    // Phase 1: Extracting
    await new Promise((resolve) => setTimeout(resolve, 800));
    addEvent('progress', 'Extracting financials from CIM...');

    // Phase 2: Analyzing
    await new Promise((resolve) => setTimeout(resolve, 1000));
    addEvent('progress', 'Calculating revenue metrics...');

    // Phase 3: Scoring
    await new Promise((resolve) => setTimeout(resolve, 800));
    addEvent('progress', 'Scoring buy box fit...');

    // Phase 4: Results ready
    await new Promise((resolve) => setTimeout(resolve, 600));
    addEvent('complete', 'Analysis complete!');
    setShowResults(true);

    // Phase 5: Ask for approval to draft
    await new Promise((resolve) => setTimeout(resolve, 500));
    addEvent('approval', 'Ready to draft broker response. Awaiting approval...');
    setDemoPhase('approval');
  }, [addEvent]);

  // Handle approval
  const handleApprove = useCallback(async () => {
    setDemoPhase('analyzing');
    addEvent('complete', 'Approved! Drafting broker response...');

    await new Promise((resolve) => setTimeout(resolve, 1200));
    addEvent('complete', 'Email draft ready for review.');

    setDemoPhase('complete');
    onDemoComplete?.();
  }, [addEvent, onDemoComplete]);

  // Reset demo
  const resetDemo = useCallback(() => {
    setDemoStarted(false);
    setDemoPhase('idle');
    setEvents([]);
    setShowResults(false);
  }, []);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header section */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/20">
            <IconRobot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Meet Your AI Agent</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your agent works alongside you to analyze deals, draft communications, and track progress
              - always keeping you in control of important decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Capability cards (2x2 grid) - clickable to open Agent Drawer */}
      <div className="grid grid-cols-2 gap-3">
        {CAPABILITIES.map((cap) => {
          const CapIcon = cap.icon;
          return (
            <button
              key={cap.id}
              onClick={() => handleCapabilityClick(cap)}
              className={cn(
                'group text-left rounded-lg border bg-card p-4',
                'hover:bg-accent/50 hover:border-primary/50 transition-all',
                'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <CapIcon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{cap.title}</h4>
                    <IconChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{cap.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Hint text */}
      <p className="text-xs text-center text-muted-foreground">
        Click any capability to try it out
      </p>

      {/* Demo section */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-muted/50 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <IconSparkles className="w-4 h-4 text-primary" />
              Live Demo
            </span>
            {demoPhase === 'analyzing' && (
              <Badge variant="default" className="gap-1">
                <IconLoader2 className="w-3 h-3 animate-spin" />
                Working
              </Badge>
            )}
            {demoPhase === 'approval' && (
              <Badge className="gap-1 bg-amber-500 hover:bg-amber-500">
                <IconShieldCheck className="w-3 h-3" />
                Needs Approval
              </Badge>
            )}
            {demoPhase === 'complete' && (
              <Badge className="gap-1 bg-green-500 hover:bg-green-500">
                <IconCircleCheck className="w-3 h-3" />
                Complete
              </Badge>
            )}
          </div>
        </div>

        {/* Demo content */}
        <div className="p-4">
          {!demoStarted ? (
            <div className="text-center py-8">
              <IconRobot className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                See how the agent analyzes a sample deal
              </p>
              <Button size="lg" onClick={startDemo} className="gap-2">
                <IconPlayerPlay className="w-4 h-4" />
                Run Demo
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Activity timeline */}
              <ScrollArea className="h-32 border rounded-lg">
                <div className="p-3 space-y-1.5">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        'text-xs flex items-start gap-2',
                        event.type === 'approval' && 'text-amber-600',
                        event.type === 'complete' && 'text-green-600'
                      )}
                    >
                      <span className="text-muted-foreground shrink-0 w-16">
                        {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span>{event.label}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Mock results display */}
              {showResults && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <IconChartBar className="w-4 h-4 text-primary" />
                      Analysis Results
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Company:</span>
                        <span className="ml-2 font-medium">{MOCK_DEAL.company}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Asking:</span>
                        <span className="ml-2 font-medium">{MOCK_DEAL.asking}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Revenue:</span>
                        <span className="ml-2 font-medium">{MOCK_DEAL.revenue}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">EBITDA:</span>
                        <span className="ml-2 font-medium">{MOCK_DEAL.ebitda}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Buy Box Fit:</span>
                        <Badge variant={MOCK_DEAL.buyBoxFit >= 70 ? 'default' : 'secondary'} className="bg-green-500">
                          {MOCK_DEAL.buyBoxFit}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground italic">{MOCK_DEAL.recommendation}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Approval prompt */}
              {demoPhase === 'approval' && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/50 bg-amber-500/10">
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      Agent wants to draft a broker response
                    </p>
                    <p className="text-xs text-muted-foreground">
                      You always control what gets sent
                    </p>
                  </div>
                  <Button onClick={handleApprove} size="sm" className="bg-amber-500 hover:bg-amber-600">
                    <IconCircleCheck className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                </div>
              )}

              {/* Completion state */}
              {demoPhase === 'complete' && (
                <div className="text-center py-4">
                  <IconCircleCheck className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">Demo Complete!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The agent analyzed the deal and drafted a response - with your approval.
                  </p>
                  <Button variant="outline" size="sm" onClick={resetDemo} className="mt-3">
                    Run Again
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentDemoStep;
