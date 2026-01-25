'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function HQError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('HQ page error:', error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <IconAlertTriangle className="h-5 w-5" />
            Failed to load Operator HQ
          </CardTitle>
          <CardDescription>
            An error occurred while loading the Operator HQ page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="rounded-md bg-muted p-4 text-sm overflow-auto max-h-32">
            {error.message || 'Unknown error'}
          </pre>
          <Button onClick={reset} variant="outline" className="w-full">
            <IconRefresh className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
