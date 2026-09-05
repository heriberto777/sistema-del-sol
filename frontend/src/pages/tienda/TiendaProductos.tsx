import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { useCategoriasTienda, useTiendaCatalogo, useTiendaConfig } from '../../hooks/useTienda';
import { useCarritoTiendaContext } from './CarritoTiendaContext';
import { useCarritoDrawer } from './CarritoDrawerContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { TarjetaProductoTienda } from './TarjetaProductoTienda';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

/**
 * Página dedicada del catálogo completo (pedido explícito, "opción B" —
 * ver PLANTILLAS_PEDIDO... no, ver tipos.ts/PropsHome): antes el link
 * "Productos" del menú de las 17 plantillas apuntaba a `#catalogo`, un
 * ancla DENTRO del Home — nunca cambiaba de ruta ("se queda en la misma
 * página", reportado). Ahora es una página propia, mismo criterio que
 * `TiendaCategoria` (genérica, sin piel por plantilla, con su propia
 * barra mínima de volver+carrito): búsqueda, filtro por categoría y
 * paginación real (antes NINGUNA página de tienda paginaba de verdad —
 * `useTiendaCatalogo` ya lo soporta, solo nadie le mandaba `pagina`).
 *
 * `?busqueda=` en la URL — para que un buscador en el Home (si una
 * plantilla lo muestra en su hero) pueda linkear acá con el texto ya
 * cargado, en vez de filtrar in-place como antes.
 */
export function TiendaProductos() {
  const subdominio = useSubdominioTienda();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState(searchParams.get('busqueda') ?? '');
  const [categoriaId, setCategoriaId] = useState<string | undefined>(undefined);
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const carrito = useCarritoTiendaContext();
  const { abrir } = useCarritoDrawer();

  const { data: config, isLoading, isError } = useTiendaConfig(subdominio);
  const { data: categorias = [] } = useCategoriasTienda(subdominio);
  const { data: paginaResultado, isLoading: cargandoCatalogo } = useTiendaCatalogo(subdominio, {
    pagina,
    busqueda: busquedaDebounced || undefined,
    categoriaId,
  });

  // Cambiar de búsqueda/categoría vuelve siempre a la página 1 — quedarse
  // en la 3 de un filtro nuevo que capaz solo tiene 1 página deja la
  // grilla vacía sin que sea obvio por qué.
  useEffect(() => {
    setPagina(1);
  }, [busquedaDebounced, categoriaId]);

  // Refleja la búsqueda en la URL (sin agregar historial nuevo por cada
  // tecla) — así el link se puede compartir/recargar con el filtro puesto.
  useEffect(() => {
    setSearchParams(busquedaDebounced ? { busqueda: busquedaDebounced } : {}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaDebounced]);

  if (isLoading) return <TiendaCargando />;
  if (isError || !config) return <TiendaNoEncontrada />;

  const productos = paginaResultado?.datos ?? [];
  const total = paginaResultado?.total ?? 0;
  const tamanoPagina = paginaResultado?.tamanoPagina ?? 20;
  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina));
  const accent = config.tema.colorAcento || config.colorAcento || '#111827';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <Link to={`/tienda/${subdominio}`} className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <ArrowLeft size={16} />
          {config.nombre}
        </Link>
        <button type="button" onClick={abrir} className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300" aria-label="Abrir carrito">
          <ShoppingBag size={18} />
          {carrito.cantidadTotal > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: accent }}>
              {carrito.cantidadTotal}
            </span>
          )}
        </button>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
          <Link to={`/tienda/${subdominio}`} className="hover:underline">
            Inicio
          </Link>{' '}
          / Productos
        </p>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Todos los productos</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{cargandoCatalogo ? 'Cargando…' : `${total} producto${total === 1 ? '' : 's'}`}</p>
          </div>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar productos…"
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {categorias.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoriaId(undefined)}
              className="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold"
              style={{
                background: !categoriaId ? accent : 'transparent',
                color: !categoriaId ? '#fff' : undefined,
                borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
              }}
            >
              Todo
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoriaId(c.id)}
                className="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold"
                style={{
                  background: categoriaId === c.id ? accent : 'transparent',
                  color: categoriaId === c.id ? '#fff' : undefined,
                  borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
                }}
              >
                {c.nombre} <span className="opacity-60">({c.cantidad})</span>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {!cargandoCatalogo && productos.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-slate-400">No encontramos productos con ese filtro.</p>
          )}
          {productos.map((p) => (
            <TarjetaProductoTienda
              key={p.id}
              producto={p}
              subdominio={subdominio}
              defaults={{ acento: accent }}
              estiloInsigniaSinStock={config.tema.estiloInsigniaSinStock}
            />
          ))}
        </div>

        {totalPaginas > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              <ChevronLeft size={15} />
              Anterior
            </button>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Página {pagina} de {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              Siguiente
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
