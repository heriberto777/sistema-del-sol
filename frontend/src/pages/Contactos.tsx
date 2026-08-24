import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { FormField } from '../components/molecules/FormField/FormField';
import { SelectField } from '../components/molecules/FormField/SelectField';
import { Modal } from '../components/molecules/Modal/Modal';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { SelectListaPrecio } from '../components/molecules/SelectListaPrecio/SelectListaPrecio';
import { SelectCategoriaCliente } from '../components/molecules/SelectCategoriaCliente/SelectCategoriaCliente';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

type TipoCliente = 'PERSONA_FISICA' | 'PERSONA_JURIDICA';
type ComprobantePorDefecto = 'CONTADO' | 'CREDITO' | 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL';

interface Cliente {
  id: string;
  nombre: string;
  tipo: TipoCliente;
  rncCedula: string | null;
  email: string | null;
  telefono: string | null;
  limiteCredito: string | null;
  listaPrecioId: string | null;
  categoriaId: string | null;
  comprobantePorDefecto: ComprobantePorDefecto | null;
  puntosLealtad: number;
}

interface Proveedor {
  id: string;
  nombre: string;
  rnc: string | null;
  email: string | null;
  telefono: string | null;
}

interface ClienteFormValues {
  nombre: string;
  tipo: TipoCliente;
  rncCedula: string;
  email: string;
  telefono: string;
  limiteCredito: string;
  listaPrecioId: string;
  categoriaId: string;
  comprobantePorDefecto: ComprobantePorDefecto | '';
}

interface ProveedorFormValues {
  nombre: string;
  rnc: string;
  email: string;
  telefono: string;
}

const CLIENTE_VACIO: ClienteFormValues = {
  nombre: '',
  tipo: 'PERSONA_FISICA',
  rncCedula: '',
  email: '',
  telefono: '',
  limiteCredito: '',
  listaPrecioId: '',
  categoriaId: '',
  comprobantePorDefecto: '',
};

const PROVEEDOR_VACIO: ProveedorFormValues = { nombre: '', rnc: '', email: '', telefono: '' };

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

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {(['clientes', 'proveedores'] as const).map((p) => (
          <button
            key={p}
            onClick={() => cambiarPestana(p)}
            className={
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px ' +
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
        <Modal titulo={clienteEditando ? 'Editar cliente' : 'Nuevo cliente'} onClose={cerrarModal}>
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
}: ListaProps<Cliente> & { onVerPuntos: (c: Cliente) => void }) {
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

function FormularioCliente({ cliente, onGuardado }: { cliente: Cliente | null; onGuardado: () => void }) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<ClienteFormValues>(
    cliente
      ? {
          nombre: cliente.nombre,
          tipo: cliente.tipo,
          rncCedula: cliente.rncCedula ?? '',
          email: cliente.email ?? '',
          telefono: cliente.telefono ?? '',
          limiteCredito: cliente.limiteCredito ?? '',
          listaPrecioId: cliente.listaPrecioId ?? '',
          categoriaId: cliente.categoriaId ?? '',
          comprobantePorDefecto: cliente.comprobantePorDefecto ?? '',
        }
      : CLIENTE_VACIO,
  );
  const [error, setError] = useState<string | null>(null);

  function payload() {
    return {
      nombre: valores.nombre,
      tipo: valores.tipo,
      rncCedula: valores.rncCedula || undefined,
      email: valores.email || undefined,
      telefono: valores.telefono || undefined,
      limiteCredito: valores.limiteCredito ? Number(valores.limiteCredito) : undefined,
      listaPrecioId: valores.listaPrecioId || null,
      categoriaId: valores.categoriaId || null,
      comprobantePorDefecto: valores.comprobantePorDefecto || null,
    };
  }

  const guardar = useMutation({
    mutationFn: async () =>
      cliente ? apiClient.patch(`/clientes/${cliente.id}`, payload()) : apiClient.post('/clientes', payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      onGuardado();
    },
    onError: () => setError('No se pudo guardar el cliente. Revisa los datos.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormField
        id="cliente-nombre"
        label="Nombre"
        value={valores.nombre}
        onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
        required
      />
      <SelectField
        id="cliente-tipo"
        label="Tipo"
        value={valores.tipo}
        onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value as TipoCliente }))}
      >
        <option value="PERSONA_FISICA">Persona física</option>
        <option value="PERSONA_JURIDICA">Persona jurídica</option>
      </SelectField>
      <FormField
        id="cliente-rnc"
        label="RNC/Cédula"
        value={valores.rncCedula}
        onChange={(e) => setValores((v) => ({ ...v, rncCedula: e.target.value }))}
      />
      <FormField
        id="cliente-email"
        label="Email"
        type="email"
        value={valores.email}
        onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
      />
      <FormField
        id="cliente-telefono"
        label="Teléfono"
        value={valores.telefono}
        onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
      />
      <FormField
        id="cliente-limite"
        label="Límite de crédito"
        type="number"
        min={0}
        value={valores.limiteCredito}
        onChange={(e) => setValores((v) => ({ ...v, limiteCredito: e.target.value }))}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="cliente-lista-precio" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Nivel de precio
        </label>
        <SelectListaPrecio
          id="cliente-lista-precio"
          value={valores.listaPrecioId}
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
          onChange={(id) => setValores((v) => ({ ...v, categoriaId: id }))}
        />
      </div>
      <SelectField
        id="cliente-comprobante-defecto"
        label="Comprobante fiscal por defecto (opcional)"
        value={valores.comprobantePorDefecto}
        onChange={(e) => setValores((v) => ({ ...v, comprobantePorDefecto: e.target.value as ComprobantePorDefecto | '' }))}
      >
        <option value="">Sin default — elegir cada vez al facturar</option>
        <option value="CONTADO">Contado</option>
        <option value="CREDITO">Crédito</option>
        <option value="REGIMEN_ESPECIAL">Régimen Especial (B14)</option>
        <option value="GUBERNAMENTAL">Gubernamental (B15)</option>
      </SelectField>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={guardar.isPending} className="w-full">
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
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
    };
  }

  const guardar = useMutation({
    mutationFn: async () =>
      proveedor ? apiClient.patch(`/proveedores/${proveedor.id}`, payload()) : apiClient.post('/proveedores', payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      onGuardado();
    },
    onError: () => setError('No se pudo guardar el proveedor. Revisa los datos.'),
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={guardar.isPending} className="w-full">
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}
