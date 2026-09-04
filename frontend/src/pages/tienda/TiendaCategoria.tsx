import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { useCategoriasTienda, useTiendaCatalogo, useTiendaConfig } from '../../hooks/useTienda';
import { useCarritoTiendaContext } from './CarritoTiendaContext';
import { useCarritoDrawer } from './CarritoDrawerContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { TarjetaProductoTienda } from './TarjetaProductoTienda';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

/**
 * Página dedicada de una categoría (Fase 18) — a la que llega un clic en
 * una sección CATEGORIA/MINIGRID de "Secciones Dinámicas" (ver
 * SeccionesDinamicas.tsx). Antes ese clic solo filtraba el Home in-place,
 * dejando visible el hero + Destacados + Ofertas + el resto de secciones
 * arriba de la grilla filtrada — el usuario lo describió como "muy lleno"
 * y pidió el patrón de amazon.com: clic en una categoría lleva a una
 * página propia, chica y enfocada, solo con esos productos. Genérica (no
 * una piel más por plantilla, mismo criterio que TiendaCheckout/
 * TiendaMisPedidos) pero con una barra propia mínima (volver + carrito)
 * porque a diferencia de esas dos, acá sí hace falta poder seguir
 * navegando la tienda sin depender del botón atrás del navegador.
 */
export function TiendaCategoria() {
  const subdominio = useSubdominioTienda();
  const { categoriaId = '' } = useParams();
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebouncedValue(busqueda);
  const carrito = useCarritoTiendaContext();
  const { abrir } = useCarritoDrawer();

  const { data: config, isLoading, isError } = useTiendaConfig(subdominio);
  const { data: categorias = [] } = useCategoriasTienda(subdominio);
  const { data: pagina, isLoading: cargandoCatalogo } = useTiendaCatalogo(subdominio, {
    categoriaId,
    busqueda: busquedaDebounced || undefined,
  });

  if (isLoading) return <TiendaCargando />;
  if (isError || !config) return <TiendaNoEncontrada />;

  const productos = pagina?.datos ?? [];
  // La categoría puede no traer productos propios (recién creada, o todos
  // ocultos/sin stock) — en ese caso no aparece en `categorias`
  // (categoriasPublicas solo lista las que tienen algo visible); cae a
  // "Categoría" en vez de dejar el título vacío.
  const nombreCategoria = categorias.find((c) => c.id === categoriaId)?.nombre ?? productos[0]?.categoria?.nombre ?? 'Categoría';
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
          / {nombreCategoria}
        </p>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{nombreCategoria}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {cargandoCatalogo ? 'Cargando…' : `${productos.length} producto${productos.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar en ${nombreCategoria}…`}
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {!cargandoCatalogo && productos.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-slate-400">No hay productos en esta categoría todavía.</p>
          )}
          {productos.map((p) => (
            <TarjetaProductoTienda
              key={p.id}
              producto={p}
              subdominio={subdominio}
              defaults={{ acento: accent }}
              estiloInsigniaSinStock={config?.tema.estiloInsigniaSinStock}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
