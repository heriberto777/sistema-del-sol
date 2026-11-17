import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Modal } from '../../molecules/Modal/Modal';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../RequierePermiso/RequierePermiso';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { KardexView } from '../KardexView/KardexView';
import { VencimientosPanel } from '../VencimientosPanel/VencimientosPanel';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { useAuth } from '../../../hooks/useAuth';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { FORMATOS_IMPRESION } from '../../../constants/formato-impresion';
import { PLANTILLAS_DOCUMENTO } from '../../../constants/plantilla-documento';
import type { BodegaConSucursal } from '@backend-src/common/prisma/bodega-select-basico';

export type Bodega = BodegaConSucursal;

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  controlaVencimiento: boolean;
}

interface Stock {
  productoId: string;
  varianteId: string;
  cantidadActual: string;
  cantidadReservada: string;
  stockMinimo: string;
  producto: Producto;
  valoresAtributo: { atributo: string; valor: string }[];
}

/**
 * Auditoría UX Fase 2 — extraído de Inventario.tsx (antes un solo archivo de
 * 1498 líneas con 3 tabs sin URL propia). Esta pieza es la pestaña "Stock":
 * bodegas + existencias.
 *
 * Auditoría de modales pendientes (bloque "Medianos") — "Ajustar stock"/
 * "Agregar producto"/"Transferir stock" (antes modales de una sola línea,
 * duplicando InventarioAjusteNuevo/InventarioTransferenciaNueva) ahora
 * navegan a esas mismas páginas con la bodega y el producto/variante ya
 * preseleccionados por query string — unifica el atajo rápido con el
 * flujo multi-línea en vez de mantener dos formularios distintos para lo
 * mismo. "Nueva bodega"/"Editar bodega" pasan a página propia.
 */
export function StockBodegasPanel() {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const tienePermisoAjustar = tienePermiso('inventario.ajustar');
  const tienePermisoTransferir = tienePermiso('inventario.transferir');
  const tienePermisoAdmin = tienePermiso('admin.configuracion');
  const [searchParams, setSearchParams] = useSearchParams();
  const [bodegaSeleccionadaId, setBodegaSeleccionadaId] = useState<string | null>(null);
  const [mostrarInactivas, setMostrarInactivas] = useState(false);
  const [stockVerKardex, setStockVerKardex] = useState<Stock | null>(null);
  const [modalVencimientos, setModalVencimientos] = useState(false);
  const [busquedaStock, setBusquedaStock] = useState('');
  const [paginaStock, setPaginaStock] = useState(1);
  const busquedaStockDebounced = useDebouncedValue(busquedaStock);

  // "Ver stock" desde Productos.tsx — llega con `?buscar=<código>` para no
  // tener que retipear el producto acá. Si el tenant tiene una sola bodega,
  // se autoselecciona (si tiene varias, el usuario elige cuál mirar).
  const [buscarAlLlegar] = useState(() => searchParams.get('buscar'));
  const [busquedaPendienteDePreservar, setBusquedaPendienteDePreservar] = useState(() => !!buscarAlLlegar);

  useEffect(() => {
    if (searchParams.get('crear') === '1') {
      navigate('/inventario/bodegas/nueva', { replace: true });
      return;
    }
    if (buscarAlLlegar) {
      setBusquedaStock(buscarAlLlegar);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas', mostrarInactivas],
    queryFn: async () =>
      (await apiClient.get<Bodega[]>(mostrarInactivas ? '/inventario/bodegas/todas' : '/inventario/bodegas')).data,
  });

  useEffect(() => {
    if (buscarAlLlegar && bodegas?.length === 1 && !bodegaSeleccionadaId) {
      setBodegaSeleccionadaId(bodegas[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegas]);

  const { data: stock } = useQuery({
    queryKey: ['stock', bodegaSeleccionadaId, paginaStock, busquedaStockDebounced],
    enabled: !!bodegaSeleccionadaId,
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Stock>>(`/inventario/stock/${bodegaSeleccionadaId}`, {
          params: { pagina: paginaStock, busqueda: busquedaStockDebounced || undefined },
        })
      ).data,
  });

  const bodegaSeleccionada = bodegas?.find((b) => b.id === bodegaSeleccionadaId) ?? null;

  function seleccionarBodega(id: string) {
    setBodegaSeleccionadaId(id);
    setPaginaStock(1);
    // Si se llegó con `?buscar=` (botón "Ver stock" de Productos) y había más
    // de una bodega, esta primera selección es el usuario recién eligiendo
    // cuál mirar — no hay que borrarle la búsqueda que trajo puesta. Un
    // cambio de bodega posterior ya vuelve al comportamiento normal.
    if (busquedaPendienteDePreservar) {
      setBusquedaPendienteDePreservar(false);
    } else {
      setBusquedaStock('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <RequierePermiso permiso="inventario.ver">
          <Button variante="secundario" onClick={() => setModalVencimientos(true)}>
            Vencimientos próximos
          </Button>
        </RequierePermiso>
        <RequierePermiso permiso="admin.configuracion">
          <Button onClick={() => navigate('/inventario/bodegas/nueva')}>Nueva bodega</Button>
        </RequierePermiso>
      </div>

      {tienePermisoAdmin && (
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" checked={mostrarInactivas} onChange={(e) => setMostrarInactivas(e.target.checked)} />
          Mostrar bodegas inactivas
        </label>
      )}
      {bodegas?.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay bodegas"
          descripcion="Creá la primera para empezar a llevar control de tu stock."
          etiquetaAccion="Nueva bodega"
          onAccion={() => navigate('/inventario/bodegas/nueva')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bodegas?.map((bodega) => (
            <div
              key={bodega.id}
              role="button"
              tabIndex={0}
              onClick={() => seleccionarBodega(bodega.id)}
              onKeyDown={(e) => e.key === 'Enter' && seleccionarBodega(bodega.id)}
              className={clsx(
                'rounded-lg border p-4 text-left transition-colors',
                bodega.id === bodegaSeleccionadaId
                  ? 'border-sol-500 bg-sol-50 dark:bg-sol-900/20'
                  : 'border-slate-200 bg-white hover:border-sol-300 dark:border-slate-800 dark:bg-slate-900',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{bodega.nombre}</p>
                  {bodega.sucursal && <p className="text-xs text-slate-400">{bodega.sucursal.nombre}</p>}
                  {bodega.direccion && <p className="text-sm text-slate-500 dark:text-slate-400">{bodega.direccion}</p>}
                </div>
                {!bodega.activa && <Badge tono="peligro">Inactiva</Badge>}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {FORMATOS_IMPRESION.find((f) => f.value === bodega.formatoImpresion)?.label ?? 'Formato de la empresa'}
                  {' · '}
                  {PLANTILLAS_DOCUMENTO.find((p) => p.value === bodega.plantillaDocumento)?.label ?? 'Diseño de la empresa'}
                </p>
                <RequierePermiso permiso="admin.configuracion">
                  <div onClick={(e) => e.stopPropagation()}>
                    <RowActionsMenu acciones={[{ etiqueta: 'Editar', onClick: () => navigate(`/inventario/bodegas/${bodega.id}`) }]} />
                  </div>
                </RequierePermiso>
              </div>
            </div>
          ))}
        </div>
      )}

      {bodegaSeleccionada && (
        <Card
          sinPadding
          titulo={`Stock — ${bodegaSeleccionada.nombre}`}
          descripcion={stock ? `${stock.total} producto(s) en esta bodega` : undefined}
          acciones={
            <div className="flex items-center gap-2">
              <SearchInput
                value={busquedaStock}
                onChange={(v) => {
                  setBusquedaStock(v);
                  setPaginaStock(1);
                }}
                placeholder="Buscar por código o nombre de producto…"
              />
              {tienePermisoAjustar && (
                <Button onClick={() => navigate(`/inventario/ajustes/nuevo?bodegaId=${bodegaSeleccionadaId}`)}>Agregar producto</Button>
              )}
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Producto</th>
                  <th className="px-5 py-3 font-medium">Actual</th>
                  <th className="px-5 py-3 font-medium">Reservada</th>
                  <th className="px-5 py-3 font-medium">Disponible</th>
                  <th className="px-5 py-3 font-medium">Mínimo</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stock?.datos.map((linea) => (
                  <tr key={linea.varianteId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">
                      {linea.producto.codigo} — {linea.producto.nombre}
                      {linea.valoresAtributo.length > 0 && (
                        <span className="ml-2 text-xs text-slate-400">
                          ({linea.valoresAtributo.map((va) => `${va.atributo}: ${va.valor}`).join(', ')})
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">{Number(linea.cantidadActual)}</td>
                    <td className="px-5 py-3">{Number(linea.cantidadReservada)}</td>
                    <td className="px-5 py-3">{Number(linea.cantidadActual) - Number(linea.cantidadReservada)}</td>
                    <td className="px-5 py-3">{Number(linea.stockMinimo)}</td>
                    <td className="px-5 py-3 text-right">
                      <RowActionsMenu
                        acciones={[
                          { etiqueta: 'Ver kardex', onClick: () => setStockVerKardex(linea) },
                          ...(tienePermisoAjustar
                            ? [
                                {
                                  etiqueta: 'Ajustar stock',
                                  onClick: () =>
                                    navigate(
                                      `/inventario/ajustes/nuevo?bodegaId=${bodegaSeleccionadaId}&productoId=${linea.producto.id}&varianteId=${linea.varianteId}`,
                                    ),
                                },
                              ]
                            : []),
                          ...(tienePermisoTransferir
                            ? [
                                {
                                  etiqueta: 'Transferir stock',
                                  onClick: () =>
                                    navigate(
                                      `/inventario/transferencias/nuevo?bodegaOrigenId=${bodegaSeleccionadaId}&productoId=${linea.producto.id}&varianteId=${linea.varianteId}`,
                                    ),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
                {stock?.datos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                      Esta bodega no tiene stock registrado todavía — usá "Agregar producto" arriba para cargar el primero.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {stock && (
            <div className="px-5 py-3">
              <Paginacion pagina={stock.pagina} tamanoPagina={stock.tamanoPagina} total={stock.total} onCambiarPagina={setPaginaStock} />
            </div>
          )}
        </Card>
      )}

      {stockVerKardex && bodegaSeleccionadaId && (
        <Modal
          titulo={`Kardex — ${stockVerKardex.producto.codigo} — ${stockVerKardex.producto.nombre}`}
          ancho="xl"
          onClose={() => setStockVerKardex(null)}
        >
          <KardexView varianteId={stockVerKardex.varianteId} bodegaId={bodegaSeleccionadaId} />
        </Modal>
      )}
      {modalVencimientos && (
        <Modal titulo="Vencimientos próximos (30 días)" ancho="xl" onClose={() => setModalVencimientos(false)}>
          <VencimientosPanel />
        </Modal>
      )}
    </div>
  );
}
