'use client';

import { useRouter } from 'next/navigation';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export default function OnboardingPage() {
  const router = useRouter();

  const handleComplete = (state: Parameters<typeof OnboardingWizard>[0] extends { onComplete: (s: infer S) => void } ? S : never) => {
    // In production, save to backend
    console.log('Onboarding complete:', state);
    localStorage.setItem('zakops-onboarding-complete', 'true');
    router.push('/dashboard');
  };

  const handleSkip = () => {
    localStorage.setItem('zakops-onboarding-skipped', 'true');
    router.push('/dashboard');
  };

  return (
    <div className='flex flex-1 flex-col min-h-0 overflow-y-auto p-4 md:p-6'>
      {/* Header */}
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight'>Welcome to ZakOps</h1>
        <p className='text-muted-foreground'>Complete the setup to get started with your deal workflow</p>
      </div>

      {/* Wizard container - consistent with other pages */}
      <div className='flex-1 max-w-4xl'>
        <OnboardingWizard
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      </div>
    </div>
  );
}
