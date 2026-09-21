import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { ConfirmModal } from '../components/molecules/ConfirmModal/ConfirmModal';
import { Tabs } from '../components/molecules/Tabs/Tabs';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { GaleriaImagenes } from '../components/molecules/GaleriaImagenes/GaleriaImagenes';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';
import {
  AMENIDADES_SUGERIDAS,
  AgenteOpcion,
  ESTADOS_PROPIEDAD,
  ESTADOS_PROPIEDAD_CERRABLE,
  ETIQUETA_ESTADO_PROPIEDAD,
  ETIQUETA_OPERACION_PROPIEDAD,
  ETIQUETA_TIPO_PROPIEDAD,
  OPERACIONES_PROPIEDAD,
  Propiedad,
  TIPOS_PROPIEDAD,
} from '../types/inmobiliaria';

interface ClienteOpcion {
  id: string;
  nombre: string;
}

interface FormContrato {
  clienteId: string;
  monto: string;
  moneda: string;
  agenteId: string;
  porcentajeComision: string;
  notas: string;
}

function ContratoFormModal({
  propiedad,
  agentes,
  clientes,
  guardando,
  error,
  onClose,
  onGuardar,
}: {
  propiedad: Propiedad;
  agentes: AgenteOpcion[] | undefined;
  clientes: ClienteOpcion[] | undefined;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onGuardar: (form: FormContrato) => void;
}) {
  const [form, setForm] = useState<FormContrato>({
    clienteId: '',
    monto: propiedad.precio,
    moneda: propiedad.moneda,
    agenteId: propiedad.agenteId ?? '',
    porcentajeComision: '',
    notas: '',
  });

  const montoComisionEstimada = form.porcentajeComision ? (Number(form.monto || 0) * Number(form.porcentajeComision)) / 100 : 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar(form);
  }

  return (
    <Modal titulo={`Cerrar negocio — ${propiedad.titulo}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          Al confirmar, la propiedad pasa a{' '}
          <b>{propiedad.operacion === 'ALQUILER' ? 'Alquilada' : 'Vendida'}</b> y sale del catálogo público.
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente ({propiedad.operacion === 'ALQUILER' ? 'inquilino' : 'comprador'})</label>
          <Select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} required>
            <option value="">Elegí un cliente…</option>
            {clientes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Monto acordado</label>
            <div className="flex">
              <Select className="!w-auto rounded-r-none border-r-0" value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                <option value="USD">US$</option>
                <option value="DOP">RD$</option>
              </Select>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                className="w-full rounded-r-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <FormField
            id="contrato-comision-pct"
            label="% de comisión (opcional)"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={form.porcentajeComision}
            onChange={(e) => setForm({ ...form, porcentajeComision: e.target.value })}
          />
        </div>

        {form.porcentajeComision && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Comisión estimada: {form.moneda === 'DOP' ? 'RD$' : 'US$'} {montoComisionEstimada.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Agente que gestionó el cierre</label>
          <Select value={form.agenteId} onChange={(e) => setForm({ ...form, agenteId: e.target.value })}>
            <option value="">Sin asignar</option>
            {agentes?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas (opcional)</label>
          <textarea
            rows={2}
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Confirmar cierre'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Modelo 3 — crea el Proyecto de preventa (plugin Proyectos) y lo vincula a la propiedad. Los pagos del plan se cargan después como hitos en /proyectos/:id. */
function IniciarPreventaModal({
  propiedad,
  clientes,
  guardando,
  error,
  onClose,
  onGuardar,
}: {
  propiedad: Propiedad;
  clientes: ClienteOpcion[] | undefined;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onGuardar: (clienteId: string) => void;
}) {
  const [clienteId, setClienteId] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar(clienteId);
  }

  return (
    <Modal titulo={`Iniciar preventa — ${propiedad.titulo}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Se crea un Proyecto (plugin Proyectos) a nombre del comprador — ahí cargás cada pago del plan como un hito y
          los facturás a medida que se cumplen. La propiedad pasa a <b>Reservada</b> y sale del catálogo público.
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente comprador</label>
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
            <option value="">Elegí un cliente…</option>
            {clientes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Creando…' : 'Iniciar preventa'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const TONO_ESTADO: Record<string, 'exito' | 'advertencia' | 'neutro'> = {
  ACTIVA: 'exito',
  RESERVADA: 'advertencia',
  PAUSADA: 'neutro',
  VENDIDA: 'neutro',
  ALQUILADA: 'neutro',
};

interface FormPropiedad {
  codigo: string;
  titulo: string;
  tipo: string;
  operacion: string;
  estado: string;
  precio: string;
  moneda: string;
  ubicacion: string;
  habitaciones: string;
  banos: string;
  parqueos: string;
  metrosConstruccion: string;
  metrosTerreno: string;
  descripcion: string;
  amenidades: string[];
  agenteId: string;
  propietarioId: string;
  imagenes: string[];
}

const FORM_VACIO: FormPropiedad = {
  codigo: '',
  titulo: '',
  tipo: 'APARTAMENTO',
  operacion: 'VENTA',
  estado: 'ACTIVA',
  precio: '',
  moneda: 'USD',
  ubicacion: '',
  habitaciones: '',
  banos: '',
  parqueos: '',
  metrosConstruccion: '',
  metrosTerreno: '',
  descripcion: '',
  amenidades: [],
  agenteId: '',
  propietarioId: '',
  imagenes: [],
};

function formDesdePropiedad(p: Propiedad): FormPropiedad {
  return {
    codigo: p.codigo,
    titulo: p.titulo,
    tipo: p.tipo,
    operacion: p.operacion,
    estado: p.estado,
    precio: p.precio,
    moneda: p.moneda,
    ubicacion: p.ubicacion,
    habitaciones: p.habitaciones?.toString() ?? '',
    banos: p.banos ?? '',
    parqueos: p.parqueos?.toString() ?? '',
    metrosConstruccion: p.metrosConstruccion ?? '',
    metrosTerreno: p.metrosTerreno ?? '',
    descripcion: p.descripcion ?? '',
    amenidades: p.amenidades,
    agenteId: p.agenteId ?? '',
    propietarioId: p.propietarioId ?? '',
    imagenes: p.imagenes.map((i) => i.imagen),
  };
}

function dtoDesdeForm(form: FormPropiedad) {
  return {
    codigo: form.codigo,
    titulo: form.titulo,
    tipo: form.tipo,
    operacion: form.operacion,
    estado: form.estado,
    precio: Number(form.precio),
    moneda: form.moneda,
    ubicacion: form.ubicacion,
    habitaciones: form.habitaciones ? Number(form.habitaciones) : undefined,
    banos: form.banos ? Number(form.banos) : undefined,
    parqueos: form.parqueos ? Number(form.parqueos) : undefined,
    metrosConstruccion: form.metrosConstruccion ? Number(form.metrosConstruccion) : undefined,
    metrosTerreno: form.metrosTerreno ? Number(form.metrosTerreno) : undefined,
    descripcion: form.descripcion || undefined,
    amenidades: form.amenidades,
    agenteId: form.agenteId || undefined,
    propietarioId: form.propietarioId || undefined,
    imagenes: form.imagenes.map((imagen) => ({ imagen })),
  };
}

function PropiedadFormModal({
  titulo,
  propiedadInicial,
  agentes,
  clientes,
  guardando,
  error,
  onClose,
  onGuardar,
}: {
  titulo: string;
  propiedadInicial?: Propiedad;
  agentes: AgenteOpcion[] | undefined;
  clientes: ClienteOpcion[] | undefined;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onGuardar: (form: FormPropiedad) => void;
}) {
  const [form, setForm] = useState<FormPropiedad>(propiedadInicial ? formDesdePropiedad(propiedadInicial) : FORM_VACIO);
  // 18 campos mezclando datos comerciales + descripción + amenidades — las fotos quedan aparte, en su propia columna (igual criterio que el panel lateral de notas de Proyectos/Mis Tareas).
  const [pestana, setPestana] = useState<'general' | 'descripcion'>('general');

  function alternarAmenidad(nombre: string) {
    setForm((actual) => ({
      ...actual,
      amenidades: actual.amenidades.includes(nombre) ? actual.amenidades.filter((a) => a !== nombre) : [...actual.amenidades, nombre],
    }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar(form);
  }

  return (
    <Modal titulo={titulo} onClose={onClose} ancho="xl">
      <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <Tabs
            pestanas={[
              { id: 'general', etiqueta: 'Datos generales' },
              { id: 'descripcion', etiqueta: 'Descripción y amenidades' },
            ]}
            activa={pestana}
            onCambiar={setPestana}
          />

          {pestana === 'general' && (
          <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="prop-titulo" label="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
            <FormField id="prop-codigo" label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
              <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS_PROPIEDAD.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_TIPO_PROPIEDAD[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Operación</label>
              <Select value={form.operacion} onChange={(e) => setForm({ ...form, operacion: e.target.value })}>
                {OPERACIONES_PROPIEDAD.map((o) => (
                  <option key={o} value={o}>
                    {ETIQUETA_OPERACION_PROPIEDAD[o]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado</label>
              <Select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS_PROPIEDAD.map((es) => (
                  <option key={es} value={es}>
                    {ETIQUETA_ESTADO_PROPIEDAD[es]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Precio</label>
              <div className="flex">
                <Select
                  className="!w-auto rounded-r-none border-r-0"
                  value={form.moneda}
                  onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                >
                  <option value="USD">US$</option>
                  <option value="DOP">RD$</option>
                </Select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                  className="w-full rounded-r-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <FormField id="prop-ubicacion" label="Ubicación" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <FormField id="prop-habitaciones" label="Habitaciones" type="number" min="0" value={form.habitaciones} onChange={(e) => setForm({ ...form, habitaciones: e.target.value })} />
            <FormField id="prop-banos" label="Baños" type="number" min="0" step="0.5" value={form.banos} onChange={(e) => setForm({ ...form, banos: e.target.value })} />
            <FormField id="prop-parqueos" label="Parqueos" type="number" min="0" value={form.parqueos} onChange={(e) => setForm({ ...form, parqueos: e.target.value })} />
            <FormField id="prop-metros" label="m² construcción" type="number" min="0" value={form.metrosConstruccion} onChange={(e) => setForm({ ...form, metrosConstruccion: e.target.value })} />
          </div>

          <FormField
            id="prop-metros-terreno"
            label="m² de terreno (opcional — solares/fincas)"
            type="number"
            min="0"
            value={form.metrosTerreno}
            onChange={(e) => setForm({ ...form, metrosTerreno: e.target.value })}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Agente asignado</label>
              <Select value={form.agenteId} onChange={(e) => setForm({ ...form, agenteId: e.target.value })}>
                <option value="">Sin asignar</option>
                {agentes?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Propietario (si la agencia administra el alquiler)</label>
              <Select value={form.propietarioId} onChange={(e) => setForm({ ...form, propietarioId: e.target.value })}>
                <option value="">Sin propietario asignado</option>
                {clientes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          </div>
          )}

          {pestana === 'descripcion' && (
          <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción</label>
            <textarea
              rows={7}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Amenidades</label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
              {AMENIDADES_SUGERIDAS.map((a) => (
                <label key={a} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={form.amenidades.includes(a)} onChange={() => alternarAmenidad(a)} className="rounded border-slate-300" />
                  {a}
                </label>
              ))}
            </div>
          </div>
          </div>
          )}
        </div>

        <div>
          <GaleriaImagenes label="Fotos" valores={form.imagenes} onChange={(imagenes) => setForm({ ...form, imagenes })} />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 md:col-span-3">{error}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 md:col-span-3">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar propiedad'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Propiedades() {
  const { usuario, tienePermiso } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [filtroOperacion, setFiltroOperacion] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [propiedadEditando, setPropiedadEditando] = useState<Propiedad | null>(null);
  const [propiedadAEliminar, setPropiedadAEliminar] = useState<Propiedad | null>(null);
  const [propiedadACerrar, setPropiedadACerrar] = useState<Propiedad | null>(null);
  const [propiedadAPreventa, setPropiedadAPreventa] = useState<Propiedad | null>(null);
  const [propiedadADesvincularPreventa, setPropiedadADesvincularPreventa] = useState<Propiedad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const puedeCerrarNegocio = tienePermiso('inmobiliaria.contratos.crear');
  const puedeEditarPropiedad = tienePermiso('inmobiliaria.propiedades.editar');
  const puedeEliminarPropiedad = tienePermiso('inmobiliaria.propiedades.eliminar');
  const puedeCrearPreventa = tienePermiso('inmobiliaria.preventas.crear');

  useEffect(() => setPagina(1), [busquedaDebounced, filtroOperacion, filtroTipo]);

  const { data, isLoading } = useQuery({
    queryKey: ['propiedades', pagina, busquedaDebounced, filtroOperacion, filtroTipo],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Propiedad>>('/admin/inmobiliaria/propiedades', {
          params: { pagina, busqueda: busquedaDebounced || undefined, operacion: filtroOperacion || undefined, tipo: filtroTipo || undefined },
        })
      ).data,
  });

  const { data: agentes } = useQuery({
    queryKey: ['inmobiliaria-agentes-opciones'],
    queryFn: async () => (await apiClient.get<AgenteOpcion[]>('/admin/inmobiliaria/propiedades/agentes')).data,
    enabled: modalAbierto || !!propiedadEditando || !!propiedadACerrar,
  });

  const { data: clientes } = useQuery({
    queryKey: ['clientes-opciones'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ClienteOpcion>>('/clientes', { params: { tamanoPagina: 200 } })).data.datos,
    enabled: modalAbierto || !!propiedadEditando || !!propiedadACerrar || !!propiedadAPreventa,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['propiedades'] });

  const crear = useMutation({
    mutationFn: async (form: FormPropiedad) => apiClient.post('/admin/inmobiliaria/propiedades', dtoDesdeForm(form)),
    onSuccess: () => {
      setModalAbierto(false);
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la propiedad.')),
  });

  const actualizar = useMutation({
    mutationFn: async (form: FormPropiedad) => apiClient.patch(`/admin/inmobiliaria/propiedades/${propiedadEditando?.id}`, dtoDesdeForm(form)),
    onSuccess: () => {
      setPropiedadEditando(null);
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la propiedad.')),
  });

  const cerrarNegocio = useMutation({
    mutationFn: async (form: FormContrato) =>
      apiClient.post(`/admin/inmobiliaria/propiedades/${propiedadACerrar?.id}/contratos`, {
        clienteId: form.clienteId,
        monto: Number(form.monto),
        moneda: form.moneda,
        agenteId: form.agenteId || undefined,
        porcentajeComision: form.porcentajeComision ? Number(form.porcentajeComision) : undefined,
        notas: form.notas || undefined,
      }),
    onSuccess: () => {
      setPropiedadACerrar(null);
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cerrar el negocio.')),
  });

  const iniciarPreventa = useMutation({
    mutationFn: async (clienteId: string) =>
      apiClient.post<{ id: string }>(`/admin/inmobiliaria/propiedades/${propiedadAPreventa?.id}/preventa`, { clienteId }),
    onSuccess: (respuesta) => {
      setPropiedadAPreventa(null);
      setError(null);
      invalidar();
      navigate(`/proyectos/${respuesta.data.id}`);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo iniciar la preventa.')),
  });

  const desvincularPreventa = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/inmobiliaria/propiedades/${id}/preventa`),
    onSuccess: () => {
      setPropiedadADesvincularPreventa(null);
      invalidar();
    },
    onError: (err) => {
      setError(mensajeErrorApi(err, 'No se pudo desvincular la preventa.'));
      setPropiedadADesvincularPreventa(null);
    },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/inmobiliaria/propiedades/${id}`),
    onSuccess: () => {
      setPropiedadAEliminar(null);
      invalidar();
    },
    onError: (err) => {
      setError(mensajeErrorApi(err, 'No se pudo eliminar la propiedad.'));
      setPropiedadAEliminar(null);
    },
  });

  const propiedades = data?.datos ?? [];

  return (
    <RequierePermiso permiso="inmobiliaria.propiedades.ver">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Propiedades</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{data ? `${data.total} propiedad(es) registradas` : 'Catálogo de venta y alquiler.'}</p>
          </div>
          <div className="flex items-center gap-2">
            {usuario?.tenant?.subdominio && (
              <Link
                to={`/inmobiliaria/${usuario.tenant.subdominio}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ExternalLink size={14} />
                Ver catálogo público
              </Link>
            )}
            <RequierePermiso permiso="inmobiliaria.propiedades.crear">
              <Button onClick={() => setModalAbierto(true)}>+ Nueva propiedad</Button>
            </RequierePermiso>
          </div>
        </div>

        <Card sinPadding>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por título, código o ubicación…" />
            <Select value={filtroOperacion} onChange={(e) => setFiltroOperacion(e.target.value)} className="!w-auto">
              <option value="">Todas las operaciones</option>
              {OPERACIONES_PROPIEDAD.map((o) => (
                <option key={o} value={o}>
                  {ETIQUETA_OPERACION_PROPIEDAD[o]}
                </option>
              ))}
            </Select>
            <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="!w-auto">
              <option value="">Todos los tipos</option>
              {TIPOS_PROPIEDAD.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_PROPIEDAD[t]}
                </option>
              ))}
            </Select>
          </div>

          {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {!isLoading && propiedades.length === 0 && (
            <div className="p-5">
              <EstadoVacio titulo="Sin propiedades todavía" descripcion="Creá la primera para empezar a publicar tu catálogo." />
            </div>
          )}
          {propiedades.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Propiedad</th>
                    <th className="px-5 py-3 font-medium">Operación</th>
                    <th className="px-5 py-3 font-medium">Precio</th>
                    <th className="px-5 py-3 font-medium">Ubicación</th>
                    <th className="px-5 py-3 font-medium">Agente</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {propiedades.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {p.imagenes[0] ? (
                            <img src={p.imagenes[0].imagen} alt="" className="h-10 w-14 shrink-0 rounded-md object-cover" />
                          ) : (
                            <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400 dark:bg-slate-800">—</div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{p.titulo}</p>
                            <p className="text-xs text-slate-400">Cód. {p.codigo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tono={p.operacion === 'ALQUILER' ? 'advertencia' : 'neutro'}>{ETIQUETA_OPERACION_PROPIEDAD[p.operacion] ?? p.operacion}</Badge>
                      </td>
                      <td className="px-5 py-3 font-medium tabular-nums">
                        {p.moneda === 'DOP' ? 'RD$' : 'US$'} {Number(p.precio).toLocaleString('es-DO')}
                        {p.operacion === 'ALQUILER' ? '/mes' : ''}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{p.ubicacion}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{p.agente?.nombre ?? '—'}</td>
                      <td className="px-5 py-3">
                        <Badge tono={TONO_ESTADO[p.estado] ?? 'neutro'}>{ETIQUETA_ESTADO_PROPIEDAD[p.estado] ?? p.estado}</Badge>
                        {p.proyectoPreventa && (
                          <Link to={`/proyectos/${p.proyectoPreventa.id}`} className="mt-1 block text-xs text-teal-700 hover:underline dark:text-teal-400">
                            Preventa: {p.proyectoPreventa.nombre}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RowActionsMenu
                          acciones={[
                            ...(puedeCerrarNegocio && ESTADOS_PROPIEDAD_CERRABLE.has(p.estado)
                              ? [{ etiqueta: 'Cerrar negocio', onClick: () => setPropiedadACerrar(p) }]
                              : []),
                            ...(puedeCrearPreventa && p.operacion === 'VENTA' && !p.proyectoPreventaId && ESTADOS_PROPIEDAD_CERRABLE.has(p.estado)
                              ? [{ etiqueta: 'Iniciar preventa', onClick: () => setPropiedadAPreventa(p) }]
                              : []),
                            ...(puedeCrearPreventa && p.proyectoPreventaId
                              ? [{ etiqueta: 'Desvincular preventa', tono: 'peligro' as const, onClick: () => setPropiedadADesvincularPreventa(p) }]
                              : []),
                            ...(puedeEditarPropiedad ? [{ etiqueta: 'Editar', onClick: () => setPropiedadEditando(p) }] : []),
                            ...(puedeEliminarPropiedad ? [{ etiqueta: 'Eliminar', tono: 'peligro' as const, onClick: () => setPropiedadAEliminar(p) }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && (
            <div className="border-t border-slate-100 p-4 dark:border-slate-800">
              <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>

        {modalAbierto && (
          <PropiedadFormModal
            titulo="Nueva propiedad"
            agentes={agentes}
            clientes={clientes}
            guardando={crear.isPending}
            error={error}
            onClose={() => {
              setModalAbierto(false);
              setError(null);
            }}
            onGuardar={(form) => crear.mutate(form)}
          />
        )}

        {propiedadEditando && (
          <PropiedadFormModal
            titulo={`Editar "${propiedadEditando.titulo}"`}
            propiedadInicial={propiedadEditando}
            agentes={agentes}
            clientes={clientes}
            guardando={actualizar.isPending}
            error={error}
            onClose={() => {
              setPropiedadEditando(null);
              setError(null);
            }}
            onGuardar={(form) => actualizar.mutate(form)}
          />
        )}

        {propiedadACerrar && (
          <ContratoFormModal
            propiedad={propiedadACerrar}
            agentes={agentes}
            clientes={clientes}
            guardando={cerrarNegocio.isPending}
            error={error}
            onClose={() => {
              setPropiedadACerrar(null);
              setError(null);
            }}
            onGuardar={(form) => cerrarNegocio.mutate(form)}
          />
        )}

        {propiedadAEliminar && (
          <ConfirmModal
            titulo="¿Eliminar esta propiedad?"
            descripcion={
              <>
                Se eliminará <b>{propiedadAEliminar.titulo}</b> del catálogo.
              </>
            }
            confirmando={eliminar.isPending}
            onConfirmar={() => eliminar.mutate(propiedadAEliminar.id)}
            onCancelar={() => setPropiedadAEliminar(null)}
          />
        )}

        {propiedadAPreventa && (
          <IniciarPreventaModal
            propiedad={propiedadAPreventa}
            clientes={clientes}
            guardando={iniciarPreventa.isPending}
            error={error}
            onClose={() => {
              setPropiedadAPreventa(null);
              setError(null);
            }}
            onGuardar={(clienteId) => iniciarPreventa.mutate(clienteId)}
          />
        )}

        {propiedadADesvincularPreventa && (
          <ConfirmModal
            titulo="¿Desvincular la preventa?"
            descripcion={
              <>
                Se desvincula el Proyecto de <b>{propiedadADesvincularPreventa.titulo}</b> (no se elimina — seguís
                pudiendo verlo en Proyectos) y la propiedad vuelve a quedar Activa en el catálogo.
              </>
            }
            confirmando={desvincularPreventa.isPending}
            onConfirmar={() => desvincularPreventa.mutate(propiedadADesvincularPreventa.id)}
            onCancelar={() => setPropiedadADesvincularPreventa(null)}
          />
        )}
      </div>
    </RequierePermiso>
  );
}
