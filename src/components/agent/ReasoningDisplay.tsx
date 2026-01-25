/**
 * ReasoningDisplay Component
 *
 * Shows the agent's reasoning/thinking process with:
 * - Streaming text display
 * - Collapsible sections
 * - Thinking indicator animation
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  IconBrain,
  IconChevronDown,
  IconLoader2,
} from '@tabler/icons-react';

// =============================================================================
// Types
// =============================================================================

interface ReasoningDisplayProps {
  thinking: string | null;
  isStreaming: boolean;
  streamTokens?: string[];
  className?: string;
  defaultExpanded?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function ReasoningDisplay({
  thinking,
  isStreaming,
  streamTokens = [],
  className = '',
  defaultExpanded = true,
}: ReasoningDisplayProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new tokens arrive
  useEffect(() => {
    if (contentRef.current && isStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamTokens.length, isStreaming]);

  // Combine thinking and stream tokens
  const displayText = streamTokens.length > 0
    ? streamTokens.join('')
    : thinking || '';

  if (!displayText && !isStreaming) {
    return null;
  }

  return (
    <Card className={`border-blue-500/20 bg-blue-500/5 ${className}`}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-between w-full hover:text-primary transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-blue-500/20">
                  {isStreaming ? (
                    <IconLoader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  ) : (
                    <IconBrain className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <CardTitle className="text-sm font-medium">Agent Reasoning</CardTitle>
                {isStreaming && (
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 animate-pulse" />
                    Thinking...
                  </Badge>
                )}
              </div>
              <IconChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  expanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div
              ref={contentRef}
              className="bg-muted/50 rounded-lg p-3 max-h-64 overflow-y-auto"
            >
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {displayText}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-blue-500 ml-0.5 animate-pulse" />
                )}
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// =============================================================================
// Thinking Indicator Component (for inline use)
// =============================================================================

interface ThinkingIndicatorProps {
  message?: string;
  className?: string;
}

export function ThinkingIndicator({
  message = 'Thinking...',
  className = '',
}: ThinkingIndicatorProps) {
  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
      </div>
      <span>{message}</span>
    </div>
  );
}

export default ReasoningDisplay;
