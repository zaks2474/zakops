/**
 * CompleteStep Component
 *
 * Final step - summary and next steps.
 */

'use client';

import { Badge } from '@/components/ui/badge';
import {
  IconCheck,
  IconMail,
  IconRobot,
  IconBell,
  IconArrowRight,
} from '@tabler/icons-react';
import type { OnboardingState } from '../OnboardingWizard';

// =============================================================================
// Types
// =============================================================================

interface CompleteStepProps {
  state: OnboardingState;
}

// =============================================================================
// Component
// =============================================================================

export function CompleteStep({ state }: CompleteStepProps) {
  const setupItems = [
    {
      icon: IconMail,
      label: 'Email Connection',
      status: state.emailConnected ? 'Connected' : 'Skipped',
      detail: state.emailAddress,
      isComplete: state.emailConnected,
    },
    {
      icon: IconRobot,
      label: 'AI Agent',
      status: state.agentEnabled ? 'Enabled' : 'Disabled',
      detail:
        state.agentEnabled && state.autoApproveLevel === 'low'
          ? 'Auto-approve low risk'
          : state.agentEnabled && state.autoApproveLevel === 'medium'
          ? 'Auto-approve medium risk'
          : state.agentEnabled
          ? 'Manual approval'
          : undefined,
      isComplete: state.agentEnabled,
    },
    {
      icon: IconBell,
      label: 'Notifications',
      status: 'Configured',
      detail: `${
        state.notifications.email ? 'Email' : ''
      }${state.notifications.email && state.notifications.browser ? ' + ' : ''}${
        state.notifications.browser ? 'Browser' : ''
      }${
        state.notifications.digest !== 'none'
          ? ` + ${state.notifications.digest} digest`
          : ''
      }`,
      isComplete: true,
    },
  ];

  const nextSteps = [
    'Review your deal quarantine queue',
    'Explore the pipeline dashboard',
    'Try asking the agent a question',
  ];

  return (
    <div className="space-y-6">
      {/* Success message */}
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconCheck className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold mb-1">You're All Set!</h2>
        <p className="text-sm text-muted-foreground">
          ZakOps is ready to help you manage your deal pipeline.
        </p>
      </div>

      {/* Setup summary */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Your Setup</h3>
        {setupItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.detail && (
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  )}
                </div>
              </div>
              <Badge
                variant={item.isComplete ? 'default' : 'secondary'}
                className={item.isComplete ? 'bg-green-500' : ''}
              >
                {item.status}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Next steps */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3">Suggested Next Steps</h3>
        <ul className="space-y-2">
          {nextSteps.map((step, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconArrowRight className="w-3 h-3" />
              {step}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default CompleteStep;
