/**
 * DealChat Component
 *
 * Chat interface for interacting with the agent in deal context.
 * Features:
 * - Message history
 * - Streaming responses
 * - Tool call display
 * - Approval inline
 * - Quick actions
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  IconSend,
  IconRobot,
  IconUser,
  IconLoader2,
  IconSparkles,
  IconTool,
  IconShieldCheck,
  IconCheck,
  IconX,
  IconRefresh,
  IconBrain,
} from '@tabler/icons-react';
import { format } from 'date-fns';
import { ToolCallCard } from '@/components/agent/ToolCallCard';
import { ThinkingIndicator } from '@/components/agent/ReasoningDisplay';
import type { AgentToolCall } from '@/types/execution-contracts';

// =============================================================================
// Types
// =============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: AgentToolCall[];
  isStreaming?: boolean;
}

interface DealChatProps {
  dealId: string;
  threadId?: string;
  messages: ChatMessage[];
  isLoading?: boolean;
  isStreaming?: boolean;
  streamingContent?: string;
  pendingApprovals?: AgentToolCall[];
  onSend: (message: string) => Promise<void>;
  onApprove?: (toolCallId: string) => Promise<void>;
  onReject?: (toolCallId: string) => Promise<void>;
  onRetry?: () => void;
  className?: string;
}

// =============================================================================
// Quick Actions
// =============================================================================

const QUICK_ACTIONS = [
  { label: 'Summarize deal', prompt: 'Summarize this deal and its current status' },
  { label: 'Next steps', prompt: 'What are the recommended next steps for this deal?' },
  { label: 'Check documents', prompt: 'Review the documents and highlight any missing items' },
  { label: 'Draft email', prompt: 'Draft a follow-up email to the broker' },
];

// =============================================================================
// Component
// =============================================================================

export function DealChat({
  dealId,
  threadId,
  messages,
  isLoading = false,
  isStreaming = false,
  streamingContent = '',
  pendingApprovals = [],
  onSend,
  onApprove,
  onReject,
  onRetry,
  className = '',
}: DealChatProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streamingContent]);

  // Handle send
  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSend(input.trim());
      setInput('');
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, onSend]);

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle quick action
  const handleQuickAction = async (prompt: string) => {
    setIsSending(true);
    try {
      await onSend(prompt);
    } finally {
      setIsSending(false);
    }
  };

  const isDisabled = isLoading || isStreaming || isSending;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <IconSparkles className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Chat with the Agent</p>
              <p className="text-xs text-muted-foreground mb-4">
                Ask questions about this deal or request actions
              </p>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action.prompt)}
                    disabled={isDisabled}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <div className="flex gap-3">
              <div className="p-2 rounded-full bg-primary/20 h-fit">
                <IconRobot className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 bg-muted rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">
                  {streamingContent}
                  <span className="inline-block w-2 h-4 bg-primary ml-0.5 animate-pulse" />
                </p>
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {isLoading && !isStreaming && (
            <div className="flex gap-3">
              <div className="p-2 rounded-full bg-primary/20 h-fit">
                <IconBrain className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <div className="flex-1">
                <ThinkingIndicator />
              </div>
            </div>
          )}

          {/* Pending approvals */}
          {pendingApprovals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-amber-500">
                <IconShieldCheck className="w-4 h-4" />
                <span>
                  {pendingApprovals.length} action{pendingApprovals.length > 1 ? 's' : ''} awaiting approval
                </span>
              </div>
              {pendingApprovals.map((tc) => (
                <ToolCallCard
                  key={tc.tool_call_id}
                  toolCall={tc}
                  onApprove={onApprove ? () => onApprove(tc.tool_call_id) : undefined}
                  onReject={onReject ? () => onReject(tc.tool_call_id) : undefined}
                  showApprovalActions
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <CardFooter className="border-t p-4">
        <div className="flex gap-2 w-full">
          <div className="flex-1 relative">
            <Textarea
              ref={inputRef}
              placeholder="Ask about this deal..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isDisabled}
              className="min-h-[44px] max-h-32 resize-none pr-10"
              rows={1}
            />
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSend}
                  disabled={isDisabled || !input.trim()}
                  size="sm"
                  className="h-11 w-11 p-0"
                >
                  {isSending || isLoading ? (
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <IconSend className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send message</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {onRetry && messages.length > 0 && !isLoading && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 w-11 p-0"
                    onClick={onRetry}
                  >
                    <IconRefresh className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Retry last message</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardFooter>
    </div>
  );
}

// =============================================================================
// Chat Message Bubble
// =============================================================================

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onApprove?: (toolCallId: string) => Promise<void>;
  onReject?: (toolCallId: string) => Promise<void>;
}

function ChatMessageBubble({ message, onApprove, onReject }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="text-center">
        <Badge variant="outline" className="text-xs">
          {message.content}
        </Badge>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`p-2 rounded-full h-fit ${
          isUser ? 'bg-primary' : 'bg-primary/20'
        }`}
      >
        {isUser ? (
          <IconUser className="w-4 h-4 text-primary-foreground" />
        ) : (
          <IconRobot className="w-4 h-4 text-primary" />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 max-w-[80%] ${
          isUser ? 'text-right' : ''
        }`}
      >
        <div
          className={`inline-block rounded-lg p-3 ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.toolCalls.map((tc) => (
              <ToolCallCard
                key={tc.tool_call_id}
                toolCall={tc}
                compact
                showApprovalActions={tc.status === 'pending' && tc.requires_approval}
                onApprove={onApprove ? () => onApprove(tc.tool_call_id) : undefined}
                onReject={onReject ? () => onReject(tc.tool_call_id) : undefined}
              />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-1">
          {format(message.timestamp, 'HH:mm')}
        </p>
      </div>
    </div>
  );
}

export default DealChat;
