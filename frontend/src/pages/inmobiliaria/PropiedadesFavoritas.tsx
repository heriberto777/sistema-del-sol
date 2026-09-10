import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { PaginaResultado } from '../../types/pagina-resultado';
import { ETIQUETA_OPERACION_PROPIEDAD, PropiedadPublica } from '../../types/inmobiliaria';
import { ContextoInmobiliariaPublica } from './InmobiliariaPublicaLayout';
import { useFavoritosPropiedades } from './useFavoritosPropiedades';

function precioFormateado(p: PropiedadPublica) {
  const simbolo = p.moneda === 'DOP' ? 'RD$' : 'US$';
  const sufijo = p.operacion === 'ALQUILER' ? '/mes' : '';
  return `${simbolo} ${Number(p.precio).toLocaleString('es-DO')}${sufijo}`;
}

export function PropiedadesFavoritas() {
  const { subdominio } = useOutletContext<ContextoInmobiliariaPublica>();
  const { favoritos, alternar } = useFavoritosPropiedades(subdominio);

  const { data, isLoading } = useQuery({
    queryKey: ['inmobiliaria-publica-favoritos', subdominio, favoritos],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<PropiedadPublica>>(`/inmobiliaria/${subdominio}/propiedades`, {
          params: { ids: favoritos.join(','), tamanoPagina: 50 },
        })
      ).data,
    enabled: favoritos.length > 0,
  });

  const propiedades = data?.datos ?? [];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Tus favoritos</h1>
      <p className="mt-1 text-sm text-slate-400">Guardados en este navegador — no se comparten entre dispositivos.</p>

      {favoritos.length === 0 && (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Todavía no guardaste ninguna propiedad. Tocá el corazón en cualquier ficha para agregarla acá.
        </p>
      )}

      {isLoading && <p className="mt-8 text-sm text-slate-400">Cargando…</p>}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {propiedades.map((p) => (
          <div key={p.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Link to={`/inmobiliaria/${subdominio}/${p.id}`} className="block">
              <div className="relative flex h-44 items-center justify-center bg-teal-700/90 text-4xl text-white/40">
                {p.imagenes[0] ? <img src={p.imagenes[0].imagen} alt="" className="h-full w-full object-cover" /> : '🏠'}
              </div>
              <div className="p-4">
                <p className="text-lg font-bold text-slate-900">{precioFormateado(p)}</p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-700">{p.titulo}</p>
                <p className="text-xs text-slate-400">
                  {ETIQUETA_OPERACION_PROPIEDAD[p.operacion] ?? p.operacion} · {p.ubicacion}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => alternar(p.id)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
            >
              <Heart size={14} fill="currentColor" />
              Quitar de favoritos
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
