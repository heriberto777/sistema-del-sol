import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Modal } from '../../molecules/Modal/Modal';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface LineaFactura {
  productoId: string;
  varianteId: string;
  cantidad: string;
  producto: { nombre: string; codigo: string };
}

interface Factura {
  id: string;
  ncf: string | null;
  tipoFactura: 'CONTADO' | 'CREDITO' | 'NOTA_DEBITO' | 'NOTA_CREDITO';
  estado: 'BORRADOR' | 'EMITIDA' | 'ANULADA';
  bodegaId: string | null;
  clienteId: string;
  lineas: LineaFactura[];
}

export function EmitirNotaForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [ncfBuscado, setNcfBuscado] = useState('');
  const [facturaOrigen, setFacturaOrigen] = useState<Factura | null>(null);
  const [tipoNota, setTipoNota] = useState<'NOTA_CREDITO' | 'NOTA_DEBITO'>('NOTA_CREDITO');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  async function buscarFactura(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFacturaOrigen(null);
    setBuscando(true);
    try {
      const { data } = await apiClient.get<PaginaResultado<Factura>>('/facturas', {
        params: { busqueda: ncfBuscado, tamanoPagina: 1 },
      });
      const encontrada = data.datos[0];
      if (!encontrada) {
        setError('No se encontró ninguna factura con ese NCF.');
        return;
      }
      if (encontrada.estado !== 'EMITIDA') {
        setError('Solo se pueden emitir notas contra una factura EMITIDA.');
        return;
      }
      if (encontrada.tipoFactura !== 'CONTADO' && encontrada.tipoFactura !== 'CREDITO') {
        setError('Esa factura ya es una nota de crédito/débito — no se puede emitir una nota sobre otra nota.');
        return;
      }
      const { data: detalle } = await apiClient.get<Factura>(`/facturas/${encontrada.id}`);
      setFacturaOrigen(detalle);
      setCantidades(Object.fromEntries(detalle.lineas.map((l) => [l.productoId, l.cantidad])));
    } catch {
      setError('No se pudo buscar la factura.');
    } finally {
      setBuscando(false);
    }
  }

  const emitirNota = useMutation({
    mutationFn: async () => {
      if (!facturaOrigen) return;
      return apiClient.post('/facturas', {
        clienteId: facturaOrigen.clienteId,
        bodegaId: facturaOrigen.bodegaId,
        tipoFactura: tipoNota,
        facturaOrigenId: facturaOrigen.id,
        lineas: facturaOrigen.lineas.map((l) => ({
          productoId: l.productoId,
          varianteId: l.varianteId,
          cantidad: Number(cantidades[l.productoId] ?? l.cantidad),
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      onClose();
    },
    onError: () => setError('No se pudo emitir la nota. Revisa las cantidades.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    emitirNota.mutate();
  }

  return (
    <Modal titulo="Emitir nota de crédito/débito" onClose={onClose}>
      <form onSubmit={buscarFactura} className="flex items-end gap-2">
        <FormField
          id="ncf-buscar"
          label="NCF de la factura original"
          value={ncfBuscado}
          onChange={(e) => setNcfBuscado(e.target.value)}
          required
          className="flex-1"
        />
        <Button type="submit" variante="secundario" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </Button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {facturaOrigen && (
        <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
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
            {facturaOrigen.lineas.map((linea) => (
              <div key={linea.productoId} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700 dark:text-slate-300">
                  {linea.producto.nombre} <span className="text-slate-400">({linea.producto.codigo})</span> — original: {linea.cantidad}
                </span>
                <input
                  type="number"
                  min={0}
                  max={Number(linea.cantidad)}
                  step="any"
                  value={cantidades[linea.productoId] ?? ''}
                  onChange={(e) => setCantidades((prev) => ({ ...prev, [linea.productoId]: e.target.value }))}
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
