import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../RequierePermiso/RequierePermiso';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { KardexView } from '../KardexView/KardexView';
import { VencimientosPanel } from '../VencimientosPanel/VencimientosPanel';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { SelectorLoteAjuste } from '../../molecules/SelectorLoteAjuste/SelectorLoteAjuste';
import { useAuth } from '../../../hooks/useAuth';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useVariantesProducto } from '../../../hooks/useVariantesProducto';
import { SelectorLineaProducto } from '../../molecules/SelectorLineaProducto/SelectorLineaProducto';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { FORMATOS_IMPRESION } from '../../../constants/formato-impresion';
import { PLANTILLAS_DOCUMENTO } from '../../../constants/plantilla-documento';
import { METODOS_APERTURA_CAJA } from '../../../constants/metodo-apertura-caja';
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

/** Lo mínimo que necesita ModalAjustarStock — un `Stock` ya existente lo cumple tal cual, pero también permite construirlo "a mano" para un producto/variante que todavía no tiene fila de Stock en esta bodega (ver ModalAgregarProductoStock). */
interface ProductoParaAjuste {
  producto: Producto;
  varianteId: string;
  valoresAtributo: { atributo: string; valor: string }[];
}

/**
 * Auditoría UX Fase 2 — extraído de Inventario.tsx (antes un solo archivo de
 * 1498 líneas con 3 tabs sin URL propia). Esta pieza es la pestaña "Stock":
 * bodegas + existencias, con el ajuste/transferencia RÁPIDOS de una sola
 * línea (acción puntual sobre una fila ya visible en pantalla — el ajuste/
 * transferencia MULTI-línea vive en su propia página, ver
 * InventarioAjusteNuevo/InventarioTransferenciaNueva).
 */
export function StockBodegasPanel() {
  const { tienePermiso } = useAuth();
  const tienePermisoAjustar = tienePermiso('inventario.ajustar');
  const tienePermisoTransferir = tienePermiso('inventario.transferir');
  const tienePermisoAdmin = tienePermiso('admin.configuracion');
  const [searchParams, setSearchParams] = useSearchParams();
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

  const bodegaSeleccionada = bodegas?.find((b) => b.id === bodegaSeleccionadaId) ?? null;

  function seleccionarBodega(id: string) {
    setBodegaSeleccionadaId(id);
    setPaginaStock(1);
    setBusquedaStock('');
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
          <Button onClick={() => setModalNuevaBodega(true)}>Nueva bodega</Button>
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
                  {' · '}
                  {PLANTILLAS_DOCUMENTO.find((p) => p.value === bodega.plantillaDocumento)?.label ?? 'Diseño de la empresa'}
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

      {modalNuevaBodega && <ModalNuevaBodega onClose={() => setModalNuevaBodega(false)} />}
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
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
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
  const [plantillaDocumento, setPlantillaDocumento] = useState(bodega.plantillaDocumento ?? '');
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
        plantillaDocumento: plantillaDocumento || null,
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
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Diseño del documento</label>
          <Select value={plantillaDocumento} onChange={(e) => setPlantillaDocumento(e.target.value)}>
            <option value="">Usar el default de la empresa</option>
            {PLANTILLAS_DOCUMENTO.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
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
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  );
}

/** Acción rápida sobre una fila de Stock YA visible — queda como modal (1 línea) a propósito, ver criterio modal-vs-página de la auditoría UX. El ajuste de VARIOS productos a la vez vive en InventarioAjusteNuevo (página). */
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
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el ajuste. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardarBorrador.mutate();
  }

  return (
    <Modal titulo="Ajustar stock" onClose={onClose}>
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
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={guardarBorrador.isPending} className="w-full">
          {guardarBorrador.isPending ? 'Guardando…' : 'Guardar borrador'}
        </Button>
      </form>
    </Modal>
  );
}

/**
 * "Ajustar stock" (de la fila) solo sirve para un producto/variante que YA
 * tiene una fila de `Stock` en esta bodega — una bodega recién creada (o un
 * producto que nunca se cargó acá) no tiene ninguna fila para hacerle clic,
 * así que no había forma de arrancar. Este modal elige producto (y variante,
 * si tiene más de una) y después reusa el formulario de `ModalAjustarStock`
 * tal cual — `ajustarStock` en el backend ya hace upsert sobre `Stock`.
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

/** Acción rápida sobre una fila de Stock YA visible — mismo criterio que ModalAjustarStock: 1 línea, modal, a propósito. */
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
    <Modal titulo="Transferir stock" onClose={onClose}>
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
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={guardarBorrador.isPending} className="w-full">
          {guardarBorrador.isPending ? 'Guardando…' : 'Guardar borrador'}
        </Button>
      </form>
    </Modal>
  );
}
