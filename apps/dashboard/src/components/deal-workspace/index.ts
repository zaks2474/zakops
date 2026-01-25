/**
 * Deal Workspace Components Module
 *
 * Exports all deal workspace "Operating Room" components.
 */

// Main workspace
export { DealWorkspace, default as DealWorkspaceDefault } from './DealWorkspace';

// Header and navigation
export { DealHeader } from './DealHeader';
export { DealTabs, DealTabContent, type DealTabId } from './DealTabs';

// Content panels
export { DealTimeline } from './DealTimeline';
export { DealDocuments, type DealDocument } from './DealDocuments';
export { DealChat } from './DealChat';
export { DealAgentPanel } from './DealAgentPanel';
