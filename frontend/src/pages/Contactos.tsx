import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { Tabs } from '../components/molecules/Tabs/Tabs';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { FormularioCliente, type Cliente } from '../components/molecules/FormularioCliente/FormularioCliente';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';
import { abrirBlob } from '../lib/descargar-archivo';

interface Proveedor {
  id: string;
  nombre: string;
  rnc: string | null;
  email: string | null;
  telefono: string | null;
  plazoPagoDias: number;
}

interface ProveedorFormValues {
  nombre: string;
  rnc: string;
  email: string;
  telefono: string;
  plazoPagoDias: string;
}

const PROVEEDOR_VACIO: ProveedorFormValues = { nombre: '', rnc: '', email: '', telefono: '', plazoPagoDias: '30' };

type Pestana = 'clientes' | 'proveedores';

export function Contactos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pestana, setPestana] = useState<Pestana>('clientes');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [proveedorEditando, setProveedorEditando] = useState<Proveedor | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [clientePuntos, setClientePuntos] = useState<Cliente | null>(null);
  const [clienteEstadoCuenta, setClienteEstadoCuenta] = useState<Cliente | null>(null);

  useEffect(() => {
    const crear = searchParams.get('crear');
    if (crear === 'cliente' || crear === 'proveedor') {
      setPestana(crear === 'cliente' ? 'clientes' : 'proveedores');
      setClienteEditando(null);
      setProveedorEditando(null);
      setModalAbierto(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarPestana(p: Pestana) {
    setPestana(p);
    setBusqueda('');
    setPagina(1);
  }

  function abrirNuevo() {
    setClienteEditando(null);
    setProveedorEditando(null);
    setModalAbierto(true);
  }

  function abrirEditarCliente(c: Cliente) {
    setClienteEditando(c);
    setModalAbierto(true);
  }

  function abrirEditarProveedor(p: Proveedor) {
    setProveedorEditando(p);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setClienteEditando(null);
    setProveedorEditando(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Contactos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Clientes a los que facturás y proveedores a los que les comprás.</p>
        </div>
        <Button onClick={abrirNuevo}>{pestana === 'clientes' ? 'Nuevo cliente' : 'Nuevo proveedor'}</Button>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {(['clientes', 'proveedores'] as const).map((p) => (
          <button
            key={p}
            onClick={() => cambiarPestana(p)}
            className={
              'shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 -mb-px ' +
              (pestana === p
                ? 'border-sol-500 text-sol-700 dark:text-sol-300'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400')
            }
          >
            {p === 'clientes' ? 'Clientes' : 'Proveedores'}
          </button>
        ))}
      </div>

      {pestana === 'clientes' ? (
        <RequierePermiso permiso="clientes.ver">
          <ListaClientes
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            pagina={pagina}
            setPagina={setPagina}
            busquedaDebounced={busquedaDebounced}
            onEditar={abrirEditarCliente}
            onNuevo={abrirNuevo}
            onVerPuntos={setClientePuntos}
            onVerEstadoCuenta={setClienteEstadoCuenta}
          />
        </RequierePermiso>
      ) : (
        <RequierePermiso permiso="compras.ver">
          <ListaProveedores
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            pagina={pagina}
            setPagina={setPagina}
            busquedaDebounced={busquedaDebounced}
            onEditar={abrirEditarProveedor}
            onNuevo={abrirNuevo}
          />
        </RequierePermiso>
      )}

      {modalAbierto && pestana === 'clientes' && (
        <Modal titulo={clienteEditando ? 'Editar cliente' : 'Nuevo cliente'} onClose={cerrarModal} ancho="xl">
          <FormularioCliente cliente={clienteEditando} onGuardado={cerrarModal} />
        </Modal>
      )}
      {modalAbierto && pestana === 'proveedores' && (
        <Modal titulo={proveedorEditando ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={cerrarModal}>
          <FormularioProveedor proveedor={proveedorEditando} onGuardado={cerrarModal} />
        </Modal>
      )}
      {clientePuntos && (
        <Modal titulo={`Historial de puntos — ${clientePuntos.nombre}`} onClose={() => setClientePuntos(null)}>
          <HistorialLealtadModal cliente={clientePuntos} />
        </Modal>
      )}
      {clienteEstadoCuenta && (
        <Modal titulo={`Estado de cuenta — ${clienteEstadoCuenta.nombre}`} onClose={() => setClienteEstadoCuenta(null)} ancho="xl">
          <ModalEstadoCuentaCliente cliente={clienteEstadoCuenta} />
        </Modal>
      )}
    </div>
  );
}

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
function HistorialLealtadModal({ cliente }: { cliente: Cliente }) {
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
function ModalEstadoCuentaCliente({ cliente }: { cliente: Cliente }) {
  // Resumen (filtros+totales+envío) vs. Movimientos (la tabla, que antes vivía forzada a max-h-72 dentro del mismo bloque).
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
            // Antes max-h-72 (18rem) compartiendo espacio con el resumen y "Enviar" en el mismo bloque — con su propia pestaña, la tabla puede usar bastante más alto.
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

interface ListaProps<T> {
  busqueda: string;
  setBusqueda: (v: string) => void;
  pagina: number;
  setPagina: (v: number) => void;
  busquedaDebounced: string;
  onEditar: (item: T) => void;
  onNuevo: () => void;
}

function ListaClientes({
  busqueda,
  setBusqueda,
  pagina,
  setPagina,
  busquedaDebounced,
  onEditar,
  onNuevo,
  onVerPuntos,
  onVerEstadoCuenta,
}: ListaProps<Cliente> & { onVerPuntos: (c: Cliente) => void; onVerEstadoCuenta: (c: Cliente) => void }) {
  const { data } = useQuery({
    queryKey: ['clientes', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Cliente>>('/clientes', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      {data?.datos.length === 0 ? (
        <>
          <SearchInput
            value={busqueda}
            onChange={(v) => {
              setBusqueda(v);
              setPagina(1);
            }}
            placeholder="Buscar por nombre, email o RNC/cédula…"
          />
          <EstadoVacio
            titulo="Todavía no hay clientes"
            descripcion="Creá el primero para empezar a facturarle."
            etiquetaAccion="Nuevo cliente"
            onAccion={onNuevo}
          />
        </>
      ) : (
        <Card
          sinPadding
          titulo="Clientes"
          descripcion={data ? `${data.total} cliente(s)` : undefined}
          acciones={
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por nombre, email o RNC/cédula…"
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">RNC/Cédula</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Teléfono</th>
                  <th className="px-5 py-3 font-medium">Puntos</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.datos.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{cliente.nombre}</td>
                    <td className="px-5 py-3">{cliente.rncCedula ?? '—'}</td>
                    <td className="px-5 py-3">{cliente.email ?? '—'}</td>
                    <td className="px-5 py-3">{cliente.telefono ?? '—'}</td>
                    <td className="px-5 py-3">{cliente.puntosLealtad}</td>
                    <td className="px-5 py-3 text-right">
                      <RowActionsMenu
                        acciones={[
                          { etiqueta: 'Editar', onClick: () => onEditar(cliente) },
                          { etiqueta: 'Ver historial de puntos', onClick: () => onVerPuntos(cliente) },
                          { etiqueta: 'Estado de cuenta', onClick: () => onVerEstadoCuenta(cliente) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && (
            <div className="px-5 py-3">
              <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ListaProveedores({ busqueda, setBusqueda, pagina, setPagina, busquedaDebounced, onEditar, onNuevo }: ListaProps<Proveedor>) {
  const { data } = useQuery({
    queryKey: ['proveedores', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Proveedor>>('/proveedores', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      {data?.datos.length === 0 ? (
        <>
          <SearchInput
            value={busqueda}
            onChange={(v) => {
              setBusqueda(v);
              setPagina(1);
            }}
            placeholder="Buscar por nombre o RNC…"
          />
          <EstadoVacio
            titulo="Todavía no hay proveedores"
            descripcion="Creá el primero para poder registrar órdenes de compra."
            etiquetaAccion="Nuevo proveedor"
            onAccion={onNuevo}
          />
        </>
      ) : (
        <Card
          sinPadding
          titulo="Proveedores"
          descripcion={data ? `${data.total} proveedor(es)` : undefined}
          acciones={
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por nombre o RNC…"
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">RNC</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Teléfono</th>
                  <th className="px-5 py-3 font-medium">Plazo de pago</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.datos.map((proveedor) => (
                  <tr key={proveedor.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{proveedor.nombre}</td>
                    <td className="px-5 py-3">{proveedor.rnc ?? '—'}</td>
                    <td className="px-5 py-3">{proveedor.email ?? '—'}</td>
                    <td className="px-5 py-3">{proveedor.telefono ?? '—'}</td>
                    <td className="px-5 py-3">{proveedor.plazoPagoDias} días</td>
                    <td className="px-5 py-3 text-right">
                      <RowActionsMenu acciones={[{ etiqueta: 'Editar', onClick: () => onEditar(proveedor) }]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && (
            <div className="px-5 py-3">
              <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function FormularioProveedor({ proveedor, onGuardado }: { proveedor: Proveedor | null; onGuardado: () => void }) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<ProveedorFormValues>(
    proveedor
      ? {
          nombre: proveedor.nombre,
          rnc: proveedor.rnc ?? '',
          email: proveedor.email ?? '',
          telefono: proveedor.telefono ?? '',
          plazoPagoDias: String(proveedor.plazoPagoDias),
        }
      : PROVEEDOR_VACIO,
  );
  const [error, setError] = useState<string | null>(null);

  function payload() {
    return {
      nombre: valores.nombre,
      rnc: valores.rnc || undefined,
      email: valores.email || undefined,
      telefono: valores.telefono || undefined,
      plazoPagoDias: valores.plazoPagoDias ? Number(valores.plazoPagoDias) : undefined,
    };
  }

  const guardar = useMutation({
    mutationFn: async () =>
      proveedor ? apiClient.patch(`/proveedores/${proveedor.id}`, payload()) : apiClient.post('/proveedores', payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      onGuardado();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el proveedor. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormField
        id="proveedor-nombre"
        label="Nombre"
        value={valores.nombre}
        onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
        required
      />
      <FormField
        id="proveedor-rnc"
        label="RNC"
        value={valores.rnc}
        onChange={(e) => setValores((v) => ({ ...v, rnc: e.target.value }))}
      />
      <FormField
        id="proveedor-email"
        label="Email"
        type="email"
        value={valores.email}
        onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
      />
      <FormField
        id="proveedor-telefono"
        label="Teléfono"
        value={valores.telefono}
        onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
      />
      <FormField
        id="proveedor-plazo-pago"
        label="Plazo de pago (días)"
        type="number"
        min={1}
        value={valores.plazoPagoDias}
        onChange={(e) => setValores((v) => ({ ...v, plazoPagoDias: e.target.value }))}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button type="submit" disabled={guardar.isPending} className="w-full">
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}
