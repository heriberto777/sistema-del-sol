import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { Paginacion } from '../../components/molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PaginaResultado } from '../../types/pagina-resultado';
import { ETIQUETA_OPERACION_PROPIEDAD, ETIQUETA_TIPO_PROPIEDAD, OPERACIONES_PROPIEDAD, PropiedadPublica, TIPOS_PROPIEDAD } from '../../types/inmobiliaria';
import { ContextoInmobiliariaPublica } from './InmobiliariaPublicaLayout';
import { useFavoritosPropiedades } from './useFavoritosPropiedades';
import { ComparadorPropiedadesModal } from './ComparadorPropiedadesModal';
import { AlertaBusquedaForm } from './AlertaBusquedaForm';

const MAX_COMPARAR = 4;

function precioFormateado(p: PropiedadPublica) {
  const simbolo = p.moneda === 'DOP' ? 'RD$' : 'US$';
  const sufijo = p.operacion === 'ALQUILER' ? '/mes' : '';
  return `${simbolo} ${Number(p.precio).toLocaleString('es-DO')}${sufijo}`;
}

export function PropiedadesPublico() {
  const { subdominio, config } = useOutletContext<ContextoInmobiliariaPublica>();
  const { esFavorito, alternar } = useFavoritosPropiedades(subdominio);
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [operacion, setOperacion] = useState('');
  const [tipo, setTipo] = useState('');
  const [pagina, setPagina] = useState(1);
  const [seleccionComparar, setSeleccionComparar] = useState<string[]>([]);
  const [comparadorAbierto, setComparadorAbierto] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inmobiliaria-publica-propiedades', subdominio, pagina, busquedaDebounced, operacion, tipo],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<PropiedadPublica>>(`/inmobiliaria/${subdominio}/propiedades`, {
          params: { pagina, busqueda: busquedaDebounced || undefined, operacion: operacion || undefined, tipo: tipo || undefined },
        })
      ).data,
  });

  const propiedades = data?.datos ?? [];

  function alternarComparar(id: string) {
    setSeleccionComparar((actual) => {
      if (actual.includes(id)) return actual.filter((x) => x !== id);
      if (actual.length >= MAX_COMPARAR) return actual;
      return [...actual, id];
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-24">
      <header className="rounded-3xl bg-gradient-to-br from-teal-700 via-teal-800 to-teal-900 px-6 py-14 text-center text-white sm:py-20">
        <h1 className="text-2xl font-bold sm:text-3xl">Encuentra tu próxima propiedad</h1>
        <p className="mt-2 text-teal-100">{config.nombre}</p>

        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap gap-2 rounded-2xl bg-white p-3 shadow-xl">
          <select
            value={operacion}
            onChange={(e) => {
              setOperacion(e.target.value);
              setPagina(1);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
          >
            <option value="">Comprar o alquilar</option>
            {OPERACIONES_PROPIEDAD.map((o) => (
              <option key={o} value={o}>
                {ETIQUETA_OPERACION_PROPIEDAD[o]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Ciudad, sector…"
            className="min-w-[160px] flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400"
          />
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value);
              setPagina(1);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
          >
            <option value="">Cualquier tipo</option>
            {TIPOS_PROPIEDAD.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO_PROPIEDAD[t]}
              </option>
            ))}
          </select>
        </div>

        <AlertaBusquedaForm subdominio={subdominio} operacion={operacion} tipo={tipo} ubicacion={busquedaDebounced} />
      </header>

      <div className="mt-10">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Propiedades disponibles</h2>
            {data && <p className="text-sm text-slate-400">{data.total} disponible(s)</p>}
          </div>
        </div>

        {isLoading && <p className="text-sm text-slate-400">Cargando…</p>}
        {!isLoading && propiedades.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Sin propiedades que coincidan con la búsqueda.</p>}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {propiedades.map((p) => (
            <article key={p.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
              <Link to={`/inmobiliaria/${subdominio}/${p.id}`} className="block">
                <div className="relative flex h-44 items-center justify-center bg-teal-700/90 text-4xl text-white/40">
                  {p.imagenes[0] ? <img src={p.imagenes[0].imagen} alt="" className="h-full w-full object-cover" /> : '🏠'}
                  <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ${p.operacion === 'ALQUILER' ? 'bg-amber-500 text-white' : 'bg-white/95 text-teal-800'}`}>
                    {ETIQUETA_OPERACION_PROPIEDAD[p.operacion] ?? p.operacion}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      alternar(p.id);
                    }}
                    aria-label="Guardar en favoritos"
                    className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 ${esFavorito(p.id) ? 'text-red-500' : 'text-white'}`}
                  >
                    <Heart size={16} fill={esFavorito(p.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <div className="p-4">
                  <p className="text-lg font-bold text-slate-900">{precioFormateado(p)}</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-slate-700">{p.titulo}</p>
                  <p className="text-xs text-slate-400">{p.ubicacion}</p>
                  <div className="mt-3 flex gap-3 text-xs text-slate-500">
                    {p.habitaciones != null && <span>🛏 {p.habitaciones} hab</span>}
                    {p.banos != null && <span>🛁 {p.banos} baños</span>}
                    {p.metrosConstruccion != null && <span>📐 {p.metrosConstruccion} m²</span>}
                  </div>
                </div>
              </Link>
              <label className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-500">
                <input
                  type="checkbox"
                  checked={seleccionComparar.includes(p.id)}
                  disabled={!seleccionComparar.includes(p.id) && seleccionComparar.length >= MAX_COMPARAR}
                  onChange={() => alternarComparar(p.id)}
                  className="rounded border-slate-300"
                />
                Comparar
              </label>
            </article>
          ))}
        </div>

        {data && (
          <div className="mt-6">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </div>

      {seleccionComparar.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-5 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <p className="text-sm text-slate-600">{seleccionComparar.length} de {MAX_COMPARAR} propiedades seleccionadas</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSeleccionComparar([])} className="text-sm text-slate-500 hover:text-slate-700">
                Limpiar
              </button>
              <button
                type="button"
                disabled={seleccionComparar.length < 2}
                onClick={() => setComparadorAbierto(true)}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Comparar
              </button>
            </div>
          </div>
        </div>
      )}

      {comparadorAbierto && <ComparadorPropiedadesModal subdominio={subdominio} ids={seleccionComparar} onClose={() => setComparadorAbierto(false)} />}
    </main>
  );
}
