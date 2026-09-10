import { Heart } from 'lucide-react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useFavoritosPropiedades } from './useFavoritosPropiedades';

interface ConfigPublica {
  nombre: string;
  logo: string | null;
}

export interface ContextoInmobiliariaPublica {
  subdominio: string;
  config: ConfigPublica;
}

/**
 * Envuelve el catálogo público del plugin Inmobiliaria — mismo criterio
 * que `TiendaLayout` pero sin carrito/tema (esta fase no lo necesita):
 * resuelve el `:subdominio` de la URL, trae nombre/logo del tenant una
 * sola vez, y expone todo vía `useOutletContext` a las páginas hijas.
 */
export function InmobiliariaPublicaLayout() {
  const { subdominio = '' } = useParams();
  const { favoritos } = useFavoritosPropiedades(subdominio);

  const { data: config, isLoading, isError } = useQuery({
    queryKey: ['inmobiliaria-publica-config', subdominio],
    queryFn: async () => (await apiClient.get<ConfigPublica>(`/inmobiliaria/${subdominio}/config`)).data,
  });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Cargando…</div>;
  }
  if (isError || !config) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold text-slate-700">Catálogo no encontrado</p>
        <p className="text-sm text-slate-400">Revisá el enlace — puede que ya no esté disponible.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-5 py-3.5">
          {config.logo ? (
            <img src={config.logo} alt="" className="h-8 max-w-[160px] object-contain" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">
              {config.nombre.charAt(0).toUpperCase()}
            </span>
          )}
          <Link to={`/inmobiliaria/${subdominio}`} className="text-base font-semibold text-slate-900">
            {config.nombre}
          </Link>
          <Link to={`/inmobiliaria/${subdominio}/favoritos`} className="ml-auto flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-teal-700">
            <Heart size={16} />
            Favoritos
            {favoritos.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1 text-xs font-bold text-white">{favoritos.length}</span>
            )}
          </Link>
        </div>
      </nav>

      <Outlet context={{ subdominio, config } satisfies ContextoInmobiliariaPublica} />

      <footer className="mt-16 border-t border-slate-200 bg-slate-900 py-8">
        <div className="mx-auto max-w-6xl px-5 text-sm text-slate-300">
          <p className="text-base font-semibold text-white">{config.nombre}</p>
          <p className="mt-1 text-slate-400">Catálogo de propiedades — Sistema del Sol.</p>
        </div>
      </footer>
    </div>
  );
}
