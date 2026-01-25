/**
 * Diligence Components Module
 *
 * Exports all due diligence checklist components.
 */

// Main component
export {
  DiligenceChecklist,
  DiligenceChecklistCompact,
  default as DiligenceChecklistDefault,
} from './DiligenceChecklist';

// Sub-components
export {
  DiligenceCategory,
  type DiligenceCategoryData,
} from './DiligenceCategory';

export {
  DiligenceItem,
  type DiligenceItemData,
  type DiligenceItemStatus,
} from './DiligenceItem';

export {
  DiligenceProgress,
  ProgressRing,
} from './DiligenceProgress';

// Hooks
export {
  useDiligence,
  DILIGENCE_TEMPLATES,
} from './useDiligence';
