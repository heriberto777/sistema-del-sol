import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

type EstadoBono = 'ACTIVO' | 'AGOTADO' | 'VENCIDO' | 'ANULADO';

interface Bono {
  id: string;
  codigo: string;
  montoInicial: string;
  saldoActual: string;
  fechaVencimiento: string;
  estado: EstadoBono;
}

const TONO_ESTADO: Record<EstadoBono, 'exito' | 'neutro' | 'advertencia' | 'peligro'> = {
  ACTIVO: 'exito',
  AGOTADO: 'neutro',
  VENCIDO: 'advertencia',
  ANULADO: 'peligro',
};

function mensajeError(err: unknown, fallback: string): string {
  const mensaje =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
      : undefined;
  return mensaje ?? fallback;
}

function formatearFecha(fecha: string): string {
  // Fecha "de calendario" (medianoche UTC) — forzar 'UTC' evita que un huso
  // horario detrás de UTC corra el día mostrado (mismo bug ya encontrado y
  // corregido en OfertasPanel).
  return new Date(fecha).toLocaleDateString('es-DO', { timeZone: 'UTC' });
}

/**
 * Gift cards emitidas por lote (Fase 4c de adopción de Cuadre), canjeables
 * como forma de pago en el POS (ver FacturacionService.crear() →
 * BonosService.procesarPagoEnTx). Este panel es solo el CRUD/consulta —
 * el canje real ocurre en el checkout del POS, seleccionando la forma de
 * pago "Bono" (Admin → Facturación → Formas de pago) y tipeando el código
 * en la referencia.
 */
export function BonosPanel() {
  const queryClient = useQueryClient();
  const [cantidad, setCantidad] = useState('10');
  const [montoPorBono, setMontoPorBono] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [emitidos, setEmitidos] = useState<Bono[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data: bonos } = useQuery({
    queryKey: ['bonos', busquedaDebounced],
    queryFn: async () => (await apiClient.get<Bono[]>('/bonos', { params: { busqueda: busquedaDebounced || undefined } })).data,
  });

  const emitirLote = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<Bono[]>('/bonos/lotes', {
          cantidad: Number(cantidad),
          montoPorBono: Number(montoPorBono),
          fechaVencimiento,
        })
      ).data,
    onSuccess: (creados) => {
      queryClient.invalidateQueries({ queryKey: ['bonos'] });
      setEmitidos(creados);
      setMontoPorBono('');
      setError(null);
    },
    onError: (err: unknown) => setError(mensajeError(err, 'No se pudo emitir el lote de bonos.')),
  });

  const anular = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/bonos/${id}/anular`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bonos'] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEmitidos(null);
    emitirLote.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Emitir lote de bonos">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField id="bono-cantidad" label="Cantidad" type="number" min={1} max={500} value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
          <FormField
            id="bono-monto"
            label="Monto por bono (RD$)"
            type="number"
            min={0.01}
            step="0.01"
            value={montoPorBono}
            onChange={(e) => setMontoPorBono(e.target.value)}
            required
          />
          <FormField
            id="bono-vencimiento"
            label="Fecha de vencimiento"
            type="date"
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={emitirLote.isPending} className="w-full">
            {emitirLote.isPending ? 'Emitiendo…' : 'Emitir lote'}
          </Button>
        </form>

        {emitidos && (
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{emitidos.length} código(s) generado(s):</p>
            <div className="max-h-40 overflow-auto rounded-md bg-slate-50 p-2 font-mono text-xs dark:bg-slate-900">
              {emitidos.map((b) => (
                <div key={b.id}>{b.codigo}</div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card
        sinPadding
        className="lg:col-span-2 overflow-x-auto"
        titulo="Bonos"
        descripcion={bonos ? `${bonos.length} bono(s)` : undefined}
        acciones={<SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por código…" />}
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Código</th>
              <th className="px-5 py-3 font-medium">Monto inicial</th>
              <th className="px-5 py-3 font-medium">Saldo</th>
              <th className="px-5 py-3 font-medium">Vencimiento</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {bonos?.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3 font-mono text-xs">{b.codigo}</td>
                <td className="px-5 py-3">RD$ {Number(b.montoInicial).toLocaleString('es-DO')}</td>
                <td className="px-5 py-3 font-medium">RD$ {Number(b.saldoActual).toLocaleString('es-DO')}</td>
                <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{formatearFecha(b.fechaVencimiento)}</td>
                <td className="px-5 py-3">
                  <Badge tono={TONO_ESTADO[b.estado]}>{b.estado}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  {b.estado !== 'ANULADO' && (
                    <button
                      type="button"
                      onClick={() => anular.mutate(b.id)}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Anular
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {bonos?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                  Sin bonos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
