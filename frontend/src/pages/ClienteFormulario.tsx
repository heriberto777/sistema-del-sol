import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { abrirBlob } from '../lib/descargar-archivo';
import { Button } from '../components/atoms/Button/Button';
import { Switch } from '../components/atoms/Switch/Switch';
import { FormField } from '../components/molecules/FormField/FormField';
import { SelectField } from '../components/molecules/FormField/SelectField';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { CardColapsable } from '../components/molecules/CardColapsable/CardColapsable';
import { Tabs } from '../components/molecules/Tabs/Tabs';
import { SelectListaPrecio } from '../components/molecules/SelectListaPrecio/SelectListaPrecio';
import { SelectCategoriaCliente } from '../components/molecules/SelectCategoriaCliente/SelectCategoriaCliente';
import { SelectCategoriaProveedor } from '../components/molecules/SelectCategoriaProveedor/SelectCategoriaProveedor';
import { SelectTerminoPago } from '../components/molecules/SelectTerminoPago/SelectTerminoPago';
import { TimelineClientePanel } from '../components/organisms/TimelineClientePanel/TimelineClientePanel';
import { useHayCambios } from '../hooks/useHayCambios';
import { useAuth } from '../hooks/useAuth';
import type { TipoCliente, TipoComprobanteFiscal, CondicionPago, Cliente } from '../components/molecules/FormularioCliente/FormularioCliente';

export type { Cliente };

interface ClienteFormValues {
  nombre: string;
  tipo: TipoCliente;
  rncCedula: string;
  email: string;
  telefono: string;
  direccion: string;
  nombreContacto: string;
  telefonoSecundario: string;
  limiteCredito: string;
  listaPrecioId: string;
  categoriaId: string;
  comprobanteFiscalPorDefecto: TipoComprobanteFiscal | '';
  condicionPagoPorDefecto: CondicionPago | '';
  plazoPagoDias: string;
  terminoPagoId: string;
  notificacionesEmailHabilitadas: boolean;
  notificacionesWhatsappHabilitadas: boolean;
  // Solo relevantes en modo "crear" — benchmark 2026-11-09 Fase 2 (unificar
  // alta de Cliente/Proveedor), ahora página en vez de modal (Fase 7.2).
  categoriaProveedorId: string;
  plazoPagoDiasProveedor: string;
}

const CLIENTE_VACIO: ClienteFormValues = {
  nombre: '',
  tipo: 'PERSONA_FISICA',
  rncCedula: '',
  email: '',
  telefono: '',
  direccion: '',
  nombreContacto: '',
  telefonoSecundario: '',
  limiteCredito: '',
  listaPrecioId: '',
  categoriaId: '',
  comprobanteFiscalPorDefecto: '',
  condicionPagoPorDefecto: '',
  plazoPagoDias: '30',
  terminoPagoId: '',
  notificacionesEmailHabilitadas: true,
  notificacionesWhatsappHabilitadas: true,
  categoriaProveedorId: '',
  plazoPagoDiasProveedor: '30',
};

interface MovimientoLealtad {
  id: string;
  tipo: 'ACUMULACION' | 'CANJE' | 'EXPIRACION' | 'AJUSTE';
  puntos: number;
  puntosDisponibles: number;
  expiraEn: string | null;
  motivo: string | null;
  anulado: boolean;
  createdAt: string;
}

const ETIQUETA_TIPO_MOVIMIENTO: Record<MovimientoLealtad['tipo'], string> = {
  ACUMULACION: 'Acumulación',
  CANJE: 'Canje',
  EXPIRACION: 'Expiración',
  AJUSTE: 'Ajuste manual',
};

/** Ítem A-3 — historial de puntos de lealtad de un cliente. */
function HistorialLealtadPanel({ cliente }: { cliente: Cliente }) {
  const { data } = useQuery({
    queryKey: ['lealtad-historial', cliente.id],
    queryFn: async () => (await apiClient.get<MovimientoLealtad[]>(`/lealtad/clientes/${cliente.id}/historial`)).data,
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Saldo actual: <span className="font-semibold text-slate-900 dark:text-slate-100">{cliente.puntosLealtad} puntos</span>
      </p>
      {data?.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Sin movimientos de puntos todavía.</p>}
      {data && data.length > 0 && (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Puntos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((m) => (
                <tr key={m.id} className={m.anulado ? 'opacity-50 line-through' : ''}>
                  <td className="px-3 py-2">{new Date(m.createdAt).toLocaleDateString('es-DO')}</td>
                  <td className="px-3 py-2">{ETIQUETA_TIPO_MOVIMIENTO[m.tipo]}</td>
                  <td className="px-3 py-2">{m.puntos > 0 ? `+${m.puntos}` : m.puntos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface LineaEstadoCuenta {
  id: string;
  numero: string | null;
  ncf: string | null;
  tipoFactura: 'CONTADO' | 'CREDITO' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
  fecha: string;
  total: number;
  pagada: boolean;
  saldoPendiente: number;
}

interface EstadoCuentaCliente {
  cliente: { id: string; nombre: string; rncCedula: string | null; email: string | null; telefono: string | null };
  desde: string | null;
  hasta: string | null;
  facturas: LineaEstadoCuenta[];
  totalFacturado: number;
  totalPagado: number;
  saldoPendiente: number;
}

const ETIQUETA_TIPO_FACTURA_EC: Record<LineaEstadoCuenta['tipoFactura'], string> = {
  CONTADO: 'Contado',
  CREDITO: 'Crédito',
  NOTA_CREDITO: 'Nota de crédito',
  NOTA_DEBITO: 'Nota de débito',
};

function formatoMontoEC(n: number): string {
  return `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Todas las facturas del cliente en el período (crédito y contado, pagadas y pendientes) + su saldo actual — a diferencia de Cuentas por Cobrar, que es global y solo lo pendiente. */
function EstadoCuentaClientePanel({ cliente }: { cliente: Cliente }) {
  const [pestana, setPestana] = useState<'resumen' | 'movimientos'>('resumen');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [canal, setCanal] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL');
  const [destinatario, setDestinatario] = useState(cliente.email ?? '');
  const [descargando, setDescargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensajeEnvio, setMensajeEnvio] = useState<string | null>(null);

  const params = { ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) };

  const { data, isLoading } = useQuery({
    queryKey: ['cliente-estado-cuenta', cliente.id, desde, hasta],
    queryFn: async () => (await apiClient.get<EstadoCuentaCliente>(`/clientes/${cliente.id}/estado-cuenta`, { params })).data,
  });

  async function descargarPdf() {
    setDescargando(true);
    try {
      const respuesta = await apiClient.get(`/clientes/${cliente.id}/estado-cuenta/pdf`, { params, responseType: 'blob' });
      abrirBlob(new Blob([respuesta.data], { type: 'application/pdf' }));
    } finally {
      setDescargando(false);
    }
  }

  function elegirCanal(c: 'EMAIL' | 'WHATSAPP') {
    setCanal(c);
    setDestinatario((c === 'EMAIL' ? cliente.email : cliente.telefono) ?? '');
  }

  async function enviar() {
    if (!destinatario.trim()) return;
    setEnviando(true);
    setMensajeEnvio(null);
    try {
      const { data: respuesta } = await apiClient.post<{ enviado: boolean }>(`/clientes/${cliente.id}/estado-cuenta/enviar`, {
        canal,
        destinatario: destinatario.trim(),
        ...params,
      });
      setMensajeEnvio(respuesta.enviado ? 'Estado de cuenta enviado.' : 'No se pudo enviar.');
    } catch (err) {
      setMensajeEnvio(mensajeErrorApi(err, 'No se pudo enviar el estado de cuenta.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField id="ec-desde" label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <FormField id="ec-hasta" label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <Button type="button" variante="secundario" onClick={descargarPdf} disabled={descargando}>
          {descargando ? 'Generando…' : 'Descargar PDF'}
        </Button>
      </div>

      <Tabs
        pestanas={[
          { id: 'resumen', etiqueta: 'Resumen' },
          { id: 'movimientos', etiqueta: 'Movimientos' },
        ]}
        activa={pestana}
        onCambiar={setPestana}
      />

      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}

      {data && pestana === 'resumen' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total facturado</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{formatoMontoEC(data.totalFacturado)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total pagado</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{formatoMontoEC(data.totalPagado)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Saldo pendiente</p>
              <p className={data.saldoPendiente > 0.005 ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold text-emerald-600 dark:text-emerald-400'}>
                {formatoMontoEC(data.saldoPendiente)}
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Enviar</p>
            <div className="flex gap-2">
              {(['EMAIL', 'WHATSAPP'] as const).map((c) => (
                <Button key={c} type="button" variante={canal === c ? 'primario' : 'secundario'} onClick={() => elegirCanal(c)}>
                  {c === 'EMAIL' ? 'Email' : 'WhatsApp'}
                </Button>
              ))}
            </div>
            <input
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder={canal === 'EMAIL' ? 'correo@ejemplo.com' : '8095551234'}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {mensajeEnvio && <p className="text-sm text-slate-600 dark:text-slate-400">{mensajeEnvio}</p>}
            <Button onClick={enviar} disabled={enviando || !destinatario.trim()} className="w-full" variante="secundario">
              {enviando ? 'Enviando…' : 'Enviar'}
            </Button>
          </div>
        </div>
      )}

      {data && pestana === 'movimientos' && (
        <>
          {data.facturas.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin movimientos en el período.</p>
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Número</th>
                    <th className="px-3 py-2 font-medium">NCF</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.facturas.map((f) => (
                    <tr key={f.id}>
                      <td className="px-3 py-2">{new Date(f.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-3 py-2">{ETIQUETA_TIPO_FACTURA_EC[f.tipoFactura]}</td>
                      <td className="px-3 py-2">{f.numero ?? '—'}</td>
                      <td className="px-3 py-2">{f.ncf ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatoMontoEC(f.total)}</td>
                      <td className="px-3 py-2 text-right font-mono">{f.saldoPendiente > 0.005 ? formatoMontoEC(f.saldoPendiente) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function valoresDesdeCliente(c: Cliente): ClienteFormValues {
  return {
    nombre: c.nombre,
    tipo: c.tipo,
    rncCedula: c.rncCedula ?? '',
    email: c.email ?? '',
    telefono: c.telefono ?? '',
    direccion: c.direccion ?? '',
    nombreContacto: c.nombreContacto ?? '',
    telefonoSecundario: c.telefonoSecundario ?? '',
    limiteCredito: c.limiteCredito ?? '',
    listaPrecioId: c.listaPrecioId ?? '',
    categoriaId: c.categoriaId ?? '',
    comprobanteFiscalPorDefecto: c.comprobanteFiscalPorDefecto ?? '',
    condicionPagoPorDefecto: c.condicionPagoPorDefecto ?? '',
    plazoPagoDias: String(c.plazoPagoDias),
    terminoPagoId: c.terminoPagoId ?? '',
    notificacionesEmailHabilitadas: c.notificacionesEmailHabilitadas ?? true,
    notificacionesWhatsappHabilitadas: c.notificacionesWhatsappHabilitadas ?? true,
    categoriaProveedorId: '',
    plazoPagoDiasProveedor: '30',
  };
}

/**
 * Benchmark 2026-11-09 (Fase 7.2) — reemplaza los modales
 * `FormularioCliente`/`FormularioContacto` que vivían en `Clientes.tsx`.
 * Mismo criterio que `ProductoFormulario.tsx` (Fase 7.1): una sola página
 * cubre crear/ver/editar, `soloLectura` deshabilita los controles en modo
 * "ver". Solo el modo "crear" muestra los checkboxes Es cliente/Es
 * proveedor (la Fase 2 del benchmark) — una vez creado, editar un cliente
 * ya existente no permite "convertirlo" en proveedor desde acá (eso crea un
 * registro nuevo en Proveedores, página aparte, Fase 7.3).
 */
export function ClienteFormulario() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tieneModulo, tienePermiso } = useAuth();

  const modo: 'crear' | 'ver' | 'editar' = !id ? 'crear' : location.pathname.endsWith('/editar') ? 'editar' : 'ver';
  const soloLectura = modo === 'ver';
  const puedeVerTimelineCrm = tieneModulo('crm') && tienePermiso('crm.ver');

  const { data: cliente } = useQuery({
    queryKey: ['cliente', id],
    queryFn: async () => (await apiClient.get<Cliente>(`/clientes/${id}`)).data,
    enabled: !!id,
  });

  const [valores, setValores] = useState<ClienteFormValues>(CLIENTE_VACIO);
  const [esCliente, setEsCliente] = useState(true);
  const [esProveedor, setEsProveedor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoColapsada, setInfoColapsada] = useState(false);
  const [ventasColapsada, setVentasColapsada] = useState(false);
  const [proveedorColapsada, setProveedorColapsada] = useState(false);
  const [lealtadColapsada, setLealtadColapsada] = useState(true);
  const [estadoCuentaColapsada, setEstadoCuentaColapsada] = useState(true);
  const [timelineColapsada, setTimelineColapsada] = useState(true);

  useEffect(() => {
    if (cliente) setValores(valoresDesdeCliente(cliente));
  }, [cliente]);

  function payloadCliente() {
    return {
      nombre: valores.nombre,
      tipo: valores.tipo,
      rncCedula: valores.rncCedula || undefined,
      email: valores.email || undefined,
      telefono: valores.telefono || undefined,
      direccion: valores.direccion || undefined,
      nombreContacto: valores.nombreContacto || undefined,
      telefonoSecundario: valores.telefonoSecundario || undefined,
      limiteCredito: valores.limiteCredito ? Number(valores.limiteCredito) : undefined,
      listaPrecioId: valores.listaPrecioId || null,
      categoriaId: valores.categoriaId || null,
      comprobanteFiscalPorDefecto: valores.comprobanteFiscalPorDefecto || null,
      condicionPagoPorDefecto: valores.condicionPagoPorDefecto || null,
      plazoPagoDias: valores.plazoPagoDias ? Number(valores.plazoPagoDias) : undefined,
      terminoPagoId: valores.terminoPagoId || null,
      notificacionesEmailHabilitadas: valores.notificacionesEmailHabilitadas,
      notificacionesWhatsappHabilitadas: valores.notificacionesWhatsappHabilitadas,
    };
  }

  function payloadProveedor() {
    return {
      nombre: valores.nombre,
      rnc: valores.rncCedula || undefined,
      email: valores.email || undefined,
      telefono: valores.telefono || undefined,
      plazoPagoDias: valores.plazoPagoDiasProveedor ? Number(valores.plazoPagoDiasProveedor) : undefined,
      categoriaId: valores.categoriaProveedorId || null,
    };
  }

  const guardar = useMutation({
    mutationFn: async () => {
      if (id) {
        const { data } = await apiClient.patch<Cliente>(`/clientes/${id}`, payloadCliente());
        return { cliente: data };
      }
      const resultado: { cliente?: Cliente; proveedor?: { id: string } } = {};
      if (esCliente) {
        const { data } = await apiClient.post<Cliente>('/clientes', payloadCliente());
        resultado.cliente = data;
      }
      if (esProveedor) {
        const { data } = await apiClient.post('/proveedores', payloadProveedor());
        resultado.proveedor = data;
      }
      return resultado;
    },
    onSuccess: ({ cliente: clienteGuardado }) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', id] });
      confirmarGuardado();
      setTimeout(() => navigate(clienteGuardado ? `/clientes/${clienteGuardado.id}` : '/proveedores'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el contacto. Revisá los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (modo === 'crear' && !esCliente && !esProveedor) {
      setError('Marcá al menos una opción (Es cliente / Es proveedor).');
      return;
    }
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ valores, esCliente, esProveedor }, modo !== 'ver' && (!id || !!cliente));

  const titulo = modo === 'crear' ? 'Nuevo contacto' : modo === 'editar' ? 'Editar cliente' : valores.nombre || 'Cliente';

  return (
    <PaginaDocumento
      titulo={titulo}
      rutaVolver="/clientes"
      etiquetaVolver="Volver a Clientes"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">RNC/Cédula</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{valores.rncCedula || '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Puntos de lealtad</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cliente?.puntosLealtad ?? 0}</span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {soloLectura ? (
            <Button type="button" className="w-full" onClick={() => navigate(`/clientes/${id}/editar`)}>
              Editar
            </Button>
          ) : (
            <Button type="submit" form="form-cliente" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          )}
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(id ? `/clientes/${id}` : '/clientes')}>
            {soloLectura ? 'Volver' : 'Cancelar'}
          </Button>
        </>
      }
    >
      <form id="form-cliente" onSubmit={onSubmit} className="space-y-4">
        {modo === 'crear' && (
          <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={esCliente} onChange={(e) => setEsCliente(e.target.checked)} className="rounded border-slate-300" />
              Es cliente — le facturás
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={esProveedor} onChange={(e) => setEsProveedor(e.target.checked)} className="rounded border-slate-300" />
              Es proveedor — le comprás
            </label>
          </div>
        )}
        {modo === 'crear' && !esCliente && !esProveedor && (
          <p className="text-sm text-amber-600 dark:text-amber-400">Marcá al menos una opción.</p>
        )}

        <CardColapsable
          titulo="Información general"
          colapsada={infoColapsada}
          onToggle={() => setInfoColapsada((v) => !v)}
          resumen={`${valores.nombre || 'Sin nombre'} · ${valores.rncCedula || 'sin RNC/cédula'}`}
        >
          <div className="sm:col-span-2">
            <FormField
              id="cliente-nombre"
              label="Nombre"
              value={valores.nombre}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
              required
            />
          </div>
          <SelectField
            id="cliente-tipo"
            label="Tipo"
            value={valores.tipo}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value as TipoCliente }))}
          >
            <option value="PERSONA_FISICA">Persona física</option>
            <option value="PERSONA_JURIDICA">Persona jurídica</option>
          </SelectField>
          <FormField
            id="cliente-rnc"
            label="RNC/Cédula"
            value={valores.rncCedula}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, rncCedula: e.target.value }))}
          />
          <FormField
            id="cliente-email"
            label="Email"
            type="email"
            value={valores.email}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
          />
          <FormField
            id="cliente-telefono"
            label="Teléfono"
            value={valores.telefono}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
          />
          <FormField
            id="cliente-telefono-secundario"
            label="Teléfono secundario (opcional)"
            value={valores.telefonoSecundario}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, telefonoSecundario: e.target.value }))}
          />
          <FormField
            id="cliente-contacto"
            label="Nombre de contacto (opcional)"
            value={valores.nombreContacto}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, nombreContacto: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <FormField
              id="cliente-direccion"
              label="Dirección (opcional)"
              value={valores.direccion}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, direccion: e.target.value }))}
            />
          </div>
        </CardColapsable>

        <CardColapsable
          titulo="Ventas y crédito"
          colapsada={ventasColapsada}
          onToggle={() => setVentasColapsada((v) => !v)}
          resumen="Límite de crédito, nivel de precio, comprobante fiscal y notificaciones"
        >
          <FormField
            id="cliente-limite"
            label="Límite de crédito"
            type="number"
            min={0}
            value={valores.limiteCredito}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, limiteCredito: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="cliente-lista-precio" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nivel de precio
            </label>
            <SelectListaPrecio
              id="cliente-lista-precio"
              value={valores.listaPrecioId}
              disabled={soloLectura}
              onChange={(id) => setValores((v) => ({ ...v, listaPrecioId: id }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cliente-categoria" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Categoría (segmentación, opcional)
            </label>
            <SelectCategoriaCliente
              id="cliente-categoria"
              value={valores.categoriaId}
              disabled={soloLectura}
              onChange={(id) => setValores((v) => ({ ...v, categoriaId: id }))}
            />
          </div>
          <SelectField
            id="cliente-comprobante-fiscal"
            label="Comprobante fiscal por defecto (opcional)"
            value={valores.comprobanteFiscalPorDefecto}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, comprobanteFiscalPorDefecto: e.target.value as TipoComprobanteFiscal | '' }))}
          >
            <option value="">Sin default — elegir cada vez al facturar</option>
            <option value="CONSUMO">Consumo (B02)</option>
            <option value="CREDITO_FISCAL">Crédito Fiscal (B01)</option>
            <option value="REGIMEN_ESPECIAL">Régimen Especial (B14)</option>
            <option value="GUBERNAMENTAL">Gubernamental (B15)</option>
          </SelectField>
          <SelectField
            id="cliente-condicion-pago"
            label="Opción de pago por defecto (opcional)"
            value={valores.condicionPagoPorDefecto}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, condicionPagoPorDefecto: e.target.value as CondicionPago | '' }))}
          >
            <option value="">Sin default — elegir cada vez al facturar</option>
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </SelectField>
          <FormField
            id="cliente-plazo-pago"
            label="Días de crédito"
            type="number"
            min={1}
            value={valores.plazoPagoDias}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, plazoPagoDias: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="cliente-termino-pago" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Término de pago (opcional)
            </label>
            <SelectTerminoPago
              id="cliente-termino-pago"
              aplicaA="CLIENTE"
              value={valores.terminoPagoId}
              disabled={soloLectura}
              onChange={(id) => setValores((v) => ({ ...v, terminoPagoId: id }))}
            />
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 sm:col-span-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Notificar automáticamente</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-300">Email</span>
              <Switch
                activo={valores.notificacionesEmailHabilitadas}
                disabled={soloLectura}
                onChange={(valor) => setValores((v) => ({ ...v, notificacionesEmailHabilitadas: valor }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-300">WhatsApp</span>
              <Switch
                activo={valores.notificacionesWhatsappHabilitadas}
                disabled={soloLectura}
                onChange={(valor) => setValores((v) => ({ ...v, notificacionesWhatsappHabilitadas: valor }))}
              />
            </div>
          </div>
        </CardColapsable>

        {modo !== 'crear' && cliente && (
          <>
            <CardColapsable
              titulo="Historial de puntos de lealtad"
              colapsada={lealtadColapsada}
              onToggle={() => setLealtadColapsada((v) => !v)}
              resumen={`${cliente.puntosLealtad} puntos disponibles`}
            >
              <div className="sm:col-span-2">
                <HistorialLealtadPanel cliente={cliente} />
              </div>
            </CardColapsable>

            <CardColapsable
              titulo="Estado de cuenta"
              colapsada={estadoCuentaColapsada}
              onToggle={() => setEstadoCuentaColapsada((v) => !v)}
              resumen="Facturas, pagos y saldo pendiente"
            >
              <div className="sm:col-span-2">
                <EstadoCuentaClientePanel cliente={cliente} />
              </div>
            </CardColapsable>

            {puedeVerTimelineCrm && (
              <CardColapsable
                titulo="Timeline / actividad CRM"
                colapsada={timelineColapsada}
                onToggle={() => setTimelineColapsada((v) => !v)}
                resumen="WhatsApp, cotizaciones, facturas y lealtad en un solo feed"
              >
                <div className="sm:col-span-2">
                  <TimelineClientePanel clienteId={cliente.id} />
                </div>
              </CardColapsable>
            )}
          </>
        )}

        {modo === 'crear' && esProveedor && (
          <CardColapsable
            titulo="Datos de proveedor"
            colapsada={proveedorColapsada}
            onToggle={() => setProveedorColapsada((v) => !v)}
            resumen="Categoría y plazo de pago como proveedor"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="cliente-categoria-proveedor" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Categoría de proveedor (opcional)
              </label>
              <SelectCategoriaProveedor
                id="cliente-categoria-proveedor"
                value={valores.categoriaProveedorId}
                onChange={(id) => setValores((v) => ({ ...v, categoriaProveedorId: id }))}
              />
            </div>
            <FormField
              id="cliente-plazo-pago-proveedor"
              label="Días de pago que te da"
              type="number"
              min={1}
              value={valores.plazoPagoDiasProveedor}
              onChange={(e) => setValores((v) => ({ ...v, plazoPagoDiasProveedor: e.target.value }))}
            />
          </CardColapsable>
        )}
      </form>
    </PaginaDocumento>
  );
}
