/**
 * ApprovalPreview Component
 *
 * Shows a preview of what an agent tool will do when executed.
 * Renders different previews based on tool type.
 */

'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  IconMail,
  IconFile,
  IconFolder,
  IconDatabase,
  IconArrowRight,
  IconEdit,
  IconPlus,
  IconCheck,
  IconExternalLink,
} from '@tabler/icons-react';
import { getToolDefinition } from '@/lib/agent/toolRegistry';
import type { AgentToolCall } from '@/types/execution-contracts';

// =============================================================================
// Types
// =============================================================================

interface ApprovalPreviewProps {
  toolCall: AgentToolCall;
  className?: string;
}

interface PreviewContent {
  icon: typeof IconMail;
  title: string;
  description: string;
  details?: Array<{ label: string; value: string }>;
  impact?: string;
}

// =============================================================================
// Preview Generators
// =============================================================================

function generatePreview(toolName: string, inputs: Record<string, unknown>): PreviewContent {
  switch (toolName) {
    case 'update_deal_stage':
      return {
        icon: IconArrowRight,
        title: 'Move Deal Stage',
        description: `Move deal to "${inputs.stage}" stage`,
        details: [
          { label: 'Target Stage', value: String(inputs.stage) },
          ...(inputs.reason ? [{ label: 'Reason', value: String(inputs.reason) }] : []),
        ],
        impact: 'Deal will appear in the new pipeline stage',
      };

    case 'send_email':
      return {
        icon: IconMail,
        title: 'Send Email',
        description: `Email to ${inputs.to}`,
        details: [
          { label: 'To', value: String(inputs.to) },
          { label: 'Subject', value: String(inputs.subject) },
          ...(inputs.cc ? [{ label: 'CC', value: String(inputs.cc) }] : []),
        ],
        impact: 'Email will be sent immediately',
      };

    case 'create_document':
    case 'write_deal_artifact':
      return {
        icon: IconFile,
        title: 'Create File',
        description: `Create "${inputs.filename}"`,
        details: [
          { label: 'Filename', value: String(inputs.filename) },
          ...(inputs.path ? [{ label: 'Path', value: String(inputs.path) }] : []),
          ...(inputs.content_type ? [{ label: 'Type', value: String(inputs.content_type) }] : []),
        ],
        impact: 'File will be created in the deal folder',
      };

    case 'update_deal_profile':
      const updates = inputs.updates as Record<string, unknown> | undefined;
      const fieldCount = updates ? Object.keys(updates).length : 0;
      return {
        icon: IconEdit,
        title: 'Update Deal Profile',
        description: `Update ${fieldCount} profile field${fieldCount !== 1 ? 's' : ''}`,
        details: updates
          ? Object.entries(updates).slice(0, 5).map(([key, value]) => ({
              label: key,
              value: typeof value === 'object' ? JSON.stringify(value) : String(value),
            }))
          : [],
        impact: 'Deal profile will be modified',
      };

    case 'create_action':
      return {
        icon: IconPlus,
        title: 'Create Action',
        description: `Create action: ${inputs.title}`,
        details: [
          { label: 'Title', value: String(inputs.title) },
          { label: 'Type', value: String(inputs.action_type) },
          ...(inputs.priority ? [{ label: 'Priority', value: String(inputs.priority) }] : []),
        ],
        impact: 'A new action will be created for this deal',
      };

    case 'approve_quarantine':
      return {
        icon: IconCheck,
        title: 'Approve Quarantine Item',
        description: 'Create a new deal from quarantine',
        details: [
          ...(inputs.quarantine_id ? [{ label: 'Quarantine ID', value: String(inputs.quarantine_id) }] : []),
          ...(inputs.deal_name ? [{ label: 'Deal Name', value: String(inputs.deal_name) }] : []),
        ],
        impact: 'A new deal will be created and added to the pipeline',
      };

    case 'send_followup':
      return {
        icon: IconMail,
        title: 'Send Follow-up',
        description: `Follow-up to ${inputs.recipient}`,
        details: [
          { label: 'Recipient', value: String(inputs.recipient) },
          ...(inputs.template ? [{ label: 'Template', value: String(inputs.template) }] : []),
        ],
        impact: 'Follow-up message will be sent',
      };

    default:
      const toolDef = getToolDefinition(toolName);
      return {
        icon: IconDatabase,
        title: toolDef?.description || toolName,
        description: `Execute ${toolName}`,
        details: Object.entries(inputs).slice(0, 4).map(([key, value]) => ({
          label: key,
          value: typeof value === 'object' ? JSON.stringify(value).slice(0, 50) : String(value).slice(0, 50),
        })),
        impact: toolDef?.externalImpact ? 'This action has external effects' : undefined,
      };
  }
}

// =============================================================================
// Component
// =============================================================================

export function ApprovalPreview({ toolCall, className = '' }: ApprovalPreviewProps) {
  const preview = useMemo(
    () => generatePreview(toolCall.tool_name, toolCall.tool_input),
    [toolCall.tool_name, toolCall.tool_input]
  );

  const Icon = preview.icon;
  const toolDef = getToolDefinition(toolCall.tool_name);
  const hasExternalImpact = toolDef?.externalImpact ?? false;

  return (
    <Card className={`bg-muted/50 ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-background">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm">{preview.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{preview.description}</p>
          </div>
          {hasExternalImpact && (
            <Badge
              variant="outline"
              className="ml-auto bg-purple-500/10 text-purple-500 border-purple-500/20"
            >
              <IconExternalLink className="w-3 h-3 mr-1" />
              External
            </Badge>
          )}
        </div>
      </CardHeader>

      {(preview.details && preview.details.length > 0) && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {preview.details.map((detail, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{detail.label}:</span>
                <span className="font-mono text-xs max-w-[200px] truncate">
                  {detail.value}
                </span>
              </div>
            ))}
          </div>

          {preview.impact && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                <strong>Impact:</strong> {preview.impact}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default ApprovalPreview;
