/**
 * CapabilityModal Component
 *
 * Modal explaining ZakOps capabilities with deep links to relevant pages.
 */

'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  IconMail,
  IconRobot,
  IconShieldCheck,
  IconDatabase,
  IconArrowRight,
  IconCheck,
} from '@tabler/icons-react';

// =============================================================================
// Types
// =============================================================================

export type CapabilityId = 'email-triage' | 'ai-agent' | 'human-in-loop' | 'deal-pipeline';

interface CapabilityConfig {
  title: string;
  description: string;
  icon: typeof IconMail;
  details: string[];
  deepLink: string;
  deepLinkLabel: string;
}

interface CapabilityModalProps {
  open: boolean;
  onClose: () => void;
  capabilityId: CapabilityId | null;
}

// =============================================================================
// Configuration
// =============================================================================

const CAPABILITY_CONFIG: Record<CapabilityId, CapabilityConfig> = {
  'email-triage': {
    title: 'Smart Email Triage',
    description:
      'Incoming deal emails are automatically classified, prioritized, and routed. The agent extracts key deal information and scores against your buy box.',
    icon: IconMail,
    details: [
      'Automatically identifies deal-related emails',
      'Extracts key financials and deal terms',
      'Scores deals against your buy box criteria',
      'Routes to quarantine for your review',
    ],
    deepLink: '/settings',
    deepLinkLabel: 'Configure Email Settings',
  },
  'ai-agent': {
    title: 'AI-Powered Agent',
    description:
      'Your dedicated deal analyst works 24/7. It reads documents, researches companies, drafts communications, and maintains your deal pipeline—always under your supervision.',
    icon: IconRobot,
    details: [
      'Analyzes CIMs, teasers, and financials',
      'Researches company backgrounds',
      'Drafts professional broker responses',
      'Maintains comprehensive deal timeline',
    ],
    deepLink: '/agent/activity',
    deepLinkLabel: 'View Agent Activity',
  },
  'human-in-loop': {
    title: 'Human-in-the-Loop Controls',
    description:
      'Every significant action requires your approval. Review proposed emails, deal stage changes, and document analyses before execution. You stay in control.',
    icon: IconShieldCheck,
    details: [
      'All outbound communications need approval',
      'Deal stage changes require confirmation',
      'Clear audit trail of all actions',
      'Configurable approval thresholds',
    ],
    deepLink: '/hq',
    deepLinkLabel: 'View Pending Approvals',
  },
  'deal-pipeline': {
    title: 'Deal Pipeline & Tracking',
    description:
      'Track deals from first contact to close. The agent builds context from CIMs, teasers, financials, and your notes to provide informed analysis.',
    icon: IconDatabase,
    details: [
      'Visual pipeline with deal stages',
      'Document indexing and search',
      'Deal scoring and comparisons',
      'Activity timeline per deal',
    ],
    deepLink: '/deals',
    deepLinkLabel: 'View Deal Pipeline',
  },
};

// =============================================================================
// Component
// =============================================================================

export function CapabilityModal({ open, onClose, capabilityId }: CapabilityModalProps) {
  const router = useRouter();

  if (!capabilityId) return null;

  const config = CAPABILITY_CONFIG[capabilityId];
  const Icon = config.icon;

  const handleDeepLink = () => {
    onClose();
    router.push(config.deepLink);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle>{config.title}</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Feature list */}
          <div className="space-y-2">
            {config.details.map((detail, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <IconCheck className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">{detail}</span>
              </div>
            ))}
          </div>

          {/* Why this matters */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Why this matters:</strong> This feature saves
              you hours of manual work by automating routine tasks while keeping you in control
              of all important decisions.
            </p>
          </div>
        </div>

        <div className="flex justify-between gap-3">
          <Button variant="outline" onClick={onClose}>
            Got it
          </Button>
          <Button onClick={handleDeepLink}>
            {config.deepLinkLabel}
            <IconArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CapabilityModal;
