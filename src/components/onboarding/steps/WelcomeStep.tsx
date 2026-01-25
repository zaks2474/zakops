/**
 * WelcomeStep Component
 *
 * First step of onboarding - welcome message and overview.
 * Capability cards are clickable and open modals with feature details.
 */

'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  IconRobot,
  IconShieldCheck,
  IconTimeline,
  IconMail,
  IconChevronRight,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { CapabilityModal, type CapabilityId } from '../CapabilityModal';

// =============================================================================
// Types
// =============================================================================

interface Feature {
  id: CapabilityId;
  icon: typeof IconMail;
  title: string;
  description: string;
}

// =============================================================================
// Configuration
// =============================================================================

const FEATURES: Feature[] = [
  {
    id: 'email-triage',
    icon: IconMail,
    title: 'Smart Email Triage',
    description: 'Automatically sort and prioritize deal emails',
  },
  {
    id: 'ai-agent',
    icon: IconRobot,
    title: 'AI-Powered Agent',
    description: 'Get intelligent assistance for deal analysis',
  },
  {
    id: 'human-in-loop',
    icon: IconShieldCheck,
    title: 'Human-in-the-Loop',
    description: 'You stay in control with approval workflows',
  },
  {
    id: 'deal-pipeline',
    icon: IconTimeline,
    title: 'Deal Pipeline',
    description: 'Track deals from inbound to close',
  },
];

// =============================================================================
// Component
// =============================================================================

export function WelcomeStep() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCapability, setSelectedCapability] = useState<CapabilityId | null>(null);

  const handleCardClick = (capabilityId: CapabilityId) => {
    setSelectedCapability(capabilityId);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconRobot className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Welcome to ZakOps</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your AI-powered deal lifecycle operating system. Let's get you set up in just a few minutes.
        </p>
      </div>

      {/* Features grid - now clickable */}
      <div className="grid grid-cols-2 gap-4">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <button
              key={feature.id}
              onClick={() => handleCardClick(feature.id)}
              className={cn(
                'group text-left p-4 rounded-lg border bg-card',
                'hover:bg-accent/50 hover:border-primary/50 transition-all',
                'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
              )}
            >
              <div className="flex items-start justify-between">
                <Icon className="w-5 h-5 text-primary mb-2" />
                <IconChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className="font-medium text-sm">{feature.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {feature.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Hint text */}
      <p className="text-xs text-center text-muted-foreground">
        Click any feature to learn more
      </p>

      {/* What to expect */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="text-sm font-medium mb-2">What we'll set up:</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Badge variant="outline" className="h-5 text-xs">1</Badge>
            Connect your deal email inbox
          </li>
          <li className="flex items-center gap-2">
            <Badge variant="outline" className="h-5 text-xs">2</Badge>
            Meet your AI agent
          </li>
          <li className="flex items-center gap-2">
            <Badge variant="outline" className="h-5 text-xs">3</Badge>
            Set up notifications
          </li>
        </ul>
      </div>

      {/* Capability Modal */}
      <CapabilityModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        capabilityId={selectedCapability}
      />
    </div>
  );
}

export default WelcomeStep;
