/**
 * EmailSetupStep Component
 *
 * Connect email inbox for deal triage.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  IconMail,
  IconCheck,
  IconLoader2,
  IconBrandGmail,
  IconBrandOffice,
  IconAlertCircle,
} from '@tabler/icons-react';

// =============================================================================
// Types
// =============================================================================

interface EmailSetupStepProps {
  isConnected: boolean;
  emailAddress?: string;
  onConnect: (email: string) => void;
  onSkip: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function EmailSetupStep({
  isConnected,
  emailAddress,
  onConnect,
  onSkip,
}: EmailSetupStepProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'outlook' | null>(null);

  const handleConnect = async (provider: 'gmail' | 'outlook') => {
    setSelectedProvider(provider);
    setIsConnecting(true);

    // Simulate OAuth flow
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockEmail = provider === 'gmail' ? 'deals@example.com' : 'deals@company.com';
    onConnect(mockEmail);
    setIsConnecting(false);
  };

  if (isConnected) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconCheck className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-medium">Email Connected!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {emailAddress}
          </p>
        </div>

        <Alert>
          <IconMail className="h-4 w-4" />
          <AlertTitle>What happens next</AlertTitle>
          <AlertDescription>
            We'll start monitoring this inbox for deal-related emails. The agent will
            triage incoming messages and add potential deals to your quarantine queue
            for review.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Connect your deal inbox to enable automatic email triage and deal detection.
        </p>
      </div>

      {/* Provider selection */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          variant="outline"
          className="h-24 flex-col gap-2"
          onClick={() => handleConnect('gmail')}
          disabled={isConnecting}
        >
          {isConnecting && selectedProvider === 'gmail' ? (
            <IconLoader2 className="w-8 h-8 animate-spin" />
          ) : (
            <IconBrandGmail className="w-8 h-8 text-red-500" />
          )}
          <span>Google Workspace</span>
        </Button>

        <Button
          variant="outline"
          className="h-24 flex-col gap-2"
          onClick={() => handleConnect('outlook')}
          disabled={isConnecting}
        >
          {isConnecting && selectedProvider === 'outlook' ? (
            <IconLoader2 className="w-8 h-8 animate-spin" />
          ) : (
            <IconBrandOffice className="w-8 h-8 text-blue-500" />
          )}
          <span>Microsoft 365</span>
        </Button>
      </div>

      {/* Skip option */}
      <div className="text-center">
        <Button variant="link" onClick={onSkip} className="text-muted-foreground">
          Skip for now - I'll set this up later
        </Button>
      </div>

      {/* Permissions info */}
      <Alert variant="default" className="bg-muted/50">
        <IconAlertCircle className="h-4 w-4" />
        <AlertTitle>Permissions required</AlertTitle>
        <AlertDescription className="text-xs">
          We'll request read-only access to your inbox. We never send emails on your
          behalf without explicit approval.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default EmailSetupStep;
