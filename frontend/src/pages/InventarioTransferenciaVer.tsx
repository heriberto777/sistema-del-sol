import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { useAuth } from '../hooks/useAuth';
import { useHayCambios } from '../hooks/useHayCambios';
import type { TransferenciaInventario } from '../components/organisms/TransferenciasInventarioPanel/TransferenciasInventarioPanel';
import type { Producto } from '../components/organisms/StockBodegasPanel/StockBodegasPanel';

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

interface LineaForm {
  productoId: string;
  cantidad: string;
  nombreProducto: string;
}

/**
 * Auditoría de modales pendientes (bloque "Chicos") — reemplaza a
 * ModalVerTransferencia/ModalEditarTransferencia de
 * TransferenciasInventarioPanel.tsx. Editable solo si sigue en BORRADOR y
 * el usuario tiene permiso de transferir.
 */
export function InventarioTransferenciaVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['transferencia-inventario', id],
    queryFn: async () => (await apiClient.get<TransferenciaInventarioDetalle>(`/transferencias-inventario/${id}`)).data,
  });

  const editable = data?.estado === 'BORRADOR' && tienePermiso('inventario.transferir');

  useEffect(() => {
    if (data && lineas.length === 0) {
      setLineas(
        data.lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: String(l.cantidad),
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
      apiClient.patch(`/transferencias-inventario/${id}`, {
        lineas: lineas.map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['transferencia-inventario', id] });
      confirmarGuardado();
      navigate('/inventario/transferencias');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la transferencia. Revisa los datos.')),
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
      titulo={data ? `Transferencia de inventario — ${data.numero}` : 'Transferencia de inventario'}
      rutaVolver="/inventario/transferencias"
      etiquetaVolver="Volver a Transferencias"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">De</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{data?.bodegaOrigen.nombre ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">A</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{data?.bodegaDestino.nombre ?? '—'}</span>
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
            <Button type="submit" form="form-ver-transferencia" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/inventario/transferencias')}>
              Volver
            </Button>
          </>
        ) : (
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/inventario/transferencias')}>
            Volver
          </Button>
        )
      }
    >
      {!data ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : editable ? (
        <form id="form-ver-transferencia" onSubmit={onSubmit} className="space-y-4">
          <Card titulo="Líneas" descripcion="Se puede corregir la cantidad de cada línea — agregar o quitar productos solo al crear una transferencia nueva.">
            <div className="space-y-2">
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
        </Card>
      )}
    </PaginaDocumento>
  );
}
