import { Fragment, FormEvent, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Button } from '../components/atoms/Button/Button';
import { SelectorLineaProducto } from '../components/molecules/SelectorLineaProducto/SelectorLineaProducto';
import { SelectorLoteAjuste } from '../components/molecules/SelectorLoteAjuste/SelectorLoteAjuste';
import { PaginaResultado } from '../types/pagina-resultado';
import { useHayCambios } from '../hooks/useHayCambios';
import type { Bodega, Producto } from '../components/organisms/StockBodegasPanel/StockBodegasPanel';

interface LineaForm {
  productoId: string;
  varianteId: string;
  cantidad: string;
  numeroLote: string;
  fechaVencimiento: string;
  loteId: string;
}

const LINEA_VACIA: LineaForm = {
  productoId: '',
  varianteId: '',
  cantidad: '',
  numeroLote: '',
  fechaVencimiento: '',
  loteId: '',
};

/**
 * Auditoría UX Fase 2 — reemplaza a `ModalNuevoAjuste`+`ModalAjustarStock`
 * (modal, un solo producto por ajuste) con una página real de varias
 * líneas: "modelo B" de la exploración "modal o página" (ver
 * PaginaDocumento), mismo criterio que FacturacionNueva/RemisionNueva. El
 * backend (`CrearAjusteInventarioDto.lineas`) ya soportaba varias líneas
 * desde siempre — el límite de "un producto por ajuste" era solo de esta
 * UI, nunca del modelo de datos.
 *
 * Pedido explícito del usuario (2026-11-11) — Motivo/Detalle pasan de ser
 * un campo por línea a uno solo de cabecera, aplicado a todas las líneas
 * al guardar: con varios productos por ajuste, repetir el mismo motivo en
 * cada línea ocupaba demasiado espacio, y en la práctica un ajuste se
 * agrupa por un solo motivo (el lote de "rotos de hoy", la corrección de
 * un conteo puntual). Mezclar motivos distintos en un mismo ajuste sigue
 * siendo posible — solo que como dos ajustes separados. El backend
 * (`motivoAjuste`/`motivo` siguen siendo por línea en el schema) no
 * cambió: esta página simplemente manda el mismo valor en cada línea.
 *
 * Mismo pedido — producto y cantidad pasan de dos filas apiladas a una
 * tabla (producto | cantidad | quitar), igual criterio que
 * InventarioTransferenciaNueva (que ya usaba este layout). Los campos de
 * lote, cuando el producto los necesita, van en una fila propia debajo —
 * no entran en una sola línea de tabla sin amontonarse.
 */
export function InventarioAjusteNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bodegaId, setBodegaId] = useState('');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [motivo, setMotivo] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([LINEA_VACIA]);
  const [error, setError] = useState<string | null>(null);

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-select'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });
  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  function actualizarLinea(i: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const lineasValidas = lineas.filter((l) => l.productoId && l.cantidad !== '');

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/ajustes-inventario', {
        bodegaId,
        lineas: lineasValidas.map((l) => {
          const producto = productos?.find((p) => p.id === l.productoId);
          const esEntrada = Number(l.cantidad) > 0;
          return {
            productoId: l.productoId,
            varianteId: l.varianteId || undefined,
            cantidad: Number(l.cantidad),
            motivoAjuste,
            motivo: motivo || undefined,
            ...(producto?.controlaVencimiento && esEntrada ? { numeroLote: l.numeroLote, fechaVencimiento: l.fechaVencimiento } : {}),
            ...(producto?.controlaVencimiento && !esEntrada ? { loteId: l.loteId } : {}),
          };
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ajustes-inventario'] });
      confirmarGuardado();
      setTimeout(() => navigate('/inventario/ajustes'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el ajuste. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!bodegaId) {
      setError('Elegí una bodega.');
      return;
    }
    if (!motivoAjuste) {
      setError('Elegí el motivo del ajuste.');
      return;
    }
    if (lineasValidas.length === 0) {
      setError('Agregá al menos una línea con producto y cantidad.');
      return;
    }
    crear.mutate();
  }

  const bodegaSeleccionada = (bodegas ?? []).find((b) => b.id === bodegaId);
  const [haycambios, confirmarGuardado] = useHayCambios({ bodegaId, motivoAjuste, motivo, lineas });

  return (
    <PaginaDocumento
      titulo="Nuevo ajuste de inventario"
      rutaVolver="/inventario/ajustes"
      etiquetaVolver="Volver a Ajustes"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Bodega</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{bodegaSeleccionada?.nombre ?? 'Sin seleccionar'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Líneas</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lineasValidas.length} {lineasValidas.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nuevo-ajuste" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Guardando…' : 'Guardar borrador'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/inventario/ajustes')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nuevo-ajuste" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Información del ajuste" descripcion="Un solo motivo/detalle para todas las líneas — si necesitás mezclar motivos, hacelo como dos ajustes separados.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega</label>
              <Select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {(bodegas ?? [])
                  .filter((b) => b.activa)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Motivo</label>
              <Select value={motivoAjuste} onChange={(e) => setMotivoAjuste(e.target.value)} required>
                <option value="" disabled>
                  Motivo…
                </option>
                <option value="MERMA">Merma</option>
                <option value="ROBO_PERDIDA">Robo o pérdida</option>
                <option value="DANO">Daño</option>
                <option value="VENCIMIENTO">Vencimiento</option>
                <option value="CORRECCION_CONTEO">Corrección de conteo</option>
                <option value="OTRO">Otro</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Detalle (opcional)</label>
              <input
                placeholder="Ej. Conteo del 11/11, pasillo 3…"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </Card>

        <Card titulo="Líneas" descripcion='Agregá uno o más productos — cantidad positiva para entrada, negativa para salida.'>
          {!bodegaId ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Elegí una bodega arriba para empezar a agregar líneas.</p>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="w-40 px-3 py-2 font-medium">Cantidad</th>
                      <th className="w-px px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lineas.map((linea, i) => {
                      const producto = productos?.find((p) => p.id === linea.productoId);
                      const esEntrada = Number(linea.cantidad) > 0;
                      const necesitaLote = !!producto?.controlaVencimiento;
                      return (
                        <Fragment key={i}>
                          <tr>
                            <td className="px-3 py-2 align-top">
                              <SelectorLineaProducto
                                productos={productos ?? []}
                                productoId={linea.productoId}
                                varianteId={linea.varianteId}
                                onChange={(productoId, varianteId) => actualizarLinea(i, { productoId, varianteId })}
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="number"
                                placeholder="Cant. (neg. para restar)"
                                value={linea.cantidad}
                                onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              {lineas.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                                  className="text-red-600 hover:text-red-700"
                                  aria-label="Quitar línea"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                          {necesitaLote && esEntrada && (
                            <tr>
                              <td colSpan={3} className="px-3 pb-2">
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <input
                                    placeholder="Número de lote"
                                    value={linea.numeroLote}
                                    onChange={(e) => actualizarLinea(i, { numeroLote: e.target.value })}
                                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                  <input
                                    type="date"
                                    value={linea.fechaVencimiento}
                                    onChange={(e) => actualizarLinea(i, { fechaVencimiento: e.target.value })}
                                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                          {necesitaLote && linea.cantidad !== '' && !esEntrada && (
                            <tr>
                              <td colSpan={3} className="px-3 pb-2">
                                <SelectorLoteAjuste
                                  varianteId={linea.varianteId}
                                  bodegaId={bodegaId}
                                  value={linea.loteId}
                                  onChange={(loteId) => actualizarLinea(i, { loteId })}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setLineas((prev) => [...prev, LINEA_VACIA])}
                className="flex items-center gap-1 text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
              >
                <Plus size={15} /> Agregar línea
              </button>
            </div>
          )}
        </Card>
      </form>
    </PaginaDocumento>
  );
}
