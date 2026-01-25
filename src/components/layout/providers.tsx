'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActiveThemeProvider } from '../active-theme';
import { AgentDrawerProvider } from '@/components/agent/AgentDrawer';

// Create a client outside the component to avoid recreating on re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes - reduce unnecessary refetches
      gcTime: 10 * 60 * 1000,      // 10 minutes garbage collection
      refetchOnWindowFocus: false, // Don't refetch on tab focus
      refetchOnMount: false,       // Don't refetch on mount if data exists
      refetchOnReconnect: false,   // Don't refetch on reconnect
      retry: 1,                    // Only retry once on failure
    },
  },
});

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        <AgentDrawerProvider>
          {children}
        </AgentDrawerProvider>
      </ActiveThemeProvider>
    </QueryClientProvider>
  );
}
