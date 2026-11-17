import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { Select } from '../components/atoms/Select/Select';
import { SelectorBodega } from '../components/molecules/SelectorBodega/SelectorBodega';
import { useHayCambios } from '../hooks/useHayCambios';

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  controlaVencimiento: boolean;
}

interface LineaOcDetalle {
  productoId: string;
  varianteId: string;
  cantidadRecibida: string;
  producto: Producto;
}

interface OrdenCompraDetalle {
  id: string;
  numero: string;
  proveedor: { nombre: string };
  lineas: LineaOcDetalle[];
}

interface Lote {
  id: string;
  numeroLote: string;
  fechaVencimiento: string;
  cantidadActual: string;
}

/** Fase 5b — de qué lote sale la devolución a proveedor (siempre a mano, nunca FEFO: ver ARCHITECTURE.md). */
function SelectorLoteDevolucion({
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
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="text-xs" required>
      <option value="">De qué lote sale…</option>
      {lotes?.map((l) => (
        <option key={l.id} value={l.id}>
          {l.numeroLote} — vence {new Date(l.fechaVencimiento).toLocaleDateString('es-DO', { timeZone: 'UTC' })} — saldo {Number(l.cantidadActual)}
        </option>
      ))}
    </Select>
  );
}

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * ModalDevolverOrden de Compras.tsx. Página propia, mismo criterio que
 * OrdenCompraRecibir.
 */
export function OrdenCompraDevolver() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bodegaId, setBodegaId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [lotesElegidos, setLotesElegidos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: orden } = useQuery({
    queryKey: ['orden-compra', id],
    queryFn: async () => (await apiClient.get<OrdenCompraDetalle>(`/compras/${id}`)).data,
  });

  const lineasDevolvibles = (orden?.lineas ?? []).filter((l) => Number(l.cantidadRecibida) > 0);

  const devolver = useMutation({
    mutationFn: async () =>
      apiClient.post(`/compras/${id}/devolver`, {
        bodegaId,
        motivo: motivo || undefined,
        lineas: lineasDevolvibles
          .filter((l) => Number(cantidades[l.productoId] ?? 0) > 0)
          .map((l) => ({
            productoId: l.productoId,
            cantidad: Number(cantidades[l.productoId]),
            ...(l.producto.controlaVencimiento ? { loteId: lotesElegidos[l.productoId] } : {}),
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['orden-compra', id] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      confirmarGuardado();
      setTimeout(() => navigate(`/compras/${id}`), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar la devolución. Revisa las cantidades.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    devolver.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ bodegaId, cantidades }, !!orden);

  return (
    <PaginaDocumento
      titulo={orden ? `Devolver a proveedor — ${orden.numero}` : 'Devolver a proveedor'}
      rutaVolver={`/compras/${id}`}
      etiquetaVolver="Volver a la orden"
      haycambios={haycambios}
      resumen={
        orden ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Proveedor</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{orden.proveedor?.nombre}</span>
          </div>
        ) : null
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-devolver-oc" disabled={devolver.isPending || lineasDevolvibles.length === 0} className="w-full">
            {devolver.isPending ? 'Registrando…' : 'Devolver a proveedor'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/compras/${id}`)}>
            Cancelar
          </Button>
        </>
      }
    >
      {!orden ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form id="form-devolver-oc" onSubmit={onSubmit} className="space-y-4">
          <Card titulo="Bodega de origen">
            <div className="sm:col-span-2">
              <SelectorBodega value={bodegaId} onChange={setBodegaId} required />
            </div>
          </Card>

          <Card titulo="Líneas recibidas">
            <div className="sm:col-span-2 space-y-2">
              {lineasDevolvibles.length === 0 && <p className="text-sm text-slate-400">No hay mercancía recibida por devolver.</p>}
              {lineasDevolvibles.map((linea) => (
                <div key={linea.productoId} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex-1">
                      {linea.producto.codigo} — {linea.producto.nombre}
                    </span>
                    <span className="text-slate-400">recibido {linea.cantidadRecibida}</span>
                    <input
                      type="number"
                      min={0}
                      max={Number(linea.cantidadRecibida)}
                      placeholder="Devolver"
                      value={cantidades[linea.productoId] ?? ''}
                      onChange={(e) => setCantidades((prev) => ({ ...prev, [linea.productoId]: e.target.value }))}
                      className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  {linea.producto.controlaVencimiento && bodegaId && Number(cantidades[linea.productoId] ?? 0) > 0 && (
                    <SelectorLoteDevolucion
                      varianteId={linea.varianteId}
                      bodegaId={bodegaId}
                      value={lotesElegidos[linea.productoId] ?? ''}
                      onChange={(loteId) => setLotesElegidos((prev) => ({ ...prev, [linea.productoId]: loteId }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card titulo="Motivo (opcional)">
            <div className="sm:col-span-2">
              <FormField id="devolver-motivo" label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          </Card>
        </form>
      )}
    </PaginaDocumento>
  );
}
