import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApiClient } from '../lib/platform-api-client';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Modal } from '../components/molecules/Modal/Modal';
import { PlatformHeader } from '../components/organisms/PlatformHeader/PlatformHeader';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { PaginaResultado } from '../types/pagina-resultado';
import { usePlatformAuth } from '../hooks/usePlatformAuth';

type EstadoFactura = 'PENDIENTE' | 'PAGADA' | 'VENCIDA' | 'ANULADA';

interface FacturaPlataforma {
  id: string;
  tenant: { id: string; nombre: string };
  concepto: string;
  monto: string;
  descuento: string;
  montoMora: string;
  total: string;
  estado: EstadoFactura;
  fechaEmision: string;
  fechaVencimiento: string;
}

interface Tenant {
  id: string;
  nombre: string;
}

interface Pago {
  id: string;
  monto: string;
  metodoPago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
  referencia: string | null;
  fecha: string;
  registradoPor: { nombre: string } | null;
}

const TONO_POR_ESTADO: Record<EstadoFactura, 'exito' | 'advertencia' | 'peligro' | 'neutro'> = {
  PENDIENTE: 'neutro',
  PAGADA: 'exito',
  VENCIDA: 'peligro',
  ANULADA: 'advertencia',
};

function PanelFactura({ factura, onClose }: { factura: FacturaPlataforma; onClose: () => void }) {
  const { tienePermiso } = usePlatformAuth();
  const puedeGestionar = tienePermiso('platform.facturacion.gestionar');
  const puedeRegistrarPago = tienePermiso('platform.pagos.registrar');
  const queryClient = useQueryClient();

  const [descuento, setDescuento] = useState(factura.descuento);
  const [montoMora, setMontoMora] = useState(factura.montoMora);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState<Pago['metodoPago']>('TRANSFERENCIA');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: pagos } = useQuery({
    queryKey: ['platform-factura-pagos', factura.id],
    queryFn: async () =>
      (await platformApiClient.get<{ pagos: Pago[]; totalPagado: number }>(`/platform/facturas/${factura.id}/pagos`)).data,
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-facturas'] });
    queryClient.invalidateQueries({ queryKey: ['platform-factura-pagos', factura.id] });
  };

  const guardarEdicion = useMutation({
    mutationFn: async () =>
      platformApiClient.patch(`/platform/facturas/${factura.id}`, { descuento: Number(descuento), montoMora: Number(montoMora) }),
    onSuccess: invalidar,
    onError: () => setError('No se pudo guardar — revisa que el descuento + mora no superen el monto.'),
  });

  const anular = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/facturas/${factura.id}/anular`),
    onSuccess: invalidar,
    onError: () => setError('No se pudo anular — puede que ya tenga pagos registrados.'),
  });

  const registrarPago = useMutation({
    mutationFn: async () =>
      platformApiClient.post(`/platform/facturas/${factura.id}/pagos`, {
        monto: Number(monto),
        metodoPago,
        referencia: referencia || undefined,
      }),
    onSuccess: () => {
      invalidar();
      setMonto('');
      setReferencia('');
      setError(null);
    },
    onError: () => setError('No se pudo registrar el pago — revisa el monto contra el saldo pendiente.'),
  });

  const totalPagado = pagos?.totalPagado ?? 0;
  const pendiente = Number(factura.total) - totalPagado;
  const editable = factura.estado === 'PENDIENTE' || factura.estado === 'VENCIDA';

  return (
    <Modal titulo={factura.concepto} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
          <p>
            Tenant: <span className="font-medium">{factura.tenant.nombre}</span>
          </p>
          <p>
            Total: RD$ {Number(factura.total).toLocaleString('es-DO')} — Pagado: RD$ {totalPagado.toLocaleString('es-DO')} —
            Pendiente: RD$ {Math.max(pendiente, 0).toLocaleString('es-DO')}
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            Vence: {new Date(factura.fechaVencimiento).toLocaleDateString('es-DO')} — Estado:{' '}
            <Badge tono={TONO_POR_ESTADO[factura.estado]}>{factura.estado}</Badge>
          </p>
        </div>

        {editable && puedeGestionar && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField id="descuento" label="Descuento (RD$)" type="number" min="0" step="0.01" value={descuento} onChange={(e) => setDescuento(e.target.value)} />
              <FormField id="mora" label="Mora (RD$)" type="number" min="0" step="0.01" value={montoMora} onChange={(e) => setMontoMora(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variante="secundario" disabled={guardarEdicion.isPending} onClick={() => guardarEdicion.mutate()} className="flex-1">
                Guardar cambios
              </Button>
              <Button variante="peligro" disabled={anular.isPending} onClick={() => anular.mutate()}>
                Anular
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <hr className="border-slate-200 dark:border-slate-800" />

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Pagos registrados</p>
          <div className="space-y-1">
            {pagos?.pagos.map((pago) => (
              <p key={pago.id} className="text-sm text-slate-600 dark:text-slate-400">
                RD$ {Number(pago.monto).toLocaleString('es-DO')} — {pago.metodoPago}
                {pago.referencia && ` (${pago.referencia})`} — {new Date(pago.fecha).toLocaleDateString('es-DO')}
                {pago.registradoPor && ` — ${pago.registradoPor.nombre}`}
              </p>
            ))}
            {pagos?.pagos.length === 0 && <p className="text-sm text-slate-400">Sin pagos todavía.</p>}
          </div>
        </div>

        {puedeRegistrarPago && pendiente > 0 && factura.estado !== 'ANULADA' && (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Registrar pago</p>
            <div className="grid grid-cols-2 gap-2">
              <FormField id="pago-monto" label="Monto" type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
              <div>
                <label htmlFor="pago-metodo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Método
                </label>
                <Select id="pago-metodo" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as Pago['metodoPago'])}>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta</option>
                </Select>
              </div>
            </div>
            <FormField id="pago-referencia" label="Referencia (opcional)" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            <Button className="w-full" disabled={registrarPago.isPending || !monto} onClick={() => registrarPago.mutate()}>
              {registrarPago.isPending ? 'Registrando…' : 'Registrar pago'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function PlatformFacturas() {
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [facturaAbierta, setFacturaAbierta] = useState<FacturaPlataforma | null>(null);

  const { data: tenants } = useQuery({
    queryKey: ['platform-tenants-lite'],
    queryFn: async () => (await platformApiClient.get<Tenant[]>('/platform/tenants')).data,
  });

  const { data: facturas } = useQuery({
    queryKey: ['platform-facturas', pagina, estado, tenantId],
    queryFn: async () =>
      (
        await platformApiClient.get<PaginaResultado<FacturaPlataforma>>('/platform/facturas', {
          params: { pagina, estado: estado || undefined, tenantId: tenantId || undefined },
        })
      ).data,
  });

  function onSubmitFiltro(e: FormEvent) {
    e.preventDefault();
    setPagina(1);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
      <PlatformHeader titulo="Facturas" />

      <Card
        sinPadding
        titulo="Facturación de plataforma"
        descripcion="Facturas generadas por la suscripción de cada tenant."
        acciones={
          <form onSubmit={onSubmitFiltro} className="flex items-center gap-2">
            <Select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }} className="!w-auto py-1">
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="PAGADA">Pagada</option>
              <option value="VENCIDA">Vencida</option>
              <option value="ANULADA">Anulada</option>
            </Select>
            <Select value={tenantId} onChange={(e) => { setTenantId(e.target.value); setPagina(1); }} className="!w-auto py-1">
              <option value="">Todos los tenants</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Select>
          </form>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Tenant</th>
                <th className="px-5 py-3 font-medium">Concepto</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Vence</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {facturas?.datos.map((factura) => (
                <tr key={factura.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3">{factura.tenant.nombre}</td>
                  <td className="px-5 py-3">{factura.concepto}</td>
                  <td className="px-5 py-3">RD$ {Number(factura.total).toLocaleString('es-DO')}</td>
                  <td className="px-5 py-3">
                    <Badge tono={TONO_POR_ESTADO[factura.estado]}>{factura.estado}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {new Date(factura.fechaVencimiento).toLocaleDateString('es-DO')}
                  </td>
                  <td className="px-5 py-3">
                    <Button variante="secundario" onClick={() => setFacturaAbierta(factura)}>
                      Ver
                    </Button>
                  </td>
                </tr>
              ))}
              {facturas?.datos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    No hay facturas con ese filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {facturas && (
          <div className="px-5 py-3">
            <Paginacion pagina={facturas.pagina} tamanoPagina={facturas.tamanoPagina} total={facturas.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>

      {facturaAbierta && <PanelFactura factura={facturaAbierta} onClose={() => setFacturaAbierta(null)} />}
    </div>
  );
}
