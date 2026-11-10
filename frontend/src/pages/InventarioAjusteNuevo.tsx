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
import { SelectorLoteAjuste } from '../components/molecules/SelectorLoteAjuste/SelectorLoteAjuste';
import { PaginaResultado } from '../types/pagina-resultado';
import { useHayCambios } from '../hooks/useHayCambios';
import type { Bodega, Producto } from '../components/organisms/StockBodegasPanel/StockBodegasPanel';

interface LineaForm {
  productoId: string;
  varianteId: string;
  cantidad: string;
  motivoAjuste: string;
  motivo: string;
  numeroLote: string;
  fechaVencimiento: string;
  loteId: string;
}

const LINEA_VACIA: LineaForm = {
  productoId: '',
  varianteId: '',
  cantidad: '',
  motivoAjuste: '',
  motivo: '',
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
 */
export function InventarioAjusteNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bodegaId, setBodegaId] = useState('');
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

  const lineasValidas = lineas.filter((l) => l.productoId && l.cantidad !== '' && l.motivoAjuste);

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
            motivoAjuste: l.motivoAjuste,
            motivo: l.motivo || undefined,
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
    if (lineasValidas.length === 0) {
      setError('Agregá al menos una línea con producto, cantidad y motivo.');
      return;
    }
    crear.mutate();
  }

  const bodegaSeleccionada = (bodegas ?? []).find((b) => b.id === bodegaId);
  const [haycambios, confirmarGuardado] = useHayCambios({ bodegaId, lineas });

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
        <Card titulo="Bodega">
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
        </Card>

        <Card titulo="Líneas" descripcion='Agregá uno o más productos — cantidad positiva para entrada, negativa para salida.'>
          {!bodegaId ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Elegí una bodega arriba para empezar a agregar líneas.</p>
          ) : (
            <div className="space-y-3">
              {lineas.map((linea, i) => {
                const producto = productos?.find((p) => p.id === linea.productoId);
                const esEntrada = Number(linea.cantidad) > 0;
                return (
                  <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <SelectorLineaProducto
                          productos={productos ?? []}
                          productoId={linea.productoId}
                          varianteId={linea.varianteId}
                          onChange={(productoId, varianteId) => actualizarLinea(i, { productoId, varianteId })}
                        />
                      </div>
                      {lineas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                          className="mt-2 text-red-600 hover:text-red-700"
                          aria-label="Quitar línea"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="number"
                        placeholder="Cantidad (negativo para restar)"
                        value={linea.cantidad}
                        onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <Select value={linea.motivoAjuste} onChange={(e) => actualizarLinea(i, { motivoAjuste: e.target.value })} required>
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
                    {producto?.controlaVencimiento && esEntrada && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          placeholder="Número de lote"
                          value={linea.numeroLote}
                          onChange={(e) => actualizarLinea(i, { numeroLote: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <input
                          type="date"
                          value={linea.fechaVencimiento}
                          onChange={(e) => actualizarLinea(i, { fechaVencimiento: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                    )}
                    {producto?.controlaVencimiento && linea.cantidad !== '' && !esEntrada && (
                      <SelectorLoteAjuste
                        varianteId={linea.varianteId}
                        bodegaId={bodegaId}
                        value={linea.loteId}
                        onChange={(loteId) => actualizarLinea(i, { loteId })}
                      />
                    )}
                    <input
                      placeholder="Detalle (opcional)"
                      value={linea.motivo}
                      onChange={(e) => actualizarLinea(i, { motivo: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                );
              })}
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
