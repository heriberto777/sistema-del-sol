import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { CampoPin } from '../components/molecules/CampoPin/CampoPin';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { KardexView } from '../components/organisms/KardexView/KardexView';
import { VencimientosPanel } from '../components/organisms/VencimientosPanel/VencimientosPanel';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { useAuth } from '../hooks/useAuth';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useVariantesProducto } from '../hooks/useVariantesProducto';
import { SelectorLineaProducto } from '../components/molecules/SelectorLineaProducto/SelectorLineaProducto';
import { PaginaResultado } from '../types/pagina-resultado';
import { FORMATOS_IMPRESION, FormatoImpresion } from '../constants/formato-impresion';
import { METODOS_APERTURA_CAJA, MetodoAperturaCaja } from '../constants/metodo-apertura-caja';

interface Bodega {
  id: string;
  nombre: string;
  direccion: string | null;
  formatoImpresion: FormatoImpresion | null;
  metodoAperturaCaja: MetodoAperturaCaja | null;
  sucursalId: string;
  activa: boolean;
  sucursal?: { nombre: string };
}

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  controlaVencimiento: boolean;
}

interface Lote {
  id: string;
  numeroLote: string;
  fechaVencimiento: string;
  cantidadActual: string;
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

/** Lo mínimo que necesita ModalAjustarStock — un `Stock` ya existente lo cumple tal cual, pero también permite construirlo "a mano" para un producto/variante que todavía no tiene fila de Stock en esta bodega (ver ModalAgregarProductoStock). */
interface ProductoParaAjuste {
  producto: Producto;
  varianteId: string;
  valoresAtributo: { atributo: string; valor: string }[];
}

// Ítem E-1 — documento Borrador→Confirmado de ajustes de inventario.
interface AjusteInventario {
  id: string;
  numero: string;
  estado: 'BORRADOR' | 'CONFIRMADO' | 'CANCELADO';
  fecha: string;
  bodega: { nombre: string };
}

interface LineaAjusteDetalle {
  productoId: string;
  varianteId: string;
  cantidad: string;
  motivoAjuste: string;
  motivo: string | null;
  producto: Producto;
}

interface AjusteInventarioDetalle extends AjusteInventario {
  bodegaId: string;
  lineas: LineaAjusteDetalle[];
}

// Ítem E-1 — documento Borrador→Confirmado de transferencias entre bodegas.
interface TransferenciaInventario {
  id: string;
  numero: string;
  estado: 'BORRADOR' | 'CONFIRMADO' | 'CANCELADO';
  fecha: string;
  bodegaOrigen: { nombre: string };
  bodegaDestino: { nombre: string };
}

interface LineaTransferenciaDetalle {
  productoId: string;
  varianteId: string;
  cantidad: string;
  producto: Producto;
}

interface TransferenciaInventarioDetalle extends TransferenciaInventario {
  bodegaOrigenId: string;
  bodegaDestinoId: string;
  lineas: LineaTransferenciaDetalle[];
}

type PestanaInventario = 'stock' | 'ajustes' | 'transferencias';

export function Inventario() {
  const { tienePermiso } = useAuth();
  const tienePermisoAjustar = tienePermiso('inventario.ajustar');
  const tienePermisoTransferir = tienePermiso('inventario.transferir');
  const tienePermisoAdmin = tienePermiso('admin.configuracion');
  const [searchParams, setSearchParams] = useSearchParams();
  const [pestana, setPestana] = useState<PestanaInventario>('stock');
  const [bodegaSeleccionadaId, setBodegaSeleccionadaId] = useState<string | null>(null);
  const [modalNuevaBodega, setModalNuevaBodega] = useState(false);
  const [mostrarInactivas, setMostrarInactivas] = useState(false);
  const [stockAjustando, setStockAjustando] = useState<Stock | null>(null);
  const [agregandoProducto, setAgregandoProducto] = useState(false);
  const [stockTransfiriendo, setStockTransfiriendo] = useState<Stock | null>(null);
  const [stockVerKardex, setStockVerKardex] = useState<Stock | null>(null);
  const [modalVencimientos, setModalVencimientos] = useState(false);
  const [bodegaEditando, setBodegaEditando] = useState<Bodega | null>(null);
  const [busquedaStock, setBusquedaStock] = useState('');
  const [paginaStock, setPaginaStock] = useState(1);
  const busquedaStockDebounced = useDebouncedValue(busquedaStock);
  const [ajusteViendo, setAjusteViendo] = useState<AjusteInventario | null>(null);
  const [ajusteEditando, setAjusteEditando] = useState<AjusteInventario | null>(null);
  const [ajusteConfirmando, setAjusteConfirmando] = useState<AjusteInventario | null>(null);
  const [ajusteNuevo, setAjusteNuevo] = useState(false);
  const [paginaAjustes, setPaginaAjustes] = useState(1);
  const [transferenciaViendo, setTransferenciaViendo] = useState<TransferenciaInventario | null>(null);
  const [transferenciaEditando, setTransferenciaEditando] = useState<TransferenciaInventario | null>(null);
  const [transferenciaNueva, setTransferenciaNueva] = useState(false);
  const [paginaTransferencias, setPaginaTransferencias] = useState(1);

  useEffect(() => {
    if (searchParams.get('crear') === '1') {
      setModalNuevaBodega(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas', mostrarInactivas],
    queryFn: async () =>
      (await apiClient.get<Bodega[]>(mostrarInactivas ? '/inventario/bodegas/todas' : '/inventario/bodegas')).data,
  });

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

  const { data: ajustes } = useQuery({
    queryKey: ['ajustes-inventario', paginaAjustes],
    queryFn: async () => (await apiClient.get<PaginaResultado<AjusteInventario>>('/ajustes-inventario', { params: { pagina: paginaAjustes } })).data,
  });

  const { data: transferencias } = useQuery({
    queryKey: ['transferencias-inventario', paginaTransferencias],
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<TransferenciaInventario>>('/transferencias-inventario', { params: { pagina: paginaTransferencias } })).data,
  });

  const queryClient = useQueryClient();
  const cambiarEstadoAjuste = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'CONFIRMADO' | 'CANCELADO' }) =>
      apiClient.patch(`/ajustes-inventario/${id}/estado`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ajustes-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
  const cambiarEstadoTransferencia = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'CONFIRMADO' | 'CANCELADO' }) =>
      apiClient.patch(`/transferencias-inventario/${id}/estado`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });

  const bodegaSeleccionada = bodegas?.find((b) => b.id === bodegaSeleccionadaId) ?? null;

  function seleccionarBodega(id: string) {
    setBodegaSeleccionadaId(id);
    setPaginaStock(1);
    setBusquedaStock('');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Inventario</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Bodegas y existencias por producto.</p>
        </div>
        <div className="flex items-center gap-2">
          <RequierePermiso permiso="inventario.ver">
            <Button variante="secundario" onClick={() => setModalVencimientos(true)}>
              Vencimientos próximos
            </Button>
          </RequierePermiso>
          <RequierePermiso permiso="admin.configuracion">
            <Button onClick={() => setModalNuevaBodega(true)}>Nueva bodega</Button>
          </RequierePermiso>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {([
          { clave: 'stock', etiqueta: 'Stock' },
          { clave: 'ajustes', etiqueta: 'Ajustes' },
          { clave: 'transferencias', etiqueta: 'Transferencias' },
        ] as const).map((t) => (
          <button
            key={t.clave}
            onClick={() => setPestana(t.clave)}
            className={
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px ' +
              (pestana === t.clave
                ? 'border-sol-500 text-sol-700 dark:text-sol-300'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400')
            }
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'stock' && (
      <RequierePermiso permiso="inventario.ver">
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
            onAccion={() => setModalNuevaBodega(true)}
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
                  </p>
                  <RequierePermiso permiso="admin.configuracion">
                    <div onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu acciones={[{ etiqueta: 'Editar', onClick: () => setBodegaEditando(bodega) }]} />
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
                {tienePermisoAjustar && <Button onClick={() => setAgregandoProducto(true)}>Agregar producto</Button>}
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
                              ? [{ etiqueta: 'Ajustar stock', onClick: () => setStockAjustando(linea) }]
                              : []),
                            ...(tienePermisoTransferir
                              ? [{ etiqueta: 'Transferir stock', onClick: () => setStockTransfiriendo(linea) }]
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
      </RequierePermiso>
      )}

      {pestana === 'ajustes' && (
      <RequierePermiso permiso="inventario.ver">
        <Card
          sinPadding
          titulo="Ajustes de inventario"
          descripcion={ajustes ? `${ajustes.total} ajuste(s) — ítem E-1, Borrador→Confirmado` : undefined}
          acciones={tienePermisoAjustar && <Button onClick={() => setAjusteNuevo(true)}>Nuevo ajuste</Button>}
        >
          {ajustes?.datos.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              Todavía no hay ajustes registrados — usá el botón "Nuevo ajuste" de arriba para crear el primero.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Número</th>
                    <th className="px-5 py-3 font-medium">Bodega</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ajustes?.datos.map((aj) => (
                    <tr key={aj.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">{aj.numero}</td>
                      <td className="px-5 py-3">{aj.bodega.nombre}</td>
                      <td className="px-5 py-3">{new Date(aj.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3">
                        <Badge tono={aj.estado === 'CONFIRMADO' ? 'exito' : aj.estado === 'CANCELADO' ? 'peligro' : 'neutro'}>{aj.estado}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RowActionsMenu
                          acciones={[
                            { etiqueta: 'Ver detalle', onClick: () => setAjusteViendo(aj) },
                            ...(aj.estado === 'BORRADOR' && tienePermisoAjustar
                              ? [
                                  { etiqueta: 'Editar', onClick: () => setAjusteEditando(aj) },
                                  { etiqueta: 'Confirmar', onClick: () => setAjusteConfirmando(aj) },
                                  {
                                    etiqueta: 'Cancelar',
                                    tono: 'peligro' as const,
                                    onClick: () => {
                                      if (confirm(`¿Cancelar el ajuste ${aj.numero}?`)) cambiarEstadoAjuste.mutate({ id: aj.id, estado: 'CANCELADO' });
                                    },
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ajustes && (
            <div className="px-5 py-3">
              <Paginacion pagina={ajustes.pagina} tamanoPagina={ajustes.tamanoPagina} total={ajustes.total} onCambiarPagina={setPaginaAjustes} />
            </div>
          )}
        </Card>
      </RequierePermiso>
      )}

      {pestana === 'transferencias' && (
      <RequierePermiso permiso="inventario.ver">
        <Card
          sinPadding
          titulo="Transferencias de inventario"
          descripcion={transferencias ? `${transferencias.total} transferencia(s) — ítem E-1, Borrador→Confirmado` : undefined}
          acciones={tienePermisoTransferir && <Button onClick={() => setTransferenciaNueva(true)}>Nueva transferencia</Button>}
        >
          {transferencias?.datos.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              Todavía no hay transferencias registradas — usá el botón "Nueva transferencia" de arriba para crear la primera.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Número</th>
                    <th className="px-5 py-3 font-medium">Origen</th>
                    <th className="px-5 py-3 font-medium">Destino</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transferencias?.datos.map((tr) => (
                    <tr key={tr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">{tr.numero}</td>
                      <td className="px-5 py-3">{tr.bodegaOrigen.nombre}</td>
                      <td className="px-5 py-3">{tr.bodegaDestino.nombre}</td>
                      <td className="px-5 py-3">{new Date(tr.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3">
                        <Badge tono={tr.estado === 'CONFIRMADO' ? 'exito' : tr.estado === 'CANCELADO' ? 'peligro' : 'neutro'}>{tr.estado}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RowActionsMenu
                          acciones={[
                            { etiqueta: 'Ver detalle', onClick: () => setTransferenciaViendo(tr) },
                            ...(tr.estado === 'BORRADOR' && tienePermisoTransferir
                              ? [
                                  { etiqueta: 'Editar', onClick: () => setTransferenciaEditando(tr) },
                                  {
                                    etiqueta: 'Confirmar',
                                    onClick: () => cambiarEstadoTransferencia.mutate({ id: tr.id, estado: 'CONFIRMADO' }),
                                  },
                                  {
                                    etiqueta: 'Cancelar',
                                    tono: 'peligro' as const,
                                    onClick: () => {
                                      if (confirm(`¿Cancelar la transferencia ${tr.numero}?`))
                                        cambiarEstadoTransferencia.mutate({ id: tr.id, estado: 'CANCELADO' });
                                    },
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {transferencias && (
            <div className="px-5 py-3">
              <Paginacion
                pagina={transferencias.pagina}
                tamanoPagina={transferencias.tamanoPagina}
                total={transferencias.total}
                onCambiarPagina={setPaginaTransferencias}
              />
            </div>
          )}
        </Card>
      </RequierePermiso>
      )}

      {modalNuevaBodega && <ModalNuevaBodega onClose={() => setModalNuevaBodega(false)} />}
      {ajusteViendo && <ModalVerAjuste ajuste={ajusteViendo} onClose={() => setAjusteViendo(null)} />}
      {ajusteEditando && <ModalEditarAjuste ajuste={ajusteEditando} onClose={() => setAjusteEditando(null)} />}
      {ajusteConfirmando && <ModalConfirmarAjuste ajuste={ajusteConfirmando} onClose={() => setAjusteConfirmando(null)} />}
      {ajusteNuevo && <ModalNuevoAjuste bodegas={bodegas ?? []} onClose={() => setAjusteNuevo(false)} />}
      {transferenciaNueva && <ModalNuevaTransferencia bodegas={bodegas ?? []} onClose={() => setTransferenciaNueva(false)} />}
      {transferenciaViendo && <ModalVerTransferencia transferencia={transferenciaViendo} onClose={() => setTransferenciaViendo(null)} />}
      {transferenciaEditando && <ModalEditarTransferencia transferencia={transferenciaEditando} onClose={() => setTransferenciaEditando(null)} />}
      {bodegaEditando && <ModalEditarBodega bodega={bodegaEditando} onClose={() => setBodegaEditando(null)} />}
      {stockAjustando && bodegaSeleccionadaId && (
        <ModalAjustarStock
          bodegaId={bodegaSeleccionadaId}
          stockInicial={stockAjustando}
          onClose={() => setStockAjustando(null)}
        />
      )}
      {agregandoProducto && bodegaSeleccionadaId && (
        <ModalAgregarProductoStock bodegaId={bodegaSeleccionadaId} onClose={() => setAgregandoProducto(false)} />
      )}
      {stockTransfiriendo && bodegaSeleccionadaId && (
        <ModalTransferirStock
          bodegaOrigenId={bodegaSeleccionadaId}
          bodegas={bodegas ?? []}
          stockInicial={stockTransfiriendo}
          onClose={() => setStockTransfiriendo(null)}
        />
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

function ModalNuevaBodega({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => (await apiClient.get<{ id: string; nombre: string }[]>('/sucursales')).data,
  });

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/inventario/bodegas', { nombre, direccion: direccion || undefined, sucursalId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodegas'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la bodega.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva bodega" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="bodega-sucursal" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sucursal
          </label>
          <Select id="bodega-sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {sucursales?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </div>
        <FormField id="bodega-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <FormField id="bodega-direccion" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear bodega'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalEditarBodega({ bodega, onClose }: { bodega: Bodega; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(bodega.nombre);
  const [direccion, setDireccion] = useState(bodega.direccion ?? '');
  const [sucursalId, setSucursalId] = useState(bodega.sucursalId);
  const [activa, setActiva] = useState(bodega.activa);
  const [formatoImpresion, setFormatoImpresion] = useState(bodega.formatoImpresion ?? '');
  const [metodoAperturaCaja, setMetodoAperturaCaja] = useState(bodega.metodoAperturaCaja ?? '');
  const [error, setError] = useState<string | null>(null);

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => (await apiClient.get<{ id: string; nombre: string }[]>('/sucursales')).data,
  });

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/inventario/bodegas/${bodega.id}`, {
        nombre,
        direccion: direccion || undefined,
        sucursalId,
        activa,
        formatoImpresion: formatoImpresion || null,
        metodoAperturaCaja: metodoAperturaCaja || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodegas'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la bodega.')),
  });

  return (
    <Modal titulo={`Editar bodega — ${bodega.nombre}`} onClose={onClose}>
      <div className="space-y-3">
        <FormField id="editar-bodega-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <FormField id="editar-bodega-direccion" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <div className="flex flex-col gap-1">
          <label htmlFor="editar-bodega-sucursal" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sucursal
          </label>
          <Select id="editar-bodega-sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            {sucursales?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Formato de impresión</label>
          <Select value={formatoImpresion} onChange={(e) => setFormatoImpresion(e.target.value)}>
            <option value="">Usar el default de la empresa</option>
            {FORMATOS_IMPRESION.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Apertura de caja registradora</label>
          <Select value={metodoAperturaCaja} onChange={(e) => setMetodoAperturaCaja(e.target.value)}>
            <option value="">Usar el default de la empresa</option>
            {METODOS_APERTURA_CAJA.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
          Bodega activa
        </label>
        {!activa && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Inactivarla la saca de los selectores de bodega en toda la app (Facturación, Compras, POS, etc.) — no borra su stock ni su historial.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  );
}

function ModalAjustarStock({
  bodegaId,
  stockInicial,
  onClose,
}: {
  bodegaId: string;
  stockInicial: ProductoParaAjuste;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [cantidad, setCantidad] = useState('');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [motivo, setMotivo] = useState('');
  const [numeroLote, setNumeroLote] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [loteId, setLoteId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const controlaVencimiento = stockInicial.producto.controlaVencimiento;
  const esEntrada = Number(cantidad) > 0;

  // Ítem E-1 — ya no aplica el stock de una: crea un AjusteInventario en
  // BORRADOR con esta única línea (mismo formulario de siempre). El PIN de
  // Fase 9 se movió a "Confirmar" (nivel documento, no por línea) — ver
  // ModalConfirmarAjuste.
  const guardarBorrador = useMutation({
    mutationFn: async () =>
      apiClient.post('/ajustes-inventario', {
        bodegaId,
        lineas: [
          {
            productoId: stockInicial.producto.id,
            varianteId: stockInicial.varianteId,
            cantidad: Number(cantidad),
            motivoAjuste,
            motivo: motivo || undefined,
            ...(controlaVencimiento && esEntrada ? { numeroLote, fechaVencimiento } : {}),
            ...(controlaVencimiento && !esEntrada ? { loteId } : {}),
          },
        ],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ajustes-inventario'] });
      onClose();
    },
    onError: (err: unknown) => {
      const mensaje =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(mensaje ?? 'No se pudo guardar el ajuste. Revisa los datos.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardarBorrador.mutate();
  }

  return (
    <Modal titulo="Nuevo ajuste de inventario" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Producto</label>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            {stockInicial.producto.codigo} — {stockInicial.producto.nombre}
            {stockInicial.valoresAtributo.length > 0 &&
              ` (${stockInicial.valoresAtributo.map((va) => `${va.atributo}: ${va.valor}`).join(', ')})`}
          </p>
        </div>
        <FormField
          id="ajuste-cantidad"
          label="Cantidad (negativo para restar)"
          type="number"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          required
        />
        {controlaVencimiento && esEntrada && (
          <>
            <FormField id="ajuste-lote-numero" label="Número de lote" value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} required />
            <FormField
              id="ajuste-lote-vencimiento"
              label="Fecha de vencimiento"
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              required
            />
          </>
        )}
        {controlaVencimiento && cantidad !== '' && !esEntrada && (
          <SelectorLoteAjuste varianteId={stockInicial.varianteId} bodegaId={bodegaId} value={loteId} onChange={setLoteId} />
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="ajuste-motivo-tipo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Motivo
          </label>
          <Select id="ajuste-motivo-tipo" value={motivoAjuste} onChange={(e) => setMotivoAjuste(e.target.value)} required>
            <option value="" disabled>
              Seleccioná un motivo…
            </option>
            <option value="MERMA">Merma</option>
            <option value="ROBO_PERDIDA">Robo o pérdida</option>
            <option value="DANO">Daño</option>
            <option value="VENCIMIENTO">Vencimiento</option>
            <option value="CORRECCION_CONTEO">Corrección de conteo</option>
            <option value="OTRO">Otro</option>
          </Select>
        </div>
        <FormField id="ajuste-motivo" label="Detalle (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardarBorrador.isPending} className="w-full">
          {guardarBorrador.isPending ? 'Guardando…' : 'Guardar borrador'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalVerAjuste({ ajuste, onClose }: { ajuste: AjusteInventario; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['ajuste-inventario', ajuste.id],
    queryFn: async () => (await apiClient.get<AjusteInventarioDetalle>(`/ajustes-inventario/${ajuste.id}`)).data,
  });

  return (
    <Modal titulo={`Ajuste de inventario — ${ajuste.numero}`} onClose={onClose}>
      {!data ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
            <p>
              Bodega: <span className="font-medium">{data.bodega.nombre}</span>
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Fecha: {new Date(data.fecha).toLocaleDateString('es-DO')} — Estado: <Badge>{data.estado}</Badge>
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Cantidad</th>
                  <th className="px-3 py-2">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.lineas.map((linea, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      {linea.producto.codigo} — {linea.producto.nombre}
                    </td>
                    <td className="px-3 py-2">{Number(linea.cantidad)}</td>
                    <td className="px-3 py-2">{linea.motivo ?? linea.motivoAjuste}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Ítem E-1 — editar un ajuste en BORRADOR (la bodega no se puede cambiar, solo la cantidad/motivo de cada línea). */
function ModalEditarAjuste({ ajuste, onClose }: { ajuste: AjusteInventario; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [lineas, setLineas] = useState<{ productoId: string; cantidad: string; motivoAjuste: string; motivo: string; nombreProducto: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['ajuste-inventario', ajuste.id],
    queryFn: async () => (await apiClient.get<AjusteInventarioDetalle>(`/ajustes-inventario/${ajuste.id}`)).data,
  });

  useEffect(() => {
    if (detalle && lineas.length === 0) {
      setLineas(
        detalle.lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: String(l.cantidad),
          motivoAjuste: l.motivoAjuste,
          motivo: l.motivo ?? '',
          nombreProducto: `${l.producto.codigo} — ${l.producto.nombre}`,
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalle]);

  function actualizarLinea(i: number, cambios: Partial<(typeof lineas)[number]>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/ajustes-inventario/${ajuste.id}`, {
        lineas: lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: Number(l.cantidad),
          motivoAjuste: l.motivoAjuste,
          motivo: l.motivo || undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ajustes-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['ajuste-inventario', ajuste.id] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el ajuste. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <Modal titulo={`Editar ajuste — ${ajuste.numero}`} onClose={onClose}>
      {!detalle ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {lineas.map((linea, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{linea.nombreProducto}</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Cantidad"
                  value={linea.cantidad}
                  onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                  className="w-28 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <Select value={linea.motivoAjuste} onChange={(e) => actualizarLinea(i, { motivoAjuste: e.target.value })} required>
                  <option value="MERMA">Merma</option>
                  <option value="ROBO_PERDIDA">Robo o pérdida</option>
                  <option value="DANO">Daño</option>
                  <option value="VENCIMIENTO">Vencimiento</option>
                  <option value="CORRECCION_CONTEO">Corrección de conteo</option>
                  <option value="OTRO">Otro</option>
                </Select>
              </div>
              <FormField
                id={`ajuste-editar-motivo-${i}`}
                label="Detalle (opcional)"
                value={linea.motivo}
                onChange={(e) => actualizarLinea(i, { motivo: e.target.value })}
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </form>
      )}
    </Modal>
  );
}

/** Ítem E-1 — Confirmar dispara el movimiento real de stock; pide PIN (Fase 9) solo si alguna línea es una salida (cantidad negativa). */
function ModalConfirmarAjuste({ ajuste, onClose }: { ajuste: AjusteInventario; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['ajuste-inventario', ajuste.id],
    queryFn: async () => (await apiClient.get<AjusteInventarioDetalle>(`/ajustes-inventario/${ajuste.id}`)).data,
  });

  const tieneSalida = detalle?.lineas.some((l) => Number(l.cantidad) < 0) ?? false;

  const confirmar = useMutation({
    mutationFn: async () => apiClient.patch(`/ajustes-inventario/${ajuste.id}/estado`, { estado: 'CONFIRMADO', pin: pin || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ajustes-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      onClose();
    },
    onError: (err: unknown) => {
      const mensaje =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(mensaje ?? 'No se pudo confirmar el ajuste.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    confirmar.mutate();
  }

  return (
    <Modal titulo={`Confirmar ajuste — ${ajuste.numero}`} onClose={onClose}>
      {!detalle ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Al confirmar, este ajuste se aplica de verdad al stock de {detalle.bodega.nombre} — ya no se podrá editar.
          </p>
          {tieneSalida && <CampoPin value={pin} onChange={setPin} id="ajuste-confirmar-pin" />}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={confirmar.isPending} className="w-full">
            {confirmar.isPending ? 'Confirmando…' : 'Confirmar ajuste'}
          </Button>
        </form>
      )}
    </Modal>
  );
}

function ModalVerTransferencia({ transferencia, onClose }: { transferencia: TransferenciaInventario; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['transferencia-inventario', transferencia.id],
    queryFn: async () => (await apiClient.get<TransferenciaInventarioDetalle>(`/transferencias-inventario/${transferencia.id}`)).data,
  });

  return (
    <Modal titulo={`Transferencia de inventario — ${transferencia.numero}`} onClose={onClose}>
      {!data ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
            <p>
              De <span className="font-medium">{data.bodegaOrigen.nombre}</span> a{' '}
              <span className="font-medium">{data.bodegaDestino.nombre}</span>
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Fecha: {new Date(data.fecha).toLocaleDateString('es-DO')} — Estado: <Badge>{data.estado}</Badge>
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.lineas.map((linea, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      {linea.producto.codigo} — {linea.producto.nombre}
                    </td>
                    <td className="px-3 py-2">{Number(linea.cantidad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Ítem E-1 — editar una transferencia en BORRADOR (las bodegas no se pueden cambiar, solo la cantidad de cada línea). */
function ModalEditarTransferencia({ transferencia, onClose }: { transferencia: TransferenciaInventario; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [lineas, setLineas] = useState<{ productoId: string; cantidad: string; nombreProducto: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['transferencia-inventario', transferencia.id],
    queryFn: async () => (await apiClient.get<TransferenciaInventarioDetalle>(`/transferencias-inventario/${transferencia.id}`)).data,
  });

  useEffect(() => {
    if (detalle && lineas.length === 0) {
      setLineas(
        detalle.lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: String(l.cantidad),
          nombreProducto: `${l.producto.codigo} — ${l.producto.nombre}`,
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalle]);

  function actualizarLinea(i: number, cambios: Partial<(typeof lineas)[number]>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/transferencias-inventario/${transferencia.id}`, {
        lineas: lineas.map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['transferencia-inventario', transferencia.id] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la transferencia. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <Modal titulo={`Editar transferencia — ${transferencia.numero}`} onClose={onClose}>
      {!detalle ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {lineas.map((linea, i) => (
            <div key={i} className="flex items-center gap-2">
              <p className="flex-1 text-sm text-slate-700 dark:text-slate-300">{linea.nombreProducto}</p>
              <input
                type="number"
                min={1}
                placeholder="Cantidad"
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </form>
      )}
    </Modal>
  );
}

/**
 * "Ajustar stock" (de la fila) solo sirve para un producto/variante que YA
 * tiene una fila de `Stock` en esta bodega — una bodega recién creada (o un
 * producto que nunca se cargó acá) no tiene ninguna fila para hacerle clic,
 * así que no había forma de arrancar. Este modal elige producto (y variante,
 * si tiene más de una — mismo `SelectorLineaProducto` que usan Facturación/
 * Cotizaciones/Remisiones/Compras) y después reusa el formulario de
 * `ModalAjustarStock` tal cual — `ajustarStock` en el backend ya hace upsert
 * sobre `Stock` (crea la fila si no existía), no hacía falta tocar nada ahí.
 */
function ModalAgregarProductoStock({ bodegaId, onClose }: { bodegaId: string; onClose: () => void }) {
  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const [productoId, setProductoId] = useState('');
  const [varianteId, setVarianteId] = useState('');
  const { data: variantes } = useVariantesProducto(productoId || undefined);

  const productoElegido = productos?.find((p) => p.id === productoId);
  const varianteElegida = variantes?.find((v) => v.id === varianteId);

  if (!productoElegido || !varianteId) {
    return (
      <Modal titulo="Agregar producto a esta bodega" onClose={onClose}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Elegí el producto (y su variante, si tiene más de una) para cargarle su stock inicial en esta bodega.
          </p>
          <SelectorLineaProducto
            productos={productos ?? []}
            productoId={productoId}
            varianteId={varianteId}
            onChange={(p, v) => {
              setProductoId(p);
              setVarianteId(v);
            }}
          />
        </div>
      </Modal>
    );
  }

  return (
    <ModalAjustarStock
      bodegaId={bodegaId}
      stockInicial={{
        producto: productoElegido,
        varianteId,
        valoresAtributo:
          varianteElegida?.valoresAtributo.map((va) => ({ atributo: va.valorAtributo.atributo.nombre, valor: va.valorAtributo.valor })) ?? [],
      }}
      onClose={onClose}
    />
  );
}

/** Fase 5b — de qué lote sale un ajuste manual negativo (siempre a mano, nunca FEFO: una corrección apunta a un lote puntual). */
function SelectorLoteAjuste({
  varianteId,
  bodegaId,
  value,
  onChange,
}: {
  varianteId: string;
  bodegaId: string;
  value: string;
  onChange: (loteId: string) => void;
}) {
  const { data: lotes } = useQuery({
    queryKey: ['inventario-lotes', varianteId, bodegaId],
    queryFn: async () => (await apiClient.get<Lote[]>('/inventario/lotes', { params: { varianteId, bodegaId } })).data,
  });

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">De qué lote sale</label>
      <Select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">Seleccionar…</option>
        {lotes?.map((l) => (
          <option key={l.id} value={l.id}>
            {l.numeroLote} — vence {new Date(l.fechaVencimiento).toLocaleDateString('es-DO', { timeZone: 'UTC' })} — saldo {Number(l.cantidadActual)}
          </option>
        ))}
      </Select>
    </div>
  );
}

function ModalTransferirStock({
  bodegaOrigenId,
  bodegas,
  stockInicial,
  onClose,
}: {
  bodegaOrigenId: string;
  bodegas: Bodega[];
  stockInicial: ProductoParaAjuste;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [bodegaDestinoId, setBodegaDestinoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Ítem E-1 — ya no mueve el stock de una: crea una TransferenciaInventario
  // en BORRADOR con esta única línea (mismo formulario de siempre).
  const guardarBorrador = useMutation({
    mutationFn: async () =>
      apiClient.post('/transferencias-inventario', {
        bodegaOrigenId,
        bodegaDestinoId,
        lineas: [{ productoId: stockInicial.producto.id, varianteId: stockInicial.varianteId, cantidad: Number(cantidad) }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias-inventario'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la transferencia. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardarBorrador.mutate();
  }

  return (
    <Modal titulo="Nueva transferencia de inventario" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Producto</label>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            {stockInicial.producto.codigo} — {stockInicial.producto.nombre}
            {stockInicial.valoresAtributo.length > 0 &&
              ` (${stockInicial.valoresAtributo.map((va) => `${va.atributo}: ${va.valor}`).join(', ')})`}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega destino</label>
          <Select value={bodegaDestinoId} onChange={(e) => setBodegaDestinoId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {bodegas.filter((b) => b.id !== bodegaOrigenId).map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </Select>
        </div>
        <FormField id="transferir-cantidad" label="Cantidad" type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardarBorrador.isPending} className="w-full">
          {guardarBorrador.isPending ? 'Guardando…' : 'Guardar borrador'}
        </Button>
      </form>
    </Modal>
  );
}

/**
 * "Nuevo ajuste" desde el propio tab Ajustes (sin pasar por Stock) — antes
 * solo se podía arrancar un ajuste desde el ⋮ de una fila del tab Stock, lo
 * cual dejaba a los tabs Ajustes/Transferencias sin ninguna forma de crear
 * un documento nuevo. Mismo patrón que `ModalAgregarProductoStock`, con un
 * paso más: acá también hay que elegir la bodega (Agregar producto ya vive
 * dentro del contexto de una bodega seleccionada, este modal no).
 */
function ModalNuevoAjuste({ bodegas, onClose }: { bodegas: Bodega[]; onClose: () => void }) {
  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const [bodegaId, setBodegaId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [varianteId, setVarianteId] = useState('');
  const { data: variantes } = useVariantesProducto(productoId || undefined);

  const productoElegido = productos?.find((p) => p.id === productoId);
  const varianteElegida = variantes?.find((v) => v.id === varianteId);

  if (!bodegaId || !productoElegido || !varianteId) {
    return (
      <Modal titulo="Nuevo ajuste de inventario" onClose={onClose}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">Elegí la bodega y el producto (y su variante, si tiene más de una) a ajustar.</p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega</label>
            <Select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)} required>
              <option value="">Seleccionar…</option>
              {bodegas
                .filter((b) => b.activa)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
            </Select>
          </div>
          {bodegaId && (
            <SelectorLineaProducto
              productos={productos ?? []}
              productoId={productoId}
              varianteId={varianteId}
              onChange={(p, v) => {
                setProductoId(p);
                setVarianteId(v);
              }}
            />
          )}
        </div>
      </Modal>
    );
  }

  return (
    <ModalAjustarStock
      bodegaId={bodegaId}
      stockInicial={{
        producto: productoElegido,
        varianteId,
        valoresAtributo:
          varianteElegida?.valoresAtributo.map((va) => ({ atributo: va.valorAtributo.atributo.nombre, valor: va.valorAtributo.valor })) ?? [],
      }}
      onClose={onClose}
    />
  );
}

/** "Nueva transferencia" desde el propio tab Transferencias — mismo criterio que `ModalNuevoAjuste`: elige bodega origen + producto acá, y reusa `ModalTransferirStock` (que ya resuelve bodega destino + cantidad) tal cual. */
function ModalNuevaTransferencia({ bodegas, onClose }: { bodegas: Bodega[]; onClose: () => void }) {
  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const [bodegaOrigenId, setBodegaOrigenId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [varianteId, setVarianteId] = useState('');
  const { data: variantes } = useVariantesProducto(productoId || undefined);

  const productoElegido = productos?.find((p) => p.id === productoId);
  const varianteElegida = variantes?.find((v) => v.id === varianteId);

  if (!bodegaOrigenId || !productoElegido || !varianteId) {
    return (
      <Modal titulo="Nueva transferencia de inventario" onClose={onClose}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">Elegí la bodega de origen y el producto (y su variante, si tiene más de una) a transferir.</p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega origen</label>
            <Select value={bodegaOrigenId} onChange={(e) => setBodegaOrigenId(e.target.value)} required>
              <option value="">Seleccionar…</option>
              {bodegas
                .filter((b) => b.activa)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
            </Select>
          </div>
          {bodegaOrigenId && (
            <SelectorLineaProducto
              productos={productos ?? []}
              productoId={productoId}
              varianteId={varianteId}
              onChange={(p, v) => {
                setProductoId(p);
                setVarianteId(v);
              }}
            />
          )}
        </div>
      </Modal>
    );
  }

  return (
    <ModalTransferirStock
      bodegaOrigenId={bodegaOrigenId}
      bodegas={bodegas}
      stockInicial={{
        producto: productoElegido,
        varianteId,
        valoresAtributo:
          varianteElegida?.valoresAtributo.map((va) => ({ atributo: va.valorAtributo.atributo.nombre, valor: va.valorAtributo.valor })) ?? [],
      }}
      onClose={onClose}
    />
  );
}
