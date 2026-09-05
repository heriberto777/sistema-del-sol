import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Modal } from '../../molecules/Modal/Modal';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface LineaFactura {
  productoId: string | null;
  varianteId: string | null;
  cantidad: string;
  producto: { nombre: string; codigo: string } | null;
}

interface Factura {
  id: string;
  numero: string | null;
  ncf: string | null;
  tipoFactura: 'CONTADO' | 'CREDITO' | 'NOTA_DEBITO' | 'NOTA_CREDITO';
  estado: 'BORRADOR' | 'EMITIDA' | 'ANULADA';
  bodegaId: string | null;
  clienteId: string;
  total: string;
  cliente: { nombre: string };
  tieneCobro: boolean;
}

interface FacturaDetalle extends Factura {
  lineas: LineaFactura[];
}

export function EmitirNotaForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [facturaOrigen, setFacturaOrigen] = useState<FacturaDetalle | null>(null);
  const [tipoNota, setTipoNota] = useState<'NOTA_CREDITO' | 'NOTA_DEBITO'>('NOTA_CREDITO');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [avisoCobro, setAvisoCobro] = useState<string | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const { data: resultados, isFetching: buscando } = useQuery({
    queryKey: ['facturas-para-nota', busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Factura>>('/facturas/buscar-para-nota', {
          params: { busqueda: busquedaDebounced || undefined },
        })
      ).data,
    enabled: !facturaOrigen,
  });

  async function elegirFactura(factura: Factura) {
    if (factura.tieneCobro) {
      setAvisoCobro('Esta factura ya tiene un cobro registrado — no se puede emitir una nota sobre ella hasta revertir el cobro.');
      return;
    }
    setAvisoCobro(null);
    setError(null);
    setCargandoDetalle(true);
    try {
      const { data: detalle } = await apiClient.get<FacturaDetalle>(`/facturas/${factura.id}`);
      setFacturaOrigen(detalle);
      // Ítem B-9 — una línea manual (sin productoId) no se puede notar por
      // este flujo (no hay contra qué hacer match); fuera de alcance,
      // igual criterio que la devolución de POS.
      setCantidades(Object.fromEntries(detalle.lineas.filter((l) => l.productoId).map((l) => [l.productoId as string, l.cantidad])));
    } catch {
      setError('No se pudo cargar el detalle de la factura.');
    } finally {
      setCargandoDetalle(false);
    }
  }

  function volverABuscar() {
    setFacturaOrigen(null);
    setCantidades({});
    setError(null);
    setAvisoCobro(null);
  }

  const emitirNota = useMutation({
    mutationFn: async () => {
      if (!facturaOrigen) return;
      return apiClient.post('/facturas', {
        clienteId: facturaOrigen.clienteId,
        bodegaId: facturaOrigen.bodegaId,
        tipoFactura: tipoNota,
        facturaOrigenId: facturaOrigen.id,
        lineas: facturaOrigen.lineas
          .filter((l) => l.productoId)
          .map((l) => ({
            productoId: l.productoId,
            varianteId: l.varianteId,
            cantidad: Number(cantidades[l.productoId as string] ?? l.cantidad),
          })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      onClose();
    },
    onError: (err: unknown) => {
      const mensaje =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? null)
          : null;
      setError(mensaje ?? 'No se pudo emitir la nota. Revisa las cantidades.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    emitirNota.mutate();
  }

  return (
    <Modal titulo="Emitir nota de crédito/débito" onClose={onClose}>
      {!facturaOrigen && (
        <div className="space-y-3">
          <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por número o NCF…" />

          {avisoCobro && <p className="text-sm text-amber-600 dark:text-amber-400">{avisoCobro}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="max-h-80 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {buscando && <p className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">Buscando…</p>}
            {!buscando && resultados?.datos.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">No se encontraron facturas vigentes.</p>
            )}
            {resultados?.datos.map((factura) => (
              <button
                key={factura.id}
                type="button"
                disabled={cargandoDetalle}
                onClick={() => elegirFactura(factura)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  factura.tieneCobro
                    ? 'cursor-pointer bg-slate-50 opacity-70 dark:bg-slate-900/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900 dark:text-slate-100">
                    {factura.numero ?? factura.id.slice(0, 8)} {factura.ncf ? <span className="text-slate-400">· {factura.ncf}</span> : null}
                  </span>
                  <span className="block truncate text-slate-500 dark:text-slate-400">{factura.cliente.nombre}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-medium text-slate-900 dark:text-slate-100">RD$ {Number(factura.total).toLocaleString('es-DO')}</span>
                  {factura.tieneCobro && <Badge tono="advertencia">Con cobro — no se puede aplicar</Badge>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {facturaOrigen && (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/40">
            <span className="text-slate-700 dark:text-slate-300">
              Nota sobre <span className="font-medium">{facturaOrigen.numero ?? facturaOrigen.id.slice(0, 8)}</span>
              {facturaOrigen.ncf ? ` · ${facturaOrigen.ncf}` : ''} — {facturaOrigen.cliente.nombre}
            </span>
            <Button type="button" variante="secundario" onClick={volverABuscar}>
              Cambiar
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de nota</p>
            <select
              value={tipoNota}
              onChange={(e) => setTipoNota(e.target.value as 'NOTA_CREDITO' | 'NOTA_DEBITO')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="NOTA_CREDITO">Nota de crédito (devuelve mercancía/dinero)</option>
              <option value="NOTA_DEBITO">Nota de débito (cargo adicional)</option>
            </select>
          </div>

          <div className="space-y-2">
            {facturaOrigen.lineas
              .filter((linea) => linea.productoId)
              .map((linea) => (
                <div key={linea.productoId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">
                    {linea.producto!.nombre} <span className="text-slate-400">({linea.producto!.codigo})</span> — original: {linea.cantidad}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={Number(linea.cantidad)}
                    step="any"
                    value={cantidades[linea.productoId as string] ?? ''}
                    onChange={(e) => setCantidades((prev) => ({ ...prev, [linea.productoId as string]: e.target.value }))}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              ))}
          </div>

          <Button type="submit" disabled={emitirNota.isPending} className="w-full">
            {emitirNota.isPending ? 'Emitiendo…' : 'Emitir nota'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
