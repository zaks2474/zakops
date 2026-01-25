/**
 * EvidenceLinks Component
 *
 * Displays links to source documents, data points, or evidence
 * that the agent used to make decisions. Supports:
 * - Document references
 * - Deal profile fields
 * - External links
 * - RAG search results
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  IconFileText,
  IconExternalLink,
  IconDatabase,
  IconSearch,
  IconFolder,
  IconLink,
} from '@tabler/icons-react';
import Link from 'next/link';

// =============================================================================
// Types
// =============================================================================

export type EvidenceType = 'document' | 'deal_field' | 'external_link' | 'rag_result' | 'artifact';

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  description?: string;
  url?: string;
  dealId?: string;
  metadata?: Record<string, unknown>;
  relevanceScore?: number;
}

interface EvidenceLinksProps {
  evidence: EvidenceItem[];
  className?: string;
  maxItems?: number;
  showRelevanceScores?: boolean;
}

// =============================================================================
// Icon mapping
// =============================================================================

const TYPE_ICONS: Record<EvidenceType, typeof IconFileText> = {
  document: IconFileText,
  deal_field: IconDatabase,
  external_link: IconExternalLink,
  rag_result: IconSearch,
  artifact: IconFolder,
};

const TYPE_LABELS: Record<EvidenceType, string> = {
  document: 'Document',
  deal_field: 'Deal Data',
  external_link: 'External',
  rag_result: 'Search Result',
  artifact: 'Artifact',
};

const TYPE_COLORS: Record<EvidenceType, string> = {
  document: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  deal_field: 'bg-green-500/10 text-green-500 border-green-500/20',
  external_link: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  rag_result: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  artifact: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
};

// =============================================================================
// Component
// =============================================================================

export function EvidenceLinks({
  evidence,
  className = '',
  maxItems = 5,
  showRelevanceScores = false,
}: EvidenceLinksProps) {
  if (!evidence || evidence.length === 0) {
    return null;
  }

  const displayedEvidence = evidence.slice(0, maxItems);
  const hasMore = evidence.length > maxItems;

  return (
    <Card className={`border-slate-500/20 ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconLink className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Evidence & Sources</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {evidence.length} {evidence.length === 1 ? 'source' : 'sources'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          {displayedEvidence.map((item) => (
            <EvidenceItemRow
              key={item.id}
              item={item}
              showRelevanceScore={showRelevanceScores}
            />
          ))}

          {hasMore && (
            <div className="text-center pt-2">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                +{evidence.length - maxItems} more sources
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Evidence Item Row
// =============================================================================

interface EvidenceItemRowProps {
  item: EvidenceItem;
  showRelevanceScore?: boolean;
}

function EvidenceItemRow({ item, showRelevanceScore }: EvidenceItemRowProps) {
  const Icon = TYPE_ICONS[item.type];
  const colorClass = TYPE_COLORS[item.type];

  const content = (
    <div className="flex items-start gap-3 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors group">
      {/* Type icon */}
      <div className={`p-1.5 rounded ${colorClass}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.title}</span>
          <Badge variant="outline" className={`text-xs shrink-0 ${colorClass}`}>
            {TYPE_LABELS[item.type]}
          </Badge>
          {showRelevanceScore && item.relevanceScore !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(item.relevanceScore * 100)}%
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Relevance score</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {item.description}
          </p>
        )}
      </div>

      {/* External link indicator */}
      {item.url && (
        <IconExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </div>
  );

  // Wrap in link if URL provided
  if (item.url) {
    if (item.url.startsWith('/')) {
      return <Link href={item.url}>{content}</Link>;
    }
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  // Link to deal if dealId provided
  if (item.dealId) {
    return <Link href={`/deals/${item.dealId}`}>{content}</Link>;
  }

  return content;
}

// =============================================================================
// Helper: Create evidence from tool output
// =============================================================================

/**
 * Parse tool output to extract evidence items
 */
export function extractEvidenceFromToolOutput(
  toolName: string,
  output: unknown
): EvidenceItem[] {
  if (!output || typeof output !== 'object') {
    return [];
  }

  const items: EvidenceItem[] = [];
  const data = output as Record<string, unknown>;

  // RAG query results
  if (toolName === 'rag_query_local' && Array.isArray(data.results)) {
    for (const result of data.results) {
      if (typeof result === 'object' && result !== null) {
        const r = result as Record<string, unknown>;
        items.push({
          id: String(r.id || Math.random()),
          type: 'rag_result',
          title: String(r.title || r.source || 'Search Result'),
          description: String(r.content || r.text || '').slice(0, 200),
          relevanceScore: typeof r.score === 'number' ? r.score : undefined,
          metadata: r,
        });
      }
    }
  }

  // Document references
  if (data.documents && Array.isArray(data.documents)) {
    for (const doc of data.documents) {
      if (typeof doc === 'object' && doc !== null) {
        const d = doc as Record<string, unknown>;
        items.push({
          id: String(d.id || Math.random()),
          type: 'document',
          title: String(d.filename || d.name || 'Document'),
          description: String(d.summary || ''),
          url: d.url as string | undefined,
          dealId: d.deal_id as string | undefined,
        });
      }
    }
  }

  // Artifact references
  if (toolName === 'list_deal_artifacts' && Array.isArray(data.artifacts)) {
    for (const artifact of data.artifacts) {
      if (typeof artifact === 'object' && artifact !== null) {
        const a = artifact as Record<string, unknown>;
        items.push({
          id: String(a.path || Math.random()),
          type: 'artifact',
          title: String(a.name || a.filename || 'Artifact'),
          description: String(a.path || ''),
          dealId: data.deal_id as string | undefined,
        });
      }
    }
  }

  return items;
}

export default EvidenceLinks;
