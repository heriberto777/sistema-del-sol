import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './lib/query-client';
import { AuthProvider } from './contexts/AuthContext';
import { PlatformAuthProvider } from './contexts/PlatformAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { router } from './router';

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PlatformAuthProvider>
            <RouterProvider router={router} />
          </PlatformAuthProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
