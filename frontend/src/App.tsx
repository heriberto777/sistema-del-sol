import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './lib/query-client';
import { AuthProvider } from './contexts/AuthContext';
import { PlatformAuthProvider } from './contexts/PlatformAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SucursalActivaProvider } from './contexts/SucursalActivaContext';
import { router } from './router';

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SucursalActivaProvider>
            <PlatformAuthProvider>
              <RouterProvider router={router} />
            </PlatformAuthProvider>
          </SucursalActivaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
