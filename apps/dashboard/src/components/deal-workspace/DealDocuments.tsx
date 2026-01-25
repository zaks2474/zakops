/**
 * DealDocuments Component
 *
 * Document list for a deal with:
 * - File type icons
 * - Upload functionality
 * - Search/filter
 * - Preview on click
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  IconFile,
  IconFileText,
  IconFileSpreadsheet,
  IconPhoto,
  IconPdf,
  IconFileZip,
  IconSearch,
  IconUpload,
  IconDownload,
  IconEye,
  IconDots,
  IconTrash,
  IconFolder,
  IconSortAscending,
} from '@tabler/icons-react';
import { format, formatDistanceToNow } from 'date-fns';

// =============================================================================
// Types
// =============================================================================

export interface DealDocument {
  id: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string;
  category?: string;
}

interface DealDocumentsProps {
  documents: DealDocument[];
  onUpload?: (files: File[]) => void;
  onDownload?: (doc: DealDocument) => void;
  onPreview?: (doc: DealDocument) => void;
  onDelete?: (doc: DealDocument) => void;
  isLoading?: boolean;
  className?: string;
}

type SortBy = 'name' | 'date' | 'size' | 'type';

// =============================================================================
// File Type Config
// =============================================================================

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return IconPhoto;
  if (mimeType === 'application/pdf') return IconPdf;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return IconFileSpreadsheet;
  }
  if (mimeType.includes('zip') || mimeType.includes('archive')) return IconFileZip;
  if (mimeType.startsWith('text/') || mimeType.includes('document')) return IconFileText;
  return IconFile;
}

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'Images';
  if (mimeType === 'application/pdf') return 'PDFs';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return 'Spreadsheets';
  }
  if (mimeType.startsWith('text/') || mimeType.includes('document')) return 'Documents';
  return 'Other';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// =============================================================================
// Component
// =============================================================================

export function DealDocuments({
  documents,
  onUpload,
  onDownload,
  onPreview,
  onDelete,
  isLoading = false,
  className = '',
}: DealDocumentsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [groupByCategory, setGroupByCategory] = useState(false);

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let result = documents.filter((doc) =>
      doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.filename.localeCompare(b.filename);
        case 'date':
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        case 'size':
          return b.size - a.size;
        case 'type':
          return a.mimeType.localeCompare(b.mimeType);
        default:
          return 0;
      }
    });

    return result;
  }, [documents, searchQuery, sortBy]);

  // Group by category
  const groupedDocuments = useMemo(() => {
    if (!groupByCategory) return null;

    const groups: Record<string, DealDocument[]> = {};
    for (const doc of filteredDocuments) {
      const category = doc.category || getFileCategory(doc.mimeType);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(doc);
    }
    return groups;
  }, [filteredDocuments, groupByCategory]);

  // Handle file upload
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && onUpload) {
      onUpload(Array.from(files));
    }
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="animate-pulse text-muted-foreground">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="p-4 border-b flex items-center gap-3">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <IconSortAscending className="w-4 h-4 mr-1" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSortBy('date')}>
              By Date {sortBy === 'date' && '✓'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('name')}>
              By Name {sortBy === 'name' && '✓'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('size')}>
              By Size {sortBy === 'size' && '✓'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('type')}>
              By Type {sortBy === 'type' && '✓'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setGroupByCategory(!groupByCategory)}
          className={groupByCategory ? 'bg-accent' : ''}
        >
          <IconFolder className="w-4 h-4 mr-1" />
          Group
        </Button>

        {onUpload && (
          <label>
            <Button size="sm" asChild>
              <span>
                <IconUpload className="w-4 h-4 mr-1" />
                Upload
              </span>
            </Button>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        )}
      </div>

      {/* Document list */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <IconFile className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No documents match your search' : 'No documents yet'}
              </p>
              {onUpload && !searchQuery && (
                <label className="mt-4 inline-block">
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <IconUpload className="w-4 h-4 mr-1" />
                      Upload first document
                    </span>
                  </Button>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleUpload}
                  />
                </label>
              )}
            </div>
          ) : groupByCategory && groupedDocuments ? (
            <div className="space-y-6">
              {Object.entries(groupedDocuments).map(([category, docs]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <IconFolder className="w-4 h-4" />
                    {category}
                    <Badge variant="outline" className="text-xs">
                      {docs.length}
                    </Badge>
                  </h3>
                  <div className="space-y-2">
                    {docs.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        document={doc}
                        onDownload={onDownload}
                        onPreview={onPreview}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocuments.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onDownload={onDownload}
                  onPreview={onPreview}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// =============================================================================
// Document Row
// =============================================================================

interface DocumentRowProps {
  document: DealDocument;
  onDownload?: (doc: DealDocument) => void;
  onPreview?: (doc: DealDocument) => void;
  onDelete?: (doc: DealDocument) => void;
}

function DocumentRow({ document, onDownload, onPreview, onDelete }: DocumentRowProps) {
  const Icon = getFileIcon(document.mimeType);

  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardContent className="p-3 flex items-center gap-3">
        {/* File icon */}
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{document.filename}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatFileSize(document.size)}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(document.uploadedAt), { addSuffix: true })}</span>
            {document.uploadedBy && (
              <>
                <span>•</span>
                <span>{document.uploadedBy}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {onPreview && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onPreview(document)}
            >
              <IconEye className="w-4 h-4" />
            </Button>
          )}
          {onDownload && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onDownload(document)}
            >
              <IconDownload className="w-4 h-4" />
            </Button>
          )}
          {onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <IconDots className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(document)}
                >
                  <IconTrash className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default DealDocuments;
