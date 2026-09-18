import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Wallet, CalendarClock, AlertTriangle } from 'lucide-react';
import { platformApiClient } from '../lib/platform-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Modal } from '../components/molecules/Modal/Modal';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { StatCard } from '../components/molecules/StatCard/StatCard';
import { PaginaResultado } from '../types/pagina-resultado';
import { usePlatformAuth } from '../hooks/usePlatformAuth';
import { abrirBlob } from '../lib/descargar-archivo';
import { PLANTILLAS_DOCUMENTO, PlantillaDocumento } from '../constants/plantilla-documento';

type EstadoFactura = 'PENDIENTE' | 'PAGADA' | 'VENCIDA' | 'ANULADA';

interface FacturaPlataforma {
  id: string;
  tenant: { id: string; nombre: string };
  concepto: string;
  monto: string;
  descuento: string;
  montoMora: string;
  itbis: string;
  total: string;
  estado: EstadoFactura;
  ncf: string | null;
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

// Subconjunto de PlatformDashboardService.resumen() — el resto de esa respuesta no aplica acá.
interface ResumenPlataforma {
  cartera: {
    totalPendiente: number;
    totalVencido: number;
    cantidadVencidas: number;
    cantidadPendientes: number;
    cobradoEsteMes: number;
    cantidadPagadasEsteMes: number;
  };
}

const fmtRD = (v: number) => `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

const PESTANAS_ESTADO: { estado: EstadoFactura | ''; etiqueta: string }[] = [
  { estado: 'VENCIDA', etiqueta: 'Vencidas' },
  { estado: 'PENDIENTE', etiqueta: 'Pendientes' },
  { estado: 'PAGADA', etiqueta: 'Pagadas' },
  { estado: 'ANULADA', etiqueta: 'Anuladas' },
  { estado: '', etiqueta: 'Todas' },
];

/** Mismo patrón que SegmentadoDensidad en MisTareas.tsx — acá con un contador opcional por pestaña (solo en las que importan para cobranza). */
function PestanasEstado({
  valor,
  onChange,
  contadores,
}: {
  valor: EstadoFactura | '';
  onChange: (v: EstadoFactura | '') => void;
  contadores: Partial<Record<EstadoFactura, number>>;
}) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60">
      {PESTANAS_ESTADO.map((p) => {
        const contador = p.estado ? contadores[p.estado] : undefined;
        return (
          <button
            key={p.estado || 'todas'}
            type="button"
            onClick={() => onChange(p.estado)}
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              valor === p.estado
                ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
            )}
          >
            {p.etiqueta}
            {contador !== undefined && contador > 0 && (
              <span
                className={clsx(
                  'rounded-full px-1.5 py-px text-[10px] font-bold',
                  p.estado === 'VENCIDA' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                )}
              >
                {contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

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
  const [plantilla, setPlantilla] = useState<PlantillaDocumento | ''>('');
  const [mensajeReenvio, setMensajeReenvio] = useState<string | null>(null);

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
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar — revisa que el descuento + mora no superen el monto.')),
  });

  const anular = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/facturas/${factura.id}/anular`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo anular — puede que ya tenga pagos registrados.')),
  });

  const reenviar = useMutation({
    mutationFn: async (canal: 'EMAIL' | 'WHATSAPP') =>
      platformApiClient.post(`/platform/facturas/${factura.id}/reenviar`, { canal, ...(plantilla ? { plantilla } : {}) }),
    onSuccess: () => setMensajeReenvio('Factura reenviada.'),
    onError: (err) => setMensajeReenvio(mensajeErrorApi(err, 'No se pudo reenviar la factura.')),
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
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar el pago — revisa el monto contra el saldo pendiente.')),
  });

  const totalPagado = pagos?.totalPagado ?? 0;
  const pendiente = Number(factura.total) - totalPagado;
  const editable = factura.estado === 'PENDIENTE' || factura.estado === 'VENCIDA';

  async function descargarPdf() {
    const respuesta = await platformApiClient.get(`/platform/facturas/${factura.id}/pdf`, {
      params: plantilla ? { plantilla } : undefined,
      responseType: 'blob',
    });
    abrirBlob(new Blob([respuesta.data], { type: 'application/pdf' }));
  }

  return (
    <Modal titulo={factura.concepto} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          <p>
            Tenant: <span className="font-medium">{factura.tenant.nombre}</span>
          </p>
          <p>
            NCF: <span className="font-mono">{factura.ncf ?? 'Sin NCF asignado'}</span>
          </p>
          {Number(factura.itbis) > 0 && (
            <p className="text-slate-500 dark:text-slate-400">
              Subtotal: RD$ {Number(factura.monto).toLocaleString('es-DO')} — ITBIS: RD$ {Number(factura.itbis).toLocaleString('es-DO')}
            </p>
          )}
          <p>
            Total: RD$ {Number(factura.total).toLocaleString('es-DO')} — Pagado: RD$ {totalPagado.toLocaleString('es-DO')} —
            Pendiente: RD$ {Math.max(pendiente, 0).toLocaleString('es-DO')}
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            Vence: {new Date(factura.fechaVencimiento).toLocaleDateString('es-DO')} — Estado:{' '}
            <Badge tono={TONO_POR_ESTADO[factura.estado]}>{factura.estado}</Badge>
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Diseño</label>
          <Select value={plantilla} onChange={(e) => setPlantilla(e.target.value as PlantillaDocumento | '')}>
            <option value="">Diseño por defecto de Plataforma</option>
            {PLANTILLAS_DOCUMENTO.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <Button variante="secundario" onClick={descargarPdf} className="w-full">
          Descargar PDF
        </Button>

        {puedeGestionar && (
          <div className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Reenviar factura al tenant</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se envía al Admin Total del tenant (email, con el PDF adjunto) o al teléfono de la empresa (WhatsApp, solo resumen).
            </p>
            <div className="flex gap-2">
              <Button variante="secundario" disabled={reenviar.isPending} onClick={() => reenviar.mutate('EMAIL')} className="flex-1">
                {reenviar.isPending ? 'Enviando…' : 'Por email'}
              </Button>
              <Button variante="secundario" disabled={reenviar.isPending} onClick={() => reenviar.mutate('WHATSAPP')} className="flex-1">
                {reenviar.isPending ? 'Enviando…' : 'Por WhatsApp'}
              </Button>
            </div>
            {mensajeReenvio && <p className="text-sm text-slate-600 dark:text-slate-400">{mensajeReenvio}</p>}
          </div>
        )}

        {editable && puedeGestionar && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
  const { tienePermiso } = usePlatformAuth();
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<EstadoFactura | ''>('');
  const [tenantId, setTenantId] = useState('');
  const [facturaAbierta, setFacturaAbierta] = useState<FacturaPlataforma | null>(null);
  const [modalNuevaFactura, setModalNuevaFactura] = useState(false);

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

  // Mismo queryKey que PlatformDashboard.tsx/PlatformTenants.tsx — comparte caché.
  const { data: resumen } = useQuery({
    queryKey: ['platform-dashboard'],
    queryFn: async () => (await platformApiClient.get<ResumenPlataforma>('/platform/dashboard')).data,
  });

  function cambiarEstado(v: EstadoFactura | '') {
    setEstado(v);
    setPagina(1);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Facturas</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          etiqueta="Cobrado este mes"
          valor={resumen ? fmtRD(resumen.cartera.cobradoEsteMes) : '—'}
          variacion={resumen ? `${resumen.cartera.cantidadPagadasEsteMes} factura(s)` : undefined}
          icono={Wallet}
        />
        <StatCard
          etiqueta="Pendiente"
          valor={resumen ? fmtRD(resumen.cartera.totalPendiente) : '—'}
          variacion={resumen ? `${resumen.cartera.cantidadPendientes} factura(s)` : undefined}
          icono={CalendarClock}
        />
        <StatCard
          etiqueta="Vencido"
          valor={resumen ? fmtRD(resumen.cartera.totalVencido) : '—'}
          variacion={resumen ? `${resumen.cartera.cantidadVencidas} factura(s)` : undefined}
          icono={AlertTriangle}
        />
      </div>

      <Card
        sinPadding
        titulo="Facturación de plataforma"
        descripcion="Facturas generadas por la suscripción de cada tenant."
        acciones={
          <div className="flex items-center gap-2">
            <Select value={tenantId} onChange={(e) => { setTenantId(e.target.value); setPagina(1); }} className="!w-auto py-1">
              <option value="">Todos los tenants</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Select>
            {tienePermiso('platform.facturacion.gestionar') && (
              <Button onClick={() => setModalNuevaFactura(true)}>Nueva factura</Button>
            )}
          </div>
        }
      >
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <PestanasEstado
            valor={estado}
            onChange={cambiarEstado}
            contadores={{ VENCIDA: resumen?.cartera.cantidadVencidas, PENDIENTE: resumen?.cartera.cantidadPendientes }}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Tenant</th>
                <th className="px-5 py-3 font-medium">Concepto</th>
                <th className="px-5 py-3 text-right font-medium">Monto</th>
                <th className="px-5 py-3 text-right font-medium">Desc.</th>
                <th className="px-5 py-3 text-right font-medium">ITBIS</th>
                <th className="px-5 py-3 text-right font-medium">Mora</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Vence</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">NCF</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {facturas?.datos.map((factura) => {
                const vencida = factura.estado === 'VENCIDA';
                const resuelta = factura.estado === 'PAGADA' || factura.estado === 'ANULADA';
                return (
                  <tr key={factura.id} className={clsx('hover:bg-slate-50 dark:hover:bg-slate-800/40', resuelta && 'opacity-60')}>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{factura.tenant.nombre}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{factura.concepto}</td>
                    <td className="px-5 py-3 text-right font-mono">{Number(factura.monto).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-3 text-right font-mono">
                      {Number(factura.descuento) > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">-{Number(factura.descuento).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-slate-400">0.00</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {Number(factura.itbis).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-right font-mono">
                      {Number(factura.montoMora) > 0 ? (
                        <span className="text-red-600 dark:text-red-400">{Number(factura.montoMora).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-slate-400">0.00</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      RD$ {Number(factura.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={clsx('px-5 py-3 font-mono text-xs', vencida ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400')}>
                      {new Date(factura.fechaVencimiento).toLocaleDateString('es-DO')}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tono={TONO_POR_ESTADO[factura.estado]}>{factura.estado}</Badge>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{factura.ncf ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-3">
                      <Button variante="secundario" onClick={() => setFacturaAbierta(factura)}>
                        Ver
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {facturas?.datos.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-6 text-center text-slate-400">
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
      {modalNuevaFactura && (
        <ModalNuevaFacturaManual tenants={tenants ?? []} onClose={() => setModalNuevaFactura(false)} />
      )}
    </div>
  );
}

function ModalNuevaFacturaManual({ tenants, onClose }: { tenants: Tenant[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tenantId, setTenantId] = useState('');
  const [lineas, setLineas] = useState<{ concepto: string; monto: string }[]>([{ concepto: '', monto: '' }]);
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [error, setError] = useState<string | null>(null);

  function actualizarLinea(i: number, cambios: Partial<{ concepto: string; monto: string }>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { concepto: '', monto: '' }]);
  }

  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  const crear = useMutation({
    mutationFn: async () =>
      platformApiClient.post('/platform/facturas', {
        tenantId,
        lineas: lineas.map((l) => ({ concepto: l.concepto, monto: Number(l.monto) })),
        fechaVencimiento: fechaVencimiento || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-facturas'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la factura — revisa el tenant y los montos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva factura manual" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="nueva-factura-tenant" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Tenant
          </label>
          <Select id="nueva-factura-tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required>
            <option value="" disabled>
              Selecciona un tenant
            </option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
          {lineas.map((linea, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <FormField
                  id={`linea-concepto-${i}`}
                  label="Concepto"
                  value={linea.concepto}
                  onChange={(e) => actualizarLinea(i, { concepto: e.target.value })}
                  required
                />
              </div>
              <div className="w-32">
                <FormField
                  id={`linea-monto-${i}`}
                  label="Monto"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={linea.monto}
                  onChange={(e) => actualizarLinea(i, { monto: e.target.value })}
                  required
                />
              </div>
              {lineas.length > 1 && (
                <Button type="button" variante="peligro" onClick={() => quitarLinea(i)}>
                  ×
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variante="secundario" onClick={agregarLinea}>
            Agregar línea
          </Button>
        </div>

        <FormField
          id="nueva-factura-vencimiento"
          label="Fecha de vencimiento (opcional)"
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={crear.isPending || !tenantId} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear factura'}
        </Button>
      </form>
    </Modal>
  );
}
