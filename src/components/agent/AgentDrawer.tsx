/**
 * AgentDrawer Component
 *
 * Global drawer for consistent "Ask Agent" experience.
 * All "Ask Agent" buttons across the app use this via useAskAgent hook.
 *
 * Features:
 * - Opens from any component using useAskAgent()
 * - Receives context (dealId, dealName, initialQuestion)
 * - Provides consistent chat interface
 */

'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { IconRobot, IconSend, IconLoader2 } from '@tabler/icons-react';

// =============================================================================
// Types
// =============================================================================

interface AgentDrawerContext {
  dealId?: string;
  dealName?: string;
  initialQuestion?: string;
}

interface AgentDrawerState {
  isOpen: boolean;
  context: AgentDrawerContext | null;
}

interface AgentDrawerContextValue {
  state: AgentDrawerState;
  open: (context?: AgentDrawerContext) => void;
  close: () => void;
}

// =============================================================================
// Context
// =============================================================================

const AgentDrawerContext = createContext<AgentDrawerContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

export function AgentDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AgentDrawerState>({
    isOpen: false,
    context: null,
  });

  const open = useCallback((context?: AgentDrawerContext) => {
    setState({ isOpen: true, context: context ?? null });
  }, []);

  const close = useCallback(() => {
    setState({ isOpen: false, context: null });
  }, []);

  return (
    <AgentDrawerContext.Provider value={{ state, open, close }}>
      {children}
      <AgentDrawerComponent />
    </AgentDrawerContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for opening the Agent Drawer from anywhere in the app.
 *
 * @example
 * const askAgent = useAskAgent();
 *
 * // Open without context
 * askAgent();
 *
 * // Open with deal context
 * askAgent({ dealId: 'DEAL-001', dealName: 'TechWidget', initialQuestion: 'Analyze financials' });
 */
export function useAskAgent() {
  const ctx = useContext(AgentDrawerContext);
  if (!ctx) {
    throw new Error('useAskAgent must be used within AgentDrawerProvider');
  }
  return ctx.open;
}

/**
 * Hook for closing the Agent Drawer
 */
export function useCloseAgentDrawer() {
  const ctx = useContext(AgentDrawerContext);
  if (!ctx) {
    throw new Error('useCloseAgentDrawer must be used within AgentDrawerProvider');
  }
  return ctx.close;
}

// =============================================================================
// Drawer Component
// =============================================================================

function AgentDrawerComponent() {
  const ctx = useContext(AgentDrawerContext);
  if (!ctx) return null;

  const { state, close } = ctx;

  return (
    <Sheet open={state.isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="w-full max-w-md sm:max-w-lg flex flex-col overflow-hidden">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <IconRobot className="h-5 w-5" />
            {state.context?.dealName
              ? `Ask about ${state.context.dealName}`
              : 'Ask Agent'}
          </SheetTitle>
          <SheetDescription>
            {state.context?.dealId
              ? `Get help with ${state.context.dealName || state.context.dealId}`
              : 'Ask questions or request actions from the AI agent'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 mt-4">
          <AgentChat
            dealId={state.context?.dealId}
            dealName={state.context?.dealName}
            initialQuestion={state.context?.initialQuestion}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =============================================================================
// Chat Component
// =============================================================================

interface AgentChatProps {
  dealId?: string;
  dealName?: string;
  initialQuestion?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function AgentChat({ dealId, dealName, initialQuestion }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialQuestion || '');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build context for the agent
      const context = dealId ? { dealId, dealName } : undefined;

      // In production, this would call the actual chat API
      // For now, we simulate a response
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: dealId
          ? `I'll help you with ${dealName || dealId}. You asked: "${userMessage.content}"\n\nThis feature connects to the agent backend. For now, please use the Chat page for full agent interactions.`
          : `You asked: "${userMessage.content}"\n\nThis quick-ask feature is being connected to the agent backend. For full agent interactions, please visit the Chat page.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or use the Chat page for full agent interactions.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Context Badge */}
      {dealId && (
        <div className="mb-3">
          <Badge variant="outline" className="text-xs">
            Context: {dealName || dealId}
          </Badge>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <IconRobot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {dealId
                  ? `Ask me anything about ${dealName || 'this deal'}`
                  : 'Ask me anything about your deals'}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {dealId ? (
                  <>
                    <SuggestionButton
                      onClick={() => setInput('Analyze the financials')}
                      label="Analyze financials"
                    />
                    <SuggestionButton
                      onClick={() => setInput('Score buy box fit')}
                      label="Score buy box"
                    />
                    <SuggestionButton
                      onClick={() => setInput('Draft a broker response')}
                      label="Draft email"
                    />
                  </>
                ) : (
                  <>
                    <SuggestionButton
                      onClick={() => setInput('Show me deals needing attention')}
                      label="Deals needing attention"
                    />
                    <SuggestionButton
                      onClick={() => setInput('What should I focus on today?')}
                      label="Today's priorities"
                    />
                  </>
                )}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <IconLoader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 pt-4 border-t mt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={dealId ? `Ask about ${dealName || 'this deal'}...` : 'Ask the agent...'}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
            {isLoading ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconSend className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function SuggestionButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="text-xs">
      {label}
    </Button>
  );
}
