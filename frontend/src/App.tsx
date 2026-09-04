import { useEffect, useMemo, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './lib/query-client';
import { AuthProvider } from './contexts/AuthContext';
import { PlatformAuthProvider } from './contexts/PlatformAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SucursalActivaProvider } from './contexts/SucursalActivaContext';
import { crearRouter } from './router';
import { resolverContextoTiendaSincrono, resolverSubdominioPorDominioPropio, SubdominioTiendaContext } from './lib/resolver-subdominio-tienda';

export function App() {
  // `undefined` = todavía resolviendo (solo pasa con un hostname que no es
  // localhost ni *.ciguadev.com — un candidato a dominio propio de tenant,
  // ver resolver-subdominio-tienda.ts). Los dos casos ya conocidos resuelven
  // sync en el primer render, sin loader ni parpadeo.
  const [subdominio, setSubdominio] = useState<string | null | undefined>(() => resolverContextoTiendaSincrono());

  useEffect(() => {
    if (subdominio !== undefined) return;
    let cancelado = false;
    resolverSubdominioPorDominioPropio().then((valor) => {
      if (!cancelado) setSubdominio(valor);
    });
    return () => {
      cancelado = true;
    };
  }, [subdominio]);

  const router = useMemo(() => (subdominio !== undefined ? crearRouter(subdominio) : null), [subdominio]);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SucursalActivaProvider>
            <PlatformAuthProvider>
              <SubdominioTiendaContext.Provider value={subdominio ?? null}>
                {router ? (
                  <RouterProvider router={router} />
                ) : (
                  <div className="flex h-screen items-center justify-center text-sm text-slate-400">Cargando…</div>
                )}
              </SubdominioTiendaContext.Provider>
            </PlatformAuthProvider>
          </SucursalActivaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
