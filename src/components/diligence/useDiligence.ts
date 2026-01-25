/**
 * useDiligence Hook
 *
 * Manages diligence checklist state and operations.
 * Provides data fetching, mutations, and template management.
 */

'use client';

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DiligenceItemData, DiligenceItemStatus } from './DiligenceItem';
import type { DiligenceCategoryData } from './DiligenceCategory';

// =============================================================================
// Types
// =============================================================================

interface DiligenceTemplate {
  id: string;
  name: string;
  description?: string;
  categories: Omit<DiligenceCategoryData, 'items'>[];
  items: Omit<DiligenceItemData, 'createdAt' | 'updatedAt'>[];
}

interface DiligenceData {
  dealId: string;
  targetDate?: string;
  categories: DiligenceCategoryData[];
}

interface UseDiligenceOptions {
  dealId: string;
  enabled?: boolean;
}

// =============================================================================
// Default Templates
// =============================================================================

const STANDARD_DD_TEMPLATE: DiligenceTemplate = {
  id: 'standard',
  name: 'Standard Due Diligence',
  description: 'Comprehensive checklist for typical acquisitions',
  categories: [
    { id: 'financial', name: 'Financial', order: 1 },
    { id: 'legal', name: 'Legal & Compliance', order: 2 },
    { id: 'operational', name: 'Operational', order: 3 },
    { id: 'hr', name: 'Human Resources', order: 4 },
    { id: 'technology', name: 'Technology & IP', order: 5 },
  ],
  items: [
    // Financial
    { id: 'fin-1', category: 'financial', title: 'Review last 3 years of financial statements', priority: 'high', status: 'pending' },
    { id: 'fin-2', category: 'financial', title: 'Analyze revenue breakdown by customer/product', priority: 'high', status: 'pending' },
    { id: 'fin-3', category: 'financial', title: 'Verify accounts receivable aging', priority: 'medium', status: 'pending' },
    { id: 'fin-4', category: 'financial', title: 'Review accounts payable and outstanding liabilities', priority: 'medium', status: 'pending' },
    { id: 'fin-5', category: 'financial', title: 'Analyze working capital requirements', priority: 'medium', status: 'pending' },
    { id: 'fin-6', category: 'financial', title: 'Review tax returns (3 years)', priority: 'high', status: 'pending' },
    { id: 'fin-7', category: 'financial', title: 'Verify bank statements and reconciliations', priority: 'medium', status: 'pending' },
    { id: 'fin-8', category: 'financial', title: 'Review debt agreements and covenants', priority: 'high', status: 'pending' },

    // Legal
    { id: 'leg-1', category: 'legal', title: 'Review corporate formation documents', priority: 'high', status: 'pending' },
    { id: 'leg-2', category: 'legal', title: 'Verify business licenses and permits', priority: 'high', status: 'pending' },
    { id: 'leg-3', category: 'legal', title: 'Review material contracts', priority: 'high', status: 'pending' },
    { id: 'leg-4', category: 'legal', title: 'Check for pending or threatened litigation', priority: 'high', status: 'pending' },
    { id: 'leg-5', category: 'legal', title: 'Review insurance policies and claims history', priority: 'medium', status: 'pending' },
    { id: 'leg-6', category: 'legal', title: 'Verify compliance with regulations', priority: 'medium', status: 'pending' },

    // Operational
    { id: 'ops-1', category: 'operational', title: 'Review operational processes and workflows', priority: 'medium', status: 'pending' },
    { id: 'ops-2', category: 'operational', title: 'Analyze customer concentration', priority: 'high', status: 'pending' },
    { id: 'ops-3', category: 'operational', title: 'Review supplier relationships', priority: 'medium', status: 'pending' },
    { id: 'ops-4', category: 'operational', title: 'Assess equipment and facility condition', priority: 'medium', status: 'pending' },
    { id: 'ops-5', category: 'operational', title: 'Review inventory management practices', priority: 'low', status: 'pending' },

    // HR
    { id: 'hr-1', category: 'hr', title: 'Review org chart and key personnel', priority: 'high', status: 'pending' },
    { id: 'hr-2', category: 'hr', title: 'Analyze compensation and benefits structure', priority: 'medium', status: 'pending' },
    { id: 'hr-3', category: 'hr', title: 'Review employment agreements', priority: 'medium', status: 'pending' },
    { id: 'hr-4', category: 'hr', title: 'Check for pending HR issues or complaints', priority: 'medium', status: 'pending' },
    { id: 'hr-5', category: 'hr', title: 'Verify compliance with labor laws', priority: 'medium', status: 'pending' },

    // Technology
    { id: 'tech-1', category: 'technology', title: 'Inventory of software and systems', priority: 'medium', status: 'pending' },
    { id: 'tech-2', category: 'technology', title: 'Review IP ownership and registrations', priority: 'high', status: 'pending' },
    { id: 'tech-3', category: 'technology', title: 'Assess cybersecurity posture', priority: 'medium', status: 'pending' },
    { id: 'tech-4', category: 'technology', title: 'Review technology contracts and licenses', priority: 'medium', status: 'pending' },
  ],
};

const QUICK_DD_TEMPLATE: DiligenceTemplate = {
  id: 'quick',
  name: 'Quick Due Diligence',
  description: 'Streamlined checklist for smaller acquisitions',
  categories: [
    { id: 'financial', name: 'Financial', order: 1 },
    { id: 'legal', name: 'Legal', order: 2 },
    { id: 'operational', name: 'Operational', order: 3 },
  ],
  items: [
    { id: 'qfin-1', category: 'financial', title: 'Review P&L and balance sheet (2 years)', priority: 'high', status: 'pending' },
    { id: 'qfin-2', category: 'financial', title: 'Verify tax compliance', priority: 'high', status: 'pending' },
    { id: 'qfin-3', category: 'financial', title: 'Review bank statements (12 months)', priority: 'medium', status: 'pending' },
    { id: 'qleg-1', category: 'legal', title: 'Verify business registration and licenses', priority: 'high', status: 'pending' },
    { id: 'qleg-2', category: 'legal', title: 'Review major contracts', priority: 'high', status: 'pending' },
    { id: 'qleg-3', category: 'legal', title: 'Check for litigation', priority: 'medium', status: 'pending' },
    { id: 'qops-1', category: 'operational', title: 'Meet with key personnel', priority: 'high', status: 'pending' },
    { id: 'qops-2', category: 'operational', title: 'Review customer list', priority: 'medium', status: 'pending' },
    { id: 'qops-3', category: 'operational', title: 'Site visit', priority: 'medium', status: 'pending' },
  ],
};

export const DILIGENCE_TEMPLATES = [STANDARD_DD_TEMPLATE, QUICK_DD_TEMPLATE];

// =============================================================================
// Mock API Functions (replace with real API calls)
// =============================================================================

async function fetchDiligenceData(dealId: string): Promise<DiligenceData> {
  // TODO: Replace with actual API call
  // For now, return empty data
  return {
    dealId,
    categories: [],
  };
}

async function updateItemStatus(
  dealId: string,
  itemId: string,
  status: DiligenceItemStatus
): Promise<void> {
  // TODO: Replace with actual API call
  await new Promise((resolve) => setTimeout(resolve, 300));
}

async function updateItemNotes(
  dealId: string,
  itemId: string,
  notes: string
): Promise<void> {
  // TODO: Replace with actual API call
  await new Promise((resolve) => setTimeout(resolve, 300));
}

async function applyTemplate(
  dealId: string,
  templateId: string
): Promise<DiligenceData> {
  // TODO: Replace with actual API call
  const template = DILIGENCE_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error('Template not found');

  const now = new Date();
  const categories: DiligenceCategoryData[] = template.categories.map((cat) => ({
    ...cat,
    items: template.items
      .filter((item) => item.category === cat.id)
      .map((item) => ({
        ...item,
        createdAt: now,
        updatedAt: now,
      })),
  }));

  return {
    dealId,
    categories,
  };
}

// =============================================================================
// Hook
// =============================================================================

export function useDiligence({ dealId, enabled = true }: UseDiligenceOptions) {
  const queryClient = useQueryClient();

  // Fetch diligence data
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['diligence', dealId],
    queryFn: () => fetchDiligenceData(dealId),
    enabled,
  });

  // Update item status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: DiligenceItemStatus }) =>
      updateItemStatus(dealId, itemId, status),
    onMutate: async ({ itemId, status }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['diligence', dealId] });
      const previous = queryClient.getQueryData<DiligenceData>(['diligence', dealId]);

      if (previous) {
        const updated: DiligenceData = {
          ...previous,
          categories: previous.categories.map((cat) => ({
            ...cat,
            items: cat.items.map((item) =>
              item.id === itemId
                ? { ...item, status, updatedAt: new Date() }
                : item
            ),
          })),
        };
        queryClient.setQueryData(['diligence', dealId], updated);
      }

      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['diligence', dealId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['diligence', dealId] });
    },
  });

  // Update item notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: ({ itemId, notes }: { itemId: string; notes: string }) =>
      updateItemNotes(dealId, itemId, notes),
    onMutate: async ({ itemId, notes }) => {
      await queryClient.cancelQueries({ queryKey: ['diligence', dealId] });
      const previous = queryClient.getQueryData<DiligenceData>(['diligence', dealId]);

      if (previous) {
        const updated: DiligenceData = {
          ...previous,
          categories: previous.categories.map((cat) => ({
            ...cat,
            items: cat.items.map((item) =>
              item.id === itemId
                ? { ...item, notes, updatedAt: new Date() }
                : item
            ),
          })),
        };
        queryClient.setQueryData(['diligence', dealId], updated);
      }

      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['diligence', dealId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['diligence', dealId] });
    },
  });

  // Apply template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: (templateId: string) => applyTemplate(dealId, templateId),
    onSuccess: (newData) => {
      queryClient.setQueryData(['diligence', dealId], newData);
    },
  });

  // Handlers
  const handleStatusChange = useCallback(
    async (itemId: string, status: DiligenceItemStatus) => {
      await updateStatusMutation.mutateAsync({ itemId, status });
    },
    [updateStatusMutation]
  );

  const handleNotesChange = useCallback(
    async (itemId: string, notes: string) => {
      await updateNotesMutation.mutateAsync({ itemId, notes });
    },
    [updateNotesMutation]
  );

  const handleApplyTemplate = useCallback(
    async (templateId: string) => {
      await applyTemplateMutation.mutateAsync(templateId);
    },
    [applyTemplateMutation]
  );

  // Flatten all items
  const allItems = useMemo(() => {
    return data?.categories.flatMap((c) => c.items) || [];
  }, [data]);

  return {
    categories: data?.categories || [],
    targetDate: data?.targetDate ? new Date(data.targetDate) : undefined,
    allItems,
    isLoading,
    error,
    refetch,
    onItemStatusChange: handleStatusChange,
    onItemNotesChange: handleNotesChange,
    onApplyTemplate: handleApplyTemplate,
    isUpdatingStatus: updateStatusMutation.isPending,
    isUpdatingNotes: updateNotesMutation.isPending,
    isApplyingTemplate: applyTemplateMutation.isPending,
  };
}

export default useDiligence;
