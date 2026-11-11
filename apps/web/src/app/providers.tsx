import * as React from 'react';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider, toast } from '@reka/ui';
import { ThemeProvider } from '../components/theme/theme-provider';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Avoid duplicate toasts if the mutation already defines its own onError handler
      // ...or shows its error inline (meta.inlineError), where a toast would only cover the form.
      if (mutation.options.onError || mutation.meta?.inlineError) return;
      toast.error('Action failed', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    },
  }),
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="reka-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          {children}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
