import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { useAuth } from '../hooks/useAuth';
import { useHayCambios } from '../hooks/useHayCambios';
import type { AjusteInventario } from '../components/organisms/AjustesInventarioPanel/AjustesInventarioPanel';
import type { Producto } from '../components/organisms/StockBodegasPanel/StockBodegasPanel';

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

interface LineaForm {
  productoId: string;
  cantidad: string;
  motivoAjuste: string;
  motivo: string;
  nombreProducto: string;
}

/**
 * Auditoría de modales pendientes (bloque "Chicos") — reemplaza a
 * ModalVerAjuste/ModalEditarAjuste de AjustesInventarioPanel.tsx. Editable
 * solo si el ajuste sigue en BORRADOR y el usuario tiene permiso — una vez
 * confirmado o cancelado, es de solo lectura (mismo criterio que antes).
 */
export function InventarioAjusteVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['ajuste-inventario', id],
    queryFn: async () => (await apiClient.get<AjusteInventarioDetalle>(`/ajustes-inventario/${id}`)).data,
  });

  const editable = data?.estado === 'BORRADOR' && tienePermiso('inventario.ajustar');

  useEffect(() => {
    if (data && lineas.length === 0) {
      setLineas(
        data.lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: String(l.cantidad),
          motivoAjuste: l.motivoAjuste,
          motivo: l.motivo ?? '',
          nombreProducto: `${l.producto.codigo} — ${l.producto.nombre}`,
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function actualizarLinea(i: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/ajustes-inventario/${id}`, {
        lineas: lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: Number(l.cantidad),
          motivoAjuste: l.motivoAjuste,
          motivo: l.motivo || undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ajustes-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['ajuste-inventario', id] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de guardar bien.
      confirmarGuardado();
      setTimeout(() => navigate('/inventario/ajustes'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el ajuste. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  const [hayCambiosLineas, confirmarGuardado] = useHayCambios(lineas, !!editable && lineas.length > 0);
  const haycambios = !!editable && hayCambiosLineas;

  return (
    <PaginaDocumento
      titulo={data ? `Ajuste de inventario — ${data.numero}` : 'Ajuste de inventario'}
      rutaVolver="/inventario/ajustes"
      etiquetaVolver="Volver a Ajustes"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Bodega</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{data?.bodega.nombre ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Fecha</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {data ? new Date(data.fecha).toLocaleDateString('es-DO') : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
            {data && (
              <Badge tono={data.estado === 'CONFIRMADO' ? 'exito' : data.estado === 'CANCELADO' ? 'peligro' : 'neutro'}>{data.estado}</Badge>
            )}
          </div>
        </>
      }
      acciones={
        editable ? (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" form="form-ver-ajuste" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/inventario/ajustes')}>
              Volver
            </Button>
          </>
        ) : (
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/inventario/ajustes')}>
            Volver
          </Button>
        )
      }
    >
      {!data ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : editable ? (
        <form id="form-ver-ajuste" onSubmit={onSubmit} className="space-y-4">
          <Card
            titulo="Líneas"
            descripcion="Se puede corregir la cantidad y el motivo de cada línea — agregar o quitar productos solo al crear un ajuste nuevo."
          >
            <div className="space-y-2">
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
                    id={`ajuste-ver-motivo-${i}`}
                    label="Detalle (opcional)"
                    value={linea.motivo}
                    onChange={(e) => actualizarLinea(i, { motivo: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </Card>
        </form>
      ) : (
        <Card titulo="Líneas">
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
        </Card>
      )}
    </PaginaDocumento>
  );
}
