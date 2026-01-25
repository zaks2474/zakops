/**
 * Onboarding Components Module
 *
 * Exports all onboarding-related components.
 */

// Main wizard
export { OnboardingWizard, type OnboardingState } from './OnboardingWizard';

// Individual steps
export { WelcomeStep } from './steps/WelcomeStep';
export { EmailSetupStep } from './steps/EmailSetupStep';
export { AgentConfigStep } from './steps/AgentConfigStep';
export { PreferencesStep } from './steps/PreferencesStep';
export { CompleteStep } from './steps/CompleteStep';
