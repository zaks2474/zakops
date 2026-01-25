/**
 * OnboardingWizard Component
 *
 * Progressive disclosure wizard for new users.
 * Steps:
 * 1. Welcome
 * 2. Connect email
 * 3. Configure agent
 * 4. Set preferences
 * 5. Complete
 *
 * Features:
 * - Resumable: Progress is saved to localStorage
 * - Shows resume banner when returning mid-setup
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconSparkles,
  IconMail,
  IconRobot,
  IconSettings,
  IconConfetti,
  IconRefresh,
  IconX,
  IconUser,
} from '@tabler/icons-react';
import { WelcomeStep } from './steps/WelcomeStep';
import { EmailSetupStep } from './steps/EmailSetupStep';
import { AgentDemoStep } from './steps/AgentDemoStep';
import { PreferencesStep } from './steps/PreferencesStep';
import { OperatorProfileStep, type OperatorProfile } from './steps/OperatorProfileStep';
import { CompleteStep } from './steps/CompleteStep';
import { useOnboardingState } from '@/hooks/useOnboardingState';

// =============================================================================
// Types
// =============================================================================

export interface OnboardingState {
  emailConnected: boolean;
  emailAddress?: string;
  agentEnabled: boolean;
  autoApproveLevel: 'none' | 'low' | 'medium';
  notifications: {
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
  };
  // Operator profile
  profile?: OperatorProfile;
}

interface OnboardingWizardProps {
  onComplete: (state: OnboardingState) => void;
  onSkip?: () => void;
  initialState?: Partial<OnboardingState>;
  className?: string;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: typeof IconSparkles;
}

// =============================================================================
// Steps Configuration
// =============================================================================

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Get started with ZakOps',
    icon: IconSparkles,
  },
  {
    id: 'profile',
    title: 'Your Profile',
    description: 'Tell us about yourself',
    icon: IconUser,
  },
  {
    id: 'email',
    title: 'Connect Email',
    description: 'Link your deal inbox',
    icon: IconMail,
  },
  {
    id: 'agent',
    title: 'Meet Your Agent',
    description: 'See AI assistance in action',
    icon: IconRobot,
  },
  {
    id: 'preferences',
    title: 'Preferences',
    description: 'Customize your experience',
    icon: IconSettings,
  },
  {
    id: 'complete',
    title: 'All Set!',
    description: 'You\'re ready to go',
    icon: IconConfetti,
  },
];

// =============================================================================
// Component
// =============================================================================

export function OnboardingWizard({
  onComplete,
  onSkip,
  initialState,
  className = '',
}: OnboardingWizardProps) {
  // Use persistent state hook
  const {
    currentStep,
    state,
    isLoaded,
    setCurrentStep,
    updateState: updatePersistedState,
    markComplete,
  } = useOnboardingState();

  // Track if user is resuming (came back mid-setup)
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [hasShownBanner, setHasShownBanner] = useState(false);

  // Show resume banner if returning mid-setup
  useEffect(() => {
    if (isLoaded && currentStep > 0 && !hasShownBanner) {
      setShowResumeBanner(true);
      setHasShownBanner(true);
    }
  }, [isLoaded, currentStep, hasShownBanner]);

  // Apply initial state on mount (merge with persisted)
  useEffect(() => {
    if (isLoaded && initialState) {
      updatePersistedState(initialState);
    }
  }, [isLoaded]); // Only run once when loaded

  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  // Update state (wrapper for persisted state)
  const updateState = useCallback((updates: Partial<OnboardingState>) => {
    updatePersistedState(updates);
  }, [updatePersistedState]);

  // Navigation
  const goNext = useCallback(() => {
    if (isLastStep) {
      markComplete();
      onComplete(state);
    } else {
      setCurrentStep(currentStep + 1);
    }
  }, [isLastStep, state, onComplete, markComplete, currentStep, setCurrentStep]);

  const goBack = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  }, [isFirstStep, currentStep, setCurrentStep]);

  const goToStep = useCallback((index: number) => {
    if (index <= currentStep) {
      setCurrentStep(index);
    }
  }, [currentStep, setCurrentStep]);

  // Start fresh (dismiss resume banner and go to step 0)
  const startFresh = useCallback(() => {
    setCurrentStep(0);
    setShowResumeBanner(false);
  }, [setCurrentStep]);

  const dismissBanner = useCallback(() => {
    setShowResumeBanner(false);
  }, []);

  // Show loading state while hydrating
  if (!isLoaded) {
    return (
      <div className={`w-full ${className}`}>
        <Card>
          <CardContent className="py-12 text-center">
            <IconSparkles className="w-8 h-8 mx-auto mb-3 text-primary animate-pulse" />
            <p className="text-muted-foreground">Loading your progress...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default profile for new users
  const defaultProfile: OperatorProfile = {
    name: '',
    company: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  };

  // Render current step content
  const renderStepContent = () => {
    switch (step.id) {
      case 'welcome':
        return <WelcomeStep />;
      case 'profile':
        return (
          <OperatorProfileStep
            profile={state.profile ?? defaultProfile}
            onUpdate={(profile) => updateState({ profile })}
          />
        );
      case 'email':
        return (
          <EmailSetupStep
            isConnected={state.emailConnected}
            emailAddress={state.emailAddress}
            onConnect={(email) => updateState({ emailConnected: true, emailAddress: email })}
            onSkip={() => updateState({ emailConnected: false })}
          />
        );
      case 'agent':
        return (
          <AgentDemoStep
            onDemoComplete={() => {
              // Mark agent as enabled when demo completes
              updateState({ agentEnabled: true });
            }}
          />
        );
      case 'preferences':
        return (
          <PreferencesStep
            notifications={state.notifications}
            onUpdate={(notifications) => updateState({ notifications })}
          />
        );
      case 'complete':
        return <CompleteStep state={state} />;
      default:
        return null;
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, idx) => {
            const StepIcon = s.icon;
            const isComplete = idx < currentStep;
            const isCurrent = idx === currentStep;

            return (
              <button
                key={s.id}
                onClick={() => goToStep(idx)}
                disabled={idx > currentStep}
                className={`flex items-center gap-2 ${
                  idx > currentStep ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isComplete ? (
                    <IconCheck className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-sm hidden sm:inline ${
                    isCurrent ? 'font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      {/* Resume banner - shown when returning mid-setup */}
      {showResumeBanner && (
        <Alert className="mb-4 border-primary/50 bg-primary/5">
          <div className="flex items-center justify-between">
            <AlertDescription className="flex items-center gap-2">
              <IconRefresh className="w-4 h-4 text-primary" />
              <span>
                Welcome back! You're on step {currentStep + 1} of {STEPS.length}: <strong>{step.title}</strong>
              </span>
            </AlertDescription>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={startFresh}>
                Start Fresh
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={dismissBanner}>
                <IconX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {/* Step card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <step.icon className="w-5 h-5 text-primary" />
            {step.title}
          </CardTitle>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>

        <CardContent>{renderStepContent()}</CardContent>

        <CardFooter className="flex justify-between">
          <div>
            {!isFirstStep && (
              <Button variant="ghost" onClick={goBack}>
                <IconArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {onSkip && !isLastStep && (
              <Button variant="ghost" onClick={onSkip}>
                Skip Setup
              </Button>
            )}
            <Button onClick={goNext}>
              {isLastStep ? (
                <>
                  Get Started
                  <IconConfetti className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  Continue
                  <IconArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default OnboardingWizard;
