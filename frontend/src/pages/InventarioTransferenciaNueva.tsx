import { FormEvent, useState } from 'react';
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
import { PaginaResultado } from '../types/pagina-resultado';
import { useHayCambios } from '../hooks/useHayCambios';
import type { Bodega, Producto } from '../components/organisms/StockBodegasPanel/StockBodegasPanel';

interface LineaForm {
  productoId: string;
  varianteId: string;
  cantidad: string;
}

const LINEA_VACIA: LineaForm = { productoId: '', varianteId: '', cantidad: '' };

/**
 * Auditoría UX Fase 2 — reemplaza a `ModalNuevaTransferencia`+
 * `ModalTransferirStock` (modal, un solo producto) con una página de varias
 * líneas, mismo criterio que InventarioAjusteNuevo. El backend
 * (`CrearTransferenciaInventarioDto.lineas`) ya soportaba varias líneas —
 * sin lotes acá: `transferirStock` resuelve FEFO internamente.
 */
export function InventarioTransferenciaNueva() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bodegaOrigenId, setBodegaOrigenId] = useState('');
  const [bodegaDestinoId, setBodegaDestinoId] = useState('');
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
      apiClient.post('/transferencias-inventario', {
        bodegaOrigenId,
        bodegaDestinoId,
        lineas: lineasValidas.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId || undefined, cantidad: Number(l.cantidad) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias-inventario'] });
      confirmarGuardado();
      setTimeout(() => navigate('/inventario/transferencias'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la transferencia. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!bodegaOrigenId || !bodegaDestinoId) {
      setError('Elegí la bodega de origen y la de destino.');
      return;
    }
    if (bodegaOrigenId === bodegaDestinoId) {
      setError('El origen y el destino no pueden ser la misma bodega.');
      return;
    }
    if (lineasValidas.length === 0) {
      setError('Agregá al menos una línea con producto y cantidad.');
      return;
    }
    crear.mutate();
  }

  const bodegas_ = bodegas ?? [];
  const bodegaOrigen = bodegas_.find((b) => b.id === bodegaOrigenId);
  const bodegaDestino = bodegas_.find((b) => b.id === bodegaDestinoId);
  const [haycambios, confirmarGuardado] = useHayCambios({ bodegaOrigenId, bodegaDestinoId, lineas });

  return (
    <PaginaDocumento
      titulo="Nueva transferencia de inventario"
      rutaVolver="/inventario/transferencias"
      etiquetaVolver="Volver a Transferencias"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Origen</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{bodegaOrigen?.nombre ?? 'Sin seleccionar'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Destino</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{bodegaDestino?.nombre ?? 'Sin seleccionar'}</span>
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
          <Button type="submit" form="form-nueva-transferencia" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Guardando…' : 'Guardar borrador'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/inventario/transferencias')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-transferencia" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Bodegas">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Origen</label>
              <Select value={bodegaOrigenId} onChange={(e) => setBodegaOrigenId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {bodegas_.filter((b) => b.activa).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Destino</label>
              <Select value={bodegaDestinoId} onChange={(e) => setBodegaDestinoId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {bodegas_.filter((b) => b.activa && b.id !== bodegaOrigenId).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>

        <Card titulo="Líneas" descripcion="Agregá uno o más productos a transferir.">
          {!bodegaOrigenId || !bodegaDestinoId ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Elegí origen y destino arriba para empezar a agregar líneas.</p>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="w-28 px-3 py-2 font-medium">Cantidad</th>
                      <th className="w-px px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lineas.map((linea, i) => (
                      <tr key={i}>
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
                            min={1}
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
                    ))}
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
