/**
 * DealWorkspace Component
 *
 * Main "Operating Room" for a deal.
 * Combines all deal-related views:
 * - Header with deal info
 * - Tabbed content area
 * - Agent panel sidebar
 */

'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/api-client';
import { DealHeader } from './DealHeader';
import { DealTabs, DealTabContent, type DealTabId } from './DealTabs';
import { DealTimeline } from './DealTimeline';
import { DealDocuments, type DealDocument } from './DealDocuments';
import { DealChat } from './DealChat';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { ApprovalBadge } from '@/components/approvals/ApprovalBadge';
import type { Deal, DealEvent, Action } from '@/types/api';
import type { AgentToolCall } from '@/types/execution-contracts';
import {
  IconLayoutSidebarRight,
  IconLayoutSidebarRightCollapse,
  IconRobot,
} from '@tabler/icons-react';

// =============================================================================
// Types
// =============================================================================

interface DealWorkspaceProps {
  deal: Deal;
  events?: DealEvent[];
  documents?: DealDocument[];
  actions?: Action[];
  threadId?: string;
  runId?: string;
  isLoading?: boolean;
  onStageChange?: (stage: string) => void;
  onArchive?: () => void;
  className?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: AgentToolCall[];
}

// =============================================================================
// Component
// =============================================================================

export function DealWorkspace({
  deal,
  events = [],
  documents = [],
  actions = [],
  threadId,
  runId,
  isLoading = false,
  onStageChange,
  onArchive,
  className = '',
}: DealWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<DealTabId>('documents');
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // Count pending approvals for badge
  const pendingApprovals: AgentToolCall[] = []; // Would be populated from agent state

  // Handle chat send
  const handleChatSend = useCallback(async (message: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);

    // Simulate agent response (in real implementation, this would call the agent API)
    setIsStreaming(true);
    setStreamingContent('');

    // Simulate streaming
    const response = `I'll help you with that request for deal "${deal.display_name || deal.canonical_name}".`;
    for (let i = 0; i < response.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      setStreamingContent((prev) => prev + response[i]);
    }

    setIsStreaming(false);
    setStreamingContent('');

    // Add assistant message
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, assistantMessage]);
  }, [deal]);

  // Handle approval actions
  const handleApprove = useCallback(async (toolCallId: string) => {
    // Would call approval API
    console.log('Approve:', toolCallId);
  }, []);

  const handleReject = useCallback(async (toolCallId: string) => {
    // Would call rejection API
    console.log('Reject:', toolCallId);
  }, []);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <DealHeader
        deal={deal}
        onStageChange={onStageChange}
        onArchive={onArchive}
      />

      {/* Main content area with optional sidebar */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Main content */}
        <ResizablePanel defaultSize={showAgentPanel ? 65 : 100} minSize={50}>
          <DealTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            documentCount={documents.length}
            actionCount={actions.filter((a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED').length}
            pendingApprovals={pendingApprovals.length}
          >
            {/* Documents tab */}
            <DealTabContent tab="documents">
              <DealDocuments
                documents={documents}
                onPreview={(doc) => console.log('Preview:', doc)}
                onDownload={(doc) => console.log('Download:', doc)}
              />
            </DealTabContent>

            {/* Timeline tab */}
            <DealTabContent tab="timeline">
              <DealTimeline events={events} isLoading={isLoading} />
            </DealTabContent>

            {/* Analysis tab */}
            <DealTabContent tab="analysis">
              <div className="p-6">
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">Analysis view coming soon</p>
                </div>
              </div>
            </DealTabContent>

            {/* Actions tab */}
            <DealTabContent tab="actions">
              <div className="p-6">
                {actions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">No actions for this deal</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Would render action cards here */}
                    <p className="text-sm text-muted-foreground">
                      {actions.length} action{actions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
            </DealTabContent>

            {/* Chat tab */}
            <DealTabContent tab="chat">
              <DealChat
                dealId={deal.deal_id}
                threadId={threadId}
                messages={chatMessages}
                isStreaming={isStreaming}
                streamingContent={streamingContent}
                pendingApprovals={pendingApprovals}
                onSend={handleChatSend}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </DealTabContent>
          </DealTabs>
        </ResizablePanel>

        {/* Agent panel sidebar */}
        {showAgentPanel && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
              <div className="h-full border-l flex flex-col">
                {/* Sidebar header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
                  <div className="flex items-center gap-2">
                    <IconRobot className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">Agent Activity</span>
                    <ApprovalBadge variant="count" />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setShowAgentPanel(false)}
                  >
                    <IconLayoutSidebarRightCollapse className="w-4 h-4" />
                  </Button>
                </div>

                {/* Agent panel content */}
                {threadId && runId ? (
                  <AgentPanel
                    threadId={threadId}
                    runId={runId}
                    variant="sidebar"
                    showHeader={false}
                    className="flex-1"
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center p-4">
                      <IconRobot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No active agent run</p>
                      <p className="text-xs mt-1">Start a conversation to see agent activity</p>
                    </div>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Toggle button when sidebar is hidden */}
      {!showAgentPanel && (
        <Button
          variant="outline"
          size="sm"
          className="fixed right-4 bottom-4 gap-2"
          onClick={() => setShowAgentPanel(true)}
        >
          <IconLayoutSidebarRight className="w-4 h-4" />
          Show Agent
          <ApprovalBadge variant="count" />
        </Button>
      )}
    </div>
  );
}

export default DealWorkspace;
