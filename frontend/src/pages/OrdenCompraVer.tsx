import { FormEvent, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { ConfirmModal } from '../components/molecules/ConfirmModal/ConfirmModal';
import { ModalImprimir } from '../components/molecules/ModalImprimir/ModalImprimir';
import { ModalRegistrarPagoOrdenCompra } from '../components/molecules/ModalRegistrarPagoOrdenCompra/ModalRegistrarPagoOrdenCompra';
import { SelectorLineaProducto } from '../components/molecules/SelectorLineaProducto/SelectorLineaProducto';
import { SelectorUnidadLinea } from '../components/molecules/SelectorUnidadLinea/SelectorUnidadLinea';
import { useAuth } from '../hooks/useAuth';
import { useHayCambios } from '../hooks/useHayCambios';
import { PaginaResultado } from '../types/pagina-resultado';

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  controlaVencimiento: boolean;
}

interface LineaOcDetalle {
  productoId: string;
  varianteId: string;
  cantidad: string;
  cantidadRecibida: string;
  costoUnitario: string;
  unidadMedida: { id: string; nombre: string } | null;
  producto: Producto;
}

interface RecepcionDetalle {
  id: string;
  fecha: string;
  facturaProveedorNumero: string | null;
  montoFacturaProveedor: string | null;
}

interface OrdenCompraDetalle {
  id: string;
  numero: string;
  estado: string;
  fecha: string;
  total: string;
  pagada: boolean;
  proveedor: { id: string; nombre: string };
  lineas: LineaOcDetalle[];
  recepciones: RecepcionDetalle[];
}

interface LineaForm {
  productoId: string;
  varianteId: string;
  unidadMedidaId: string;
  cantidad: string;
  costoUnitario: string;
}

// Mismos guards que ya usaba Compras.tsx (ver su comentario sobre el
// enum EstadoOrdenCompra real del backend).
const ESTADOS_RECIBIBLES = ['BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL'];
const ESTADOS_CON_MERCANCIA_RECIBIDA = ['RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL'];
const ESTADOS_CANCELABLES = ['BORRADOR', 'ENVIADA'];

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * ModalVerOrden + ModalEditarOrdenCompra de Compras.tsx. "Editar" es un
 * toggle inline (mismo criterio que LeadVer), solo disponible en BORRADOR.
 * Recibir/Devolver pasan a sus propias páginas (OrdenCompraRecibir/
 * OrdenCompraDevolver) — formularios demasiado grandes para un modal.
 * Registrar pago/Imprimir/Cancelar quedan en modal (fuera del alcance de
 * la auditoría — son acciones puntuales, no pantallas de gestión).
 */
export function OrdenCompraVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();

  const { data: orden } = useQuery({
    queryKey: ['orden-compra', id],
    queryFn: async () => (await apiClient.get<OrdenCompraDetalle>(`/compras/${id}`)).data,
  });
  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  const [editando, setEditando] = useState(false);
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [cargado, setCargado] = useState(false);
  const [mostrandoPago, setMostrandoPago] = useState(false);
  const [mostrandoImprimir, setMostrandoImprimir] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orden && !cargado) {
      setLineas(
        orden.lineas.map((l) => ({
          productoId: l.productoId,
          varianteId: l.varianteId,
          unidadMedidaId: l.unidadMedida?.id ?? '',
          cantidad: String(l.cantidad),
          costoUnitario: String(l.costoUnitario),
        })),
      );
      setCargado(true);
    }
  }, [orden, cargado]);

  function actualizarLinea(i: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const lineasValidas = lineas.filter((l) => l.productoId);
  const totalEditado = lineasValidas.reduce((acc, l) => acc + Number(l.cantidad || 0) * Number(l.costoUnitario || 0), 0);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/compras/${id}`, {
        lineas: lineasValidas.map((l) => ({
          productoId: l.productoId,
          varianteId: l.varianteId || undefined,
          unidadMedidaId: l.unidadMedidaId || undefined,
          cantidad: Number(l.cantidad),
          costoUnitario: Number(l.costoUnitario),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['orden-compra', id] });
      confirmarGuardado();
      setEditando(false);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la orden de compra. Revisa los datos.')),
  });

  const cambiarEstado = useMutation({
    mutationFn: async (estado: 'ENVIADA' | 'CANCELADA') => apiClient.patch(`/compras/${id}/estado`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['orden-compra', id] });
      setCancelando(false);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el estado de la orden.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineasValidas.length === 0) {
      setError('Agregá al menos una línea con producto.');
      return;
    }
    guardar.mutate();
  }

  const [hayCambiosForm, confirmarGuardado] = useHayCambios(lineas, cargado);
  const haycambios = editando && hayCambiosForm;
  const puedeEditar = orden?.estado === 'BORRADOR' && tienePermiso('compras.editar');

  return (
    <PaginaDocumento
      titulo={orden ? `Orden de compra — ${orden.numero}` : 'Orden de compra'}
      rutaVolver="/compras"
      etiquetaVolver="Volver a Compras"
      haycambios={haycambios}
      resumen={
        orden ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Proveedor</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{orden.proveedor?.nombre}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
              <div className="flex items-center gap-2">
                <Badge>{orden.estado}</Badge>
                <span className="text-xs text-slate-400">{orden.pagada ? 'pagada' : 'pendiente de pago'}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Fecha</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{new Date(orden.fecha).toLocaleDateString('es-DO')}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                RD$ {Number(editando ? totalEditado : orden.total).toLocaleString('es-DO')}
              </span>
            </div>
          </>
        ) : null
      }
      acciones={
        editando ? (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" form="form-orden-compra" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </>
        ) : orden ? (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {puedeEditar && (
              <Button type="button" className="w-full" onClick={() => setEditando(true)}>
                Editar
              </Button>
            )}
            {orden.estado === 'BORRADOR' && tienePermiso('compras.editar') && (
              <Button type="button" variante="secundario" className="w-full" disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate('ENVIADA')}>
                Confirmar
              </Button>
            )}
            {ESTADOS_RECIBIBLES.includes(orden.estado) && tienePermiso('compras.recibir') && (
              <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/compras/${id}/recibir`)}>
                Recibir
              </Button>
            )}
            {orden.estado !== 'CANCELADA' && !orden.pagada && tienePermiso('compras.pagar') && (
              <Button type="button" variante="secundario" className="w-full" onClick={() => setMostrandoPago(true)}>
                Registrar pago
              </Button>
            )}
            {ESTADOS_CON_MERCANCIA_RECIBIDA.includes(orden.estado) && tienePermiso('compras.recibir') && (
              <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/compras/${id}/devolver`)}>
                Devolver a proveedor
              </Button>
            )}
            <Button type="button" variante="secundario" className="w-full" onClick={() => setMostrandoImprimir(true)}>
              Imprimir
            </Button>
            {ESTADOS_CANCELABLES.includes(orden.estado) && tienePermiso('compras.editar') && (
              <Button type="button" variante="peligro" className="w-full" onClick={() => setCancelando(true)}>
                Cancelar orden
              </Button>
            )}
            <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/compras')}>
              Volver
            </Button>
          </>
        ) : null
      }
    >
      {!orden ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : editando ? (
        <form id="form-orden-compra" onSubmit={onSubmit} className="space-y-3">
          <Card titulo="Líneas">
            <div className="sm:col-span-2 space-y-2">
              {lineas.map((linea, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <SelectorLineaProducto
                    productos={productos ?? []}
                    productoId={linea.productoId}
                    varianteId={linea.varianteId}
                    onChange={(productoId, varianteId) => actualizarLinea(i, { productoId, varianteId, unidadMedidaId: '' })}
                    className="flex-1"
                  />
                  <SelectorUnidadLinea
                    productoId={linea.productoId}
                    value={linea.unidadMedidaId}
                    onChange={(unidadMedidaId) => actualizarLinea(i, { unidadMedidaId })}
                    className="w-32"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="Cant."
                    value={linea.cantidad}
                    onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                    className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Costo"
                    value={linea.costoUnitario}
                    onChange={(e) => actualizarLinea(i, { costoUnitario: e.target.value })}
                    className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  {lineas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      aria-label="Quitar línea"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLineas((prev) => [...prev, { productoId: '', varianteId: '', unidadMedidaId: '', cantidad: '1', costoUnitario: '' }])}
                className="flex items-center gap-1 text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
              >
                <Plus size={15} /> Agregar línea
              </button>
            </div>
          </Card>
        </form>
      ) : (
        <div className="space-y-4">
          <Card titulo="Líneas">
            <div className="sm:col-span-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Pedido</th>
                    <th className="px-3 py-2">Recibido</th>
                    <th className="px-3 py-2">Costo unit.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orden.lineas.map((linea) => (
                    <tr key={linea.productoId}>
                      <td className="px-3 py-2">
                        {linea.producto.codigo} — {linea.producto.nombre}
                      </td>
                      <td className="px-3 py-2">
                        {Number(linea.cantidad)} {linea.unidadMedida?.nombre ?? ''}
                      </td>
                      <td className="px-3 py-2">
                        {Number(linea.cantidadRecibida)} {linea.unidadMedida?.nombre ?? ''}
                      </td>
                      <td className="px-3 py-2">
                        RD$ {Number(linea.costoUnitario).toLocaleString('es-DO')}
                        {linea.unidadMedida ? ` / ${linea.unidadMedida.nombre}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {orden.recepciones.length > 0 && (
            <Card titulo="Recepciones">
              <div className="sm:col-span-2 space-y-1">
                {orden.recepciones.map((r) => (
                  <p key={r.id} className="text-sm text-slate-600 dark:text-slate-400">
                    {new Date(r.fecha).toLocaleDateString('es-DO')}
                    {r.facturaProveedorNumero && ` — Factura del proveedor: ${r.facturaProveedorNumero}`}
                    {r.montoFacturaProveedor && ` (RD$ ${Number(r.montoFacturaProveedor).toLocaleString('es-DO')})`}
                  </p>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {mostrandoPago && orden && <ModalRegistrarPagoOrdenCompra orden={orden} onClose={() => setMostrandoPago(false)} />}
      {mostrandoImprimir && orden && (
        <ModalImprimir urlBase={`/compras/${orden.id}`} titulo={`Imprimir — ${orden.numero}`} onClose={() => setMostrandoImprimir(false)} />
      )}
      {cancelando && orden && (
        <ConfirmModal
          titulo="¿Cancelar esta orden de compra?"
          descripcion={
            <>
              Se cancelará la orden <b>{orden.numero}</b> a <b>{orden.proveedor.nombre}</b>.
            </>
          }
          confirmarTexto="Cancelar orden"
          confirmando={cambiarEstado.isPending}
          onConfirmar={() => cambiarEstado.mutate('CANCELADA')}
          onCancelar={() => setCancelando(false)}
        />
      )}
    </PaginaDocumento>
  );
}
