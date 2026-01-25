/**
 * OperatorProfileStep Component
 *
 * Collects basic operator information for personalization.
 * This helps the agent understand context for communications and analysis.
 */

'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IconUser,
  IconBuilding,
  IconTarget,
  IconClock,
} from '@tabler/icons-react';

// =============================================================================
// Types
// =============================================================================

export interface OperatorProfile {
  name: string;
  company: string;
  role?: string;
  investmentFocus?: string;
  timezone: string;
}

interface OperatorProfileStepProps {
  profile: OperatorProfile;
  onUpdate: (profile: OperatorProfile) => void;
}

// =============================================================================
// Constants
// =============================================================================

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European Time' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time' },
];

const INVESTMENT_FOCUSES = [
  { value: 'saas', label: 'SaaS / Software' },
  { value: 'ecommerce', label: 'E-commerce / DTC' },
  { value: 'services', label: 'Services / Agencies' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'healthcare', label: 'Healthcare / Medical' },
  { value: 'fintech', label: 'Fintech / Financial Services' },
  { value: 'marketplace', label: 'Marketplaces' },
  { value: 'content', label: 'Content / Media' },
  { value: 'generalist', label: 'Generalist / Multi-sector' },
];

// =============================================================================
// Component
// =============================================================================

export function OperatorProfileStep({ profile, onUpdate }: OperatorProfileStepProps) {
  const updateField = <K extends keyof OperatorProfile>(field: K, value: OperatorProfile[K]) => {
    onUpdate({ ...profile, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          Help us personalize your experience. This information helps the agent draft
          communications and understand your investment preferences.
        </p>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <IconUser className="w-4 h-4 text-muted-foreground" />
          About You
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              placeholder="John Smith"
              value={profile.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Your Role (optional)</Label>
            <Input
              id="role"
              placeholder="Managing Partner"
              value={profile.role || ''}
              onChange={(e) => updateField('role', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <IconBuilding className="w-4 h-4 text-muted-foreground" />
          Your Organization
        </h3>

        <div className="space-y-2">
          <Label htmlFor="company">Company / Fund Name</Label>
          <Input
            id="company"
            placeholder="Acme Capital Partners"
            value={profile.company}
            onChange={(e) => updateField('company', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used in agent-drafted communications
          </p>
        </div>
      </div>

      {/* Investment Focus */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <IconTarget className="w-4 h-4 text-muted-foreground" />
          Investment Focus
        </h3>

        <div className="space-y-2">
          <Label htmlFor="focus">Primary Sector (optional)</Label>
          <Select
            value={profile.investmentFocus || ''}
            onValueChange={(value) => updateField('investmentFocus', value)}
          >
            <SelectTrigger id="focus">
              <SelectValue placeholder="Select your primary focus" />
            </SelectTrigger>
            <SelectContent>
              {INVESTMENT_FOCUSES.map((focus) => (
                <SelectItem key={focus.value} value={focus.value}>
                  {focus.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Helps the agent understand deal relevance
          </p>
        </div>
      </div>

      {/* Timezone */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <IconClock className="w-4 h-4 text-muted-foreground" />
          Timezone
        </h3>

        <div className="space-y-2">
          <Label htmlFor="timezone">Your Timezone</Label>
          <Select
            value={profile.timezone}
            onValueChange={(value) => updateField('timezone', value)}
          >
            <SelectTrigger id="timezone">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            For scheduling digests and quiet hours
          </p>
        </div>
      </div>
    </div>
  );
}

export default OperatorProfileStep;
