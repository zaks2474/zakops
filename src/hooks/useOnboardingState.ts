/**
 * useOnboardingState Hook
 *
 * Persists onboarding progress to localStorage so users can resume
 * where they left off if they navigate away or close the browser.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface OnboardingNotifications {
  email: boolean;
  browser: boolean;
  digest: 'daily' | 'weekly' | 'none';
  // Expanded preferences
  approvalAlerts?: 'all' | 'critical' | 'none';
  dealStageChanges?: boolean;
  agentActivity?: boolean;
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface OperatorProfile {
  name: string;
  company: string;
  role?: string;
  investmentFocus?: string;
  timezone: string;
}

export interface OnboardingState {
  emailConnected: boolean;
  emailAddress?: string;
  agentEnabled: boolean;
  autoApproveLevel: 'none' | 'low' | 'medium';
  notifications: OnboardingNotifications;
  profile?: OperatorProfile;
}

interface PersistedOnboarding {
  currentStep: number;
  state: OnboardingState;
  lastUpdated: string;
  version: number;
}

interface UseOnboardingStateReturn {
  currentStep: number;
  state: OnboardingState;
  isLoaded: boolean;
  setCurrentStep: (step: number) => void;
  updateState: (updates: Partial<OnboardingState>) => void;
  reset: () => void;
  markComplete: () => void;
  isComplete: boolean;
  isSkipped: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'zakops-onboarding-progress';
const COMPLETE_KEY = 'zakops-onboarding-complete';
const SKIPPED_KEY = 'zakops-onboarding-skipped';
const CURRENT_VERSION = 1;

const DEFAULT_STATE: OnboardingState = {
  emailConnected: false,
  agentEnabled: true,
  autoApproveLevel: 'low',
  notifications: {
    email: true,
    browser: true,
    digest: 'daily',
    // Expanded preferences defaults
    approvalAlerts: 'all',
    dealStageChanges: true,
    agentActivity: true,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  },
};

// =============================================================================
// Hook
// =============================================================================

export function useOnboardingState(initialStep = 0): UseOnboardingStateReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentStep, setCurrentStepInternal] = useState(initialStep);
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [isComplete, setIsComplete] = useState(false);
  const [isSkipped, setIsSkipped] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    try {
      // Check completion status
      const complete = localStorage.getItem(COMPLETE_KEY) === 'true';
      const skipped = localStorage.getItem(SKIPPED_KEY) === 'true';
      setIsComplete(complete);
      setIsSkipped(skipped);

      // Load progress if not complete
      if (!complete && !skipped) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: PersistedOnboarding = JSON.parse(stored);

          // Version check for future migrations
          if (parsed.version === CURRENT_VERSION) {
            setCurrentStepInternal(parsed.currentStep);
            setState(parsed.state);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load onboarding state:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Persist state changes
  const persist = useCallback((step: number, newState: OnboardingState) => {
    try {
      const data: PersistedOnboarding = {
        currentStep: step,
        state: newState,
        lastUpdated: new Date().toISOString(),
        version: CURRENT_VERSION,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist onboarding state:', error);
    }
  }, []);

  // Update current step
  const setCurrentStep = useCallback((step: number) => {
    setCurrentStepInternal(step);
    persist(step, state);
  }, [state, persist]);

  // Update state
  const updateState = useCallback((updates: Partial<OnboardingState>) => {
    setState((prev) => {
      const newState = { ...prev, ...updates };
      persist(currentStep, newState);
      return newState;
    });
  }, [currentStep, persist]);

  // Reset onboarding
  const reset = useCallback(() => {
    setCurrentStepInternal(0);
    setState(DEFAULT_STATE);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(COMPLETE_KEY);
    localStorage.removeItem(SKIPPED_KEY);
    setIsComplete(false);
    setIsSkipped(false);
  }, []);

  // Mark as complete
  const markComplete = useCallback(() => {
    localStorage.setItem(COMPLETE_KEY, 'true');
    localStorage.removeItem(STORAGE_KEY);
    setIsComplete(true);
  }, []);

  return {
    currentStep,
    state,
    isLoaded,
    setCurrentStep,
    updateState,
    reset,
    markComplete,
    isComplete,
    isSkipped,
  };
}

export default useOnboardingState;
