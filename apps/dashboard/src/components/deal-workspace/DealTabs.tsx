/**
 * DealTabs Component
 *
 * Tab navigation for deal workspace with:
 * - Documents
 * - Timeline
 * - Analysis
 * - Actions
 * - Chat (Agent)
 */

'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  IconFiles,
  IconTimeline,
  IconBrain,
  IconListCheck,
  IconMessageCircle,
  IconShieldCheck,
} from '@tabler/icons-react';

// =============================================================================
// Types
// =============================================================================

export type DealTabId = 'documents' | 'timeline' | 'analysis' | 'actions' | 'chat';

interface DealTabConfig {
  id: DealTabId;
  label: string;
  icon: typeof IconFiles;
  badge?: number;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

interface DealTabsProps {
  activeTab: DealTabId;
  onTabChange: (tab: DealTabId) => void;
  documentCount?: number;
  actionCount?: number;
  pendingApprovals?: number;
  className?: string;
  children?: React.ReactNode;
}

// =============================================================================
// Component
// =============================================================================

export function DealTabs({
  activeTab,
  onTabChange,
  documentCount = 0,
  actionCount = 0,
  pendingApprovals = 0,
  className = '',
  children,
}: DealTabsProps) {
  const tabs: DealTabConfig[] = [
    {
      id: 'documents',
      label: 'Documents',
      icon: IconFiles,
      badge: documentCount > 0 ? documentCount : undefined,
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: IconTimeline,
    },
    {
      id: 'analysis',
      label: 'Analysis',
      icon: IconBrain,
    },
    {
      id: 'actions',
      label: 'Actions',
      icon: IconListCheck,
      badge: actionCount > 0 ? actionCount : undefined,
    },
    {
      id: 'chat',
      label: 'Agent',
      icon: IconMessageCircle,
      badge: pendingApprovals > 0 ? pendingApprovals : undefined,
      badgeVariant: pendingApprovals > 0 ? 'default' : 'secondary',
    },
  ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onTabChange(v as DealTabId)}
      className={`flex flex-col h-full ${className}`}
    >
      <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 px-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 gap-2"
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.badge !== undefined && (
                <Badge
                  variant={tab.badgeVariant || 'secondary'}
                  className={`h-5 min-w-[20px] px-1.5 text-xs ${
                    tab.id === 'chat' && pendingApprovals > 0
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : ''
                  }`}
                >
                  {tab.badge}
                </Badge>
              )}
              {/* Approval indicator */}
              {tab.id === 'chat' && pendingApprovals > 0 && (
                <IconShieldCheck className="w-3 h-3 text-amber-500 ml-0.5" />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </Tabs>
  );
}

// =============================================================================
// Tab Content Wrapper
// =============================================================================

interface DealTabContentProps {
  tab: DealTabId;
  children: React.ReactNode;
  className?: string;
}

export function DealTabContent({ tab, children, className = '' }: DealTabContentProps) {
  return (
    <TabsContent
      value={tab}
      className={`h-full mt-0 focus-visible:outline-none focus-visible:ring-0 ${className}`}
    >
      {children}
    </TabsContent>
  );
}

export default DealTabs;
