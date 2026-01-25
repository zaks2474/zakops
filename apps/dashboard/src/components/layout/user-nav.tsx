'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  IconUser,
  IconBuilding,
  IconTarget,
  IconClock,
  IconSettings,
  IconRefresh,
  IconLogout,
} from '@tabler/icons-react';

// =============================================================================
// Types
// =============================================================================

interface OperatorProfile {
  name: string;
  company: string;
  role?: string;
  investmentFocus?: string;
  timezone: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getInitials(name: string): string {
  if (!name) return 'OP';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatInvestmentFocus(focus?: string): string {
  if (!focus) return '';
  const focusLabels: Record<string, string> = {
    saas: 'SaaS / Software',
    ecommerce: 'E-commerce / DTC',
    services: 'Services / Agencies',
    manufacturing: 'Manufacturing',
    healthcare: 'Healthcare / Medical',
    fintech: 'Fintech / Financial Services',
    marketplace: 'Marketplaces',
    content: 'Content / Media',
    generalist: 'Generalist / Multi-sector',
  };
  return focusLabels[focus] || focus;
}

function formatTimezone(tz?: string): string {
  if (!tz) return '';
  const tzLabels: Record<string, string> = {
    'America/New_York': 'Eastern Time',
    'America/Chicago': 'Central Time',
    'America/Denver': 'Mountain Time',
    'America/Los_Angeles': 'Pacific Time',
    'America/Phoenix': 'Arizona',
    'America/Anchorage': 'Alaska Time',
    'Pacific/Honolulu': 'Hawaii Time',
    'Europe/London': 'London (GMT/BST)',
    'Europe/Paris': 'Central European',
    'Asia/Tokyo': 'Japan Standard',
    'Australia/Sydney': 'Australian Eastern',
  };
  return tzLabels[tz] || tz;
}

// =============================================================================
// Component
// =============================================================================

export function UserNav() {
  const router = useRouter();
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load profile from localStorage (from onboarding)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('zakops-onboarding-progress');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.state?.profile) {
          setProfile(parsed.state.profile);
        }
      }
    } catch (error) {
      console.warn('Failed to load operator profile:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const handleEditProfile = () => {
    router.push('/onboarding');
  };

  const handleRerunOnboarding = () => {
    // Clear onboarding completion flags to restart
    localStorage.removeItem('zakops-onboarding-complete');
    localStorage.removeItem('zakops-onboarding-skipped');
    router.push('/onboarding');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
          <Avatar className='h-8 w-8'>
            <AvatarFallback className='bg-primary/10 text-primary text-xs font-medium'>
              {profile?.name ? getInitials(profile.name) : <IconUser className='h-4 w-4' />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className='w-72'
        align='end'
        sideOffset={10}
        forceMount
      >
        {!isLoaded ? (
          <div className='p-4'>
            <div className='h-4 w-32 bg-muted animate-pulse rounded mb-2' />
            <div className='h-3 w-24 bg-muted animate-pulse rounded' />
          </div>
        ) : profile ? (
          <>
            {/* Profile Header */}
            <div className='p-4'>
              <div className='flex items-center gap-3'>
                <div className='w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-medium'>
                  {getInitials(profile.name)}
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='font-medium truncate'>{profile.name}</p>
                  {profile.role && (
                    <p className='text-sm text-muted-foreground truncate'>{profile.role}</p>
                  )}
                </div>
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Profile Details */}
            <div className='px-4 py-3 space-y-2'>
              {profile.company && (
                <div className='flex items-center gap-2 text-sm'>
                  <IconBuilding className='h-4 w-4 text-muted-foreground shrink-0' />
                  <span className='text-muted-foreground truncate'>{profile.company}</span>
                </div>
              )}

              {profile.investmentFocus && (
                <div className='flex items-center gap-2 text-sm'>
                  <IconTarget className='h-4 w-4 text-muted-foreground shrink-0' />
                  <span className='text-muted-foreground truncate'>
                    {formatInvestmentFocus(profile.investmentFocus)}
                  </span>
                </div>
              )}

              {profile.timezone && (
                <div className='flex items-center gap-2 text-sm'>
                  <IconClock className='h-4 w-4 text-muted-foreground shrink-0' />
                  <span className='text-muted-foreground truncate'>
                    {formatTimezone(profile.timezone)}
                  </span>
                </div>
              )}
            </div>

            <DropdownMenuSeparator />

            {/* Actions */}
            <DropdownMenuItem onClick={handleEditProfile}>
              <IconSettings className='h-4 w-4 mr-2' />
              Edit Profile
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleRerunOnboarding}>
              <IconRefresh className='h-4 w-4 mr-2' />
              Re-run Onboarding
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem className='text-destructive focus:text-destructive'>
              <IconLogout className='h-4 w-4 mr-2' />
              Sign Out
            </DropdownMenuItem>
          </>
        ) : (
          /* No profile - prompt to complete onboarding */
          <div className='p-4 text-center'>
            <div className='w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3'>
              <IconUser className='h-6 w-6 text-muted-foreground' />
            </div>
            <p className='text-sm text-muted-foreground mb-3'>
              Complete your profile to personalize your experience
            </p>
            <Button
              size='sm'
              onClick={() => router.push('/onboarding')}
              className='w-full'
            >
              Complete Setup
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
