import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { ModalImprimir } from '../../molecules/ModalImprimir/ModalImprimir';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Factura {
  id: string;
  ncf: string | null;
  tipoFactura: 'CONTADO' | 'CREDITO' | 'NOTA_DEBITO' | 'NOTA_CREDITO';
  estado: 'BORRADOR' | 'EMITIDA' | 'ANULADA';
  total: string;
  pagada: boolean;
  fecha: string;
  cliente: { nombre: string };
}

interface Pago {
  id: string;
  monto: string;
  metodoPago: string;
  fecha: string;
}

const TONO_POR_ESTADO: Record<Factura['estado'], 'exito' | 'neutro' | 'peligro'> = {
  EMITIDA: 'exito',
  BORRADOR: 'neutro',
  ANULADA: 'peligro',
};

export function FacturasTable() {
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [facturaCobrando, setFacturaCobrando] = useState<Factura | null>(null);
  const [facturaAnulando, setFacturaAnulando] = useState<Factura | null>(null);
  const [facturaImprimiendo, setFacturaImprimiendo] = useState<Factura | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['facturas', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Factura>>('/facturas', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <SearchInput
        value={busqueda}
        onChange={(v) => {
          setBusqueda(v);
          setPagina(1);
        }}
        placeholder="Buscar por NCF o cliente…"
      />

      {isLoading && <p className="text-sm text-slate-500">Cargando facturas…</p>}
      {error && <p className="text-sm text-red-600">No se pudieron cargar las facturas.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">NCF</th>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.datos.map((factura) => {
                  const acciones = [
                    { etiqueta: 'Imprimir', onClick: () => setFacturaImprimiendo(factura) },
                    ...(factura.tipoFactura === 'CREDITO' &&
                    factura.estado === 'EMITIDA' &&
                    !factura.pagada &&
                    tienePermiso('facturacion.cobrar')
                      ? [{ etiqueta: 'Registrar cobro', onClick: () => setFacturaCobrando(factura) }]
                      : []),
                    ...(factura.estado === 'EMITIDA' && tienePermiso('facturacion.anular')
                      ? [{ etiqueta: 'Anular', onClick: () => setFacturaAnulando(factura), tono: 'peligro' as const }]
                      : []),
                  ];

                  return (
                    <tr key={factura.id}>
                      <td className="px-4 py-2 font-mono text-xs">{factura.ncf ?? '—'}</td>
                      <td className="px-4 py-2">{factura.cliente?.nombre}</td>
                      <td className="px-4 py-2">{factura.tipoFactura}</td>
                      <td className="px-4 py-2">RD$ {Number(factura.total).toLocaleString('es-DO')}</td>
                      <td className="px-4 py-2">
                        <Badge tono={TONO_POR_ESTADO[factura.estado]}>{factura.estado}</Badge>
                        {factura.tipoFactura === 'CREDITO' && factura.estado === 'EMITIDA' && (
                          <span className="ml-2 text-xs text-slate-400">{factura.pagada ? 'pagada' : 'pendiente de cobro'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2">{new Date(factura.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-4 py-2 text-right">{acciones.length > 0 && <RowActionsMenu acciones={acciones} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacion
            pagina={data.pagina}
            tamanoPagina={data.tamanoPagina}
            total={data.total}
            onCambiarPagina={setPagina}
          />
        </>
      )}

      {facturaCobrando && <ModalRegistrarCobro factura={facturaCobrando} onClose={() => setFacturaCobrando(null)} />}
      {facturaAnulando && <ModalAnularFactura factura={facturaAnulando} onClose={() => setFacturaAnulando(null)} />}
      {facturaImprimiendo && (
        <ModalImprimir
          urlBase={`/facturas/${facturaImprimiendo.id}`}
          titulo={`Imprimir — ${facturaImprimiendo.ncf ?? facturaImprimiendo.id}`}
          onClose={() => setFacturaImprimiendo(null)}
        />
      )}
    </div>
  );
}

function ModalAnularFactura({ factura, onClose }: { factura: Factura; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anular = useMutation({
    mutationFn: async () => apiClient.post(`/facturas/${factura.id}/anular`, { motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      onClose();
    },
    onError: () => setError('No se pudo anular la factura.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (motivo.trim().length < 3) {
      setError('Indicá un motivo de al menos 3 caracteres.');
      return;
    }
    if (!confirmado) {
      setError('Confirmá que querés anular esta factura antes de continuar.');
      return;
    }
    anular.mutate();
  }

  return (
    <Modal titulo={`Anular factura — ${factura.ncf ?? factura.id}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Esta acción es irreversible: la factura quedará anulada y, si corresponde, se reintegrará el inventario.
        </p>
        <FormField id="anular-motivo" label="Motivo de la anulación" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
          Confirmo que quiero anular esta factura.
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variante="peligro" disabled={anular.isPending} className="w-full">
          {anular.isPending ? 'Anulando…' : 'Anular factura'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalRegistrarCobro({ factura, onClose }: { factura: Factura; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [error, setError] = useState<string | null>(null);

  const { data: historial } = useQuery({
    queryKey: ['pagos-factura', factura.id],
    queryFn: async () => (await apiClient.get<{ pagos: Pago[]; totalPagado: number }>(`/facturas/${factura.id}/pagos`)).data,
  });

  const totalPagado = historial ? Number(historial.totalPagado) : 0;
  const pendiente = Number(factura.total) - totalPagado;

  const registrar = useMutation({
    mutationFn: async () => apiClient.post(`/facturas/${factura.id}/pagos`, { monto: Number(monto), metodoPago }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos-factura', factura.id] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      setMonto('');
      setError(null);
    },
    onError: () => setError('No se pudo registrar el cobro. Revisa el monto.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    registrar.mutate();
  }

  return (
    <Modal titulo={`Registrar cobro — ${factura.ncf ?? factura.id}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          <p>Total: RD$ {Number(factura.total).toLocaleString('es-DO')}</p>
          <p>Pagado: RD$ {totalPagado.toLocaleString('es-DO')}</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">Pendiente: RD$ {pendiente.toLocaleString('es-DO')}</p>
        </div>

        {historial && historial.pagos.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Historial de cobros</p>
            <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
              {historial.pagos.map((pago) => (
                <li key={pago.id}>
                  RD$ {Number(pago.monto).toLocaleString('es-DO')} — {pago.metodoPago} —{' '}
                  {new Date(pago.fecha).toLocaleDateString('es-DO')}
                </li>
              ))}
            </ul>
          </div>
        )}

        {pendiente > 0 ? (
          <form onSubmit={onSubmit} className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <FormField
              id="cobro-monto"
              label="Monto a cobrar"
              type="number"
              min={0}
              max={pendiente}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Método de pago</label>
              <Select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                <option value="EFECTIVO">Efectivo</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={registrar.isPending} className="w-full">
              {registrar.isPending ? 'Registrando…' : 'Registrar cobro'}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-slate-500">Esta factura ya está pagada en su totalidad.</p>
        )}
      </div>
    </Modal>
  );
}
