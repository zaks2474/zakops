/**
 * AgentConfigStep Component
 *
 * Configure AI agent behavior and approval settings.
 */

'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import {
  IconRobot,
  IconShieldCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';

// =============================================================================
// Types
// =============================================================================

interface AgentConfigStepProps {
  enabled: boolean;
  autoApproveLevel: 'none' | 'low' | 'medium';
  onUpdate: (updates: { enabled?: boolean; autoApproveLevel?: 'none' | 'low' | 'medium' }) => void;
}

// =============================================================================
// Component
// =============================================================================

export function AgentConfigStep({
  enabled,
  autoApproveLevel,
  onUpdate,
}: AgentConfigStepProps) {
  const approvalOptions = [
    {
      value: 'none',
      label: 'Manual Everything',
      description: 'All agent actions require your approval',
      badge: 'Most Control',
      badgeVariant: 'default' as const,
    },
    {
      value: 'low',
      label: 'Auto-approve Low Risk',
      description: 'Read-only operations run automatically; writes need approval',
      badge: 'Recommended',
      badgeVariant: 'default' as const,
    },
    {
      value: 'medium',
      label: 'Auto-approve Medium Risk',
      description: 'Most operations run automatically; only high-impact actions need approval',
      badge: 'Faster',
      badgeVariant: 'secondary' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Enable agent toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <IconRobot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <Label htmlFor="agent-enabled" className="font-medium">
              Enable AI Agent
            </Label>
            <p className="text-sm text-muted-foreground">
              Let the agent assist with deal analysis and actions
            </p>
          </div>
        </div>
        <Switch
          id="agent-enabled"
          checked={enabled}
          onCheckedChange={(checked) => onUpdate({ enabled: checked })}
        />
      </div>

      {/* Auto-approve level */}
      {enabled && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <IconShieldCheck className="w-4 h-4 text-muted-foreground" />
            <Label className="font-medium">Approval Mode</Label>
          </div>

          <RadioGroup
            value={autoApproveLevel}
            onValueChange={(value) =>
              onUpdate({ autoApproveLevel: value as 'none' | 'low' | 'medium' })
            }
            className="space-y-3"
          >
            {approvalOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  autoApproveLevel === option.value
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent/50'
                }`}
              >
                <RadioGroupItem value={option.value} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.label}</span>
                    <Badge variant={option.badgeVariant} className="text-xs">
                      {option.badge}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {option.description}
                  </p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>
      )}

      {/* Risk level explanation */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium">Risk Levels Explained</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
              Low
            </Badge>
            <span className="text-muted-foreground">
              Read data, search documents, analyze content
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
              Medium
            </Badge>
            <span className="text-muted-foreground">
              Update deal profiles, create notes, move stages
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
              High
            </Badge>
            <span className="text-muted-foreground">
              Send emails, create documents, external actions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentConfigStep;
