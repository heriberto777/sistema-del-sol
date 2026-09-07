import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';

interface Hito {
  id: string;
  nombre: string;
  fechaObjetivo: string | null;
  montoFijo: string | null;
  estado: string;
  facturaId: string | null;
}

interface RegistroHora {
  id: string;
  empleado: { id: string; nombre: string };
  fecha: string;
  horas: string;
  nota: string | null;
}

interface Responsable {
  empleado: { id: string; nombre: string };
}

interface Tarea {
  id: string;
  titulo: string;
  hitoId: string | null;
  estado: string;
  prioridad: string;
  fechaVencimiento: string | null;
  responsables: Responsable[];
  registrosHoras: RegistroHora[];
}

interface ProyectoDetalleDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  cliente: { id: string; nombre: string };
  responsable: { id: string; nombre: string } | null;
  presupuesto: string | null;
  modoFacturacion: string;
  estado: string;
  hitos: Hito[];
  tareas: Tarea[];
}

interface EmpleadoOpcion {
  id: string;
  nombre: string;
}

interface Rentabilidad {
  facturado: number;
  costoHoras: number;
  costoGastos: number;
  costoTotal: number;
  margen: number;
  margenPorcentaje: number | null;
}

const ESTADOS_TAREA = ['PENDIENTE', 'EN_CURSO', 'EN_REVISION', 'TERMINADA'];
const ETIQUETA_ESTADO_TAREA: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  EN_REVISION: 'En revisión',
  TERMINADA: 'Terminada',
};
const ESTADOS_PROYECTO = ['PLANIFICADO', 'EN_CURSO', 'PAUSADO', 'TERMINADO', 'CANCELADO'];

export function ProyectoDetalle() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const puedeVerRentabilidad = tienePermiso('proyectos.rentabilidad.ver');
  const [nuevoHito, setNuevoHito] = useState('');
  const [nuevaTarea, setNuevaTarea] = useState('');
  const [tareaAbierta, setTareaAbierta] = useState<Tarea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensajeFactura, setMensajeFactura] = useState<string | null>(null);

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ['proyecto', id],
    queryFn: async () => (await apiClient.get<ProyectoDetalleDto>(`/admin/proyectos/${id}`)).data,
    enabled: !!id,
  });

  const { data: empleados } = useQuery({
    queryKey: ['proyectos-empleados-opciones'],
    queryFn: async () => (await apiClient.get<EmpleadoOpcion[]>('/admin/proyectos/empleados')).data,
    enabled: !!tareaAbierta,
  });

  const { data: rentabilidad } = useQuery({
    queryKey: ['proyecto-rentabilidad', id],
    queryFn: async () => (await apiClient.get<Rentabilidad>(`/admin/proyectos/${id}/rentabilidad`)).data,
    enabled: !!id && puedeVerRentabilidad,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['proyecto', id] });

  const cambiarEstadoProyecto = useMutation({
    mutationFn: async (estado: string) => apiClient.patch(`/admin/proyectos/${id}`, { estado }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el estado.')),
  });

  const crearHito = useMutation({
    mutationFn: async () => apiClient.post(`/admin/proyectos/${id}/hitos`, { nombre: nuevoHito }),
    onSuccess: () => {
      setNuevoHito('');
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el hito.')),
  });

  const cambiarEstadoHito = useMutation({
    mutationFn: async ({ hitoId, estado }: { hitoId: string; estado: string }) => apiClient.patch(`/admin/proyectos/hitos/${hitoId}`, { estado }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el estado del hito.')),
  });

  const facturarHito = useMutation({
    mutationFn: async (hitoId: string) => (await apiClient.post<{ facturaId: string; numero: string | null; total: string }>(`/admin/proyectos/hitos/${hitoId}/facturar`)).data,
    onSuccess: (factura) => {
      setError(null);
      setMensajeFactura(`Factura ${factura.numero ?? factura.facturaId} generada por RD$ ${Number(factura.total).toLocaleString('es-DO')}.`);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo facturar el hito.')),
  });

  const crearTarea = useMutation({
    mutationFn: async () => apiClient.post(`/admin/proyectos/${id}/tareas`, { titulo: nuevaTarea }),
    onSuccess: () => {
      setNuevaTarea('');
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la tarea.')),
  });

  const cambiarEstadoTarea = useMutation({
    mutationFn: async ({ tareaId, estado }: { tareaId: string; estado: string }) => apiClient.patch(`/admin/proyectos/tareas/${tareaId}`, { estado }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el estado de la tarea.')),
  });

  const asignarResponsable = useMutation({
    mutationFn: async ({ tareaId, empleadoId }: { tareaId: string; empleadoId: string }) =>
      apiClient.post(`/admin/proyectos/tareas/${tareaId}/responsables/${empleadoId}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo asignar el responsable.')),
  });

  const quitarResponsable = useMutation({
    mutationFn: async ({ tareaId, empleadoId }: { tareaId: string; empleadoId: string }) =>
      apiClient.delete(`/admin/proyectos/tareas/${tareaId}/responsables/${empleadoId}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo quitar el responsable.')),
  });

  const registrarHora = useMutation({
    mutationFn: async ({ tareaId, empleadoId, fecha, horas }: { tareaId: string; empleadoId: string; fecha: string; horas: string }) =>
      apiClient.post(`/admin/proyectos/tareas/${tareaId}/horas`, { empleadoId, fecha, horas: Number(horas) }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar la hora.')),
  });

  if (isLoading || !proyecto) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  const tareaActual = tareaAbierta ? proyecto.tareas.find((t) => t.id === tareaAbierta.id) ?? tareaAbierta : null;

  return (
    <RequierePermiso permiso="proyectos.ver">
      <div className="space-y-4">
        <Link to="/proyectos" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft size={14} /> Volver a Proyectos
        </Link>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{proyecto.nombre}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Cliente: {proyecto.cliente.nombre} {proyecto.responsable && `· Responsable: ${proyecto.responsable.nombre}`}
              </p>
              {proyecto.presupuesto && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Presupuesto: RD$ {Number(proyecto.presupuesto).toLocaleString('es-DO')}</p>
              )}
            </div>
            <Select
              value={proyecto.estado}
              onChange={(e) => cambiarEstadoProyecto.mutate(e.target.value)}
              className="w-auto"
            >
              {ESTADOS_PROYECTO.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {mensajeFactura && <p className="text-sm text-emerald-600 dark:text-emerald-400">{mensajeFactura}</p>}

        <Card titulo="Hitos" descripcion="Entregas o cortes de facturación del proyecto.">
          <div className="space-y-2">
            {proyecto.hitos.length === 0 && <EstadoVacio titulo="Sin hitos todavía" />}
            {proyecto.hitos.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{h.nombre}</p>
                  {h.montoFijo && <p className="text-xs text-slate-500 dark:text-slate-400">RD$ {Number(h.montoFijo).toLocaleString('es-DO')}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!h.facturaId && (
                    <RequierePermiso permiso="proyectos.facturar">
                      <Button
                        type="button"
                        variante="secundario"
                        onClick={() => {
                          setError(null);
                          setMensajeFactura(null);
                          facturarHito.mutate(h.id);
                        }}
                        disabled={facturarHito.isPending}
                      >
                        {facturarHito.isPending ? 'Facturando…' : 'Facturar'}
                      </Button>
                    </RequierePermiso>
                  )}
                  <Select
                    value={h.estado}
                    onChange={(e) => cambiarEstadoHito.mutate({ hitoId: h.id, estado: e.target.value })}
                    disabled={!!h.facturaId}
                    className="w-auto"
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="EN_CURSO">En curso</option>
                    <option value="COMPLETADO">Completado</option>
                    <option value="FACTURADO">Facturado</option>
                  </Select>
                </div>
              </div>
            ))}
            <form
              className="flex gap-2 pt-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (nuevoHito.trim()) crearHito.mutate();
              }}
            >
              <FormField id="nuevo-hito" label="" placeholder="Nombre del hito…" value={nuevoHito} onChange={(e) => setNuevoHito(e.target.value)} />
              <Button type="submit" disabled={crearHito.isPending}>
                Agregar hito
              </Button>
            </form>
          </div>
        </Card>

        <RequierePermiso permiso="proyectos.rentabilidad.ver">
          {rentabilidad && (
            <Card titulo="Rentabilidad" descripcion="Facturado real vs. costo (horas + gastos asociados).">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Facturado</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    RD$ {rentabilidad.facturado.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Costo horas</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    RD$ {rentabilidad.costoHoras.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Costo gastos</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    RD$ {rentabilidad.costoGastos.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Margen</p>
                  <p className={`text-lg font-semibold ${rentabilidad.margen >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    RD$ {rentabilidad.margen.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
                    {rentabilidad.margenPorcentaje !== null && ` (${rentabilidad.margenPorcentaje.toFixed(1)}%)`}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </RequierePermiso>

        <Card titulo="Tareas">
          <div className="space-y-2">
            {proyecto.tareas.length === 0 && <EstadoVacio titulo="Sin tareas todavía" />}
            {proyecto.tareas.map((t) => (
              <div
                key={t.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                onClick={() => setTareaAbierta(t)}
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{t.titulo}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.responsables.length > 0 ? t.responsables.map((r) => r.empleado.nombre).join(', ') : 'Sin responsables'}
                  </p>
                </div>
                <Select
                  value={t.estado}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => cambiarEstadoTarea.mutate({ tareaId: t.id, estado: e.target.value })}
                  className="w-auto"
                >
                  {ESTADOS_TAREA.map((estado) => (
                    <option key={estado} value={estado}>
                      {ETIQUETA_ESTADO_TAREA[estado]}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
            <form
              className="flex gap-2 pt-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (nuevaTarea.trim()) crearTarea.mutate();
              }}
            >
              <FormField id="nueva-tarea" label="" placeholder="Título de la tarea…" value={nuevaTarea} onChange={(e) => setNuevaTarea(e.target.value)} />
              <Button type="submit" disabled={crearTarea.isPending}>
                Agregar tarea
              </Button>
            </form>
          </div>
        </Card>

        {tareaActual && (
          <Modal titulo={tareaActual.titulo} onClose={() => setTareaAbierta(null)}>
            <div className="space-y-5">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Responsables</h3>
                <div className="flex flex-wrap gap-2">
                  {tareaActual.responsables.map((r) => (
                    <span
                      key={r.empleado.id}
                      className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {r.empleado.nombre}
                      <button
                        type="button"
                        onClick={() => quitarResponsable.mutate({ tareaId: tareaActual.id, empleadoId: r.empleado.id })}
                        className="text-slate-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <Select
                  className="mt-2"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) asignarResponsable.mutate({ tareaId: tareaActual.id, empleadoId: e.target.value });
                  }}
                >
                  <option value="">Agregar responsable…</option>
                  {empleados
                    ?.filter((emp) => !tareaActual.responsables.some((r) => r.empleado.id === emp.id))
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombre}
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Horas registradas</h3>
                <div className="space-y-1">
                  {tareaActual.registrosHoras.length === 0 && <p className="text-xs text-slate-400">Sin horas cargadas todavía.</p>}
                  {tareaActual.registrosHoras.map((r) => (
                    <div key={r.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>
                        {r.empleado.nombre} — {new Date(r.fecha).toLocaleDateString('es-DO')}
                      </span>
                      <span className="font-medium">{r.horas}h</span>
                    </div>
                  ))}
                </div>
                <FormularioHora
                  empleados={empleados ?? []}
                  onRegistrar={(empleadoId, fecha, horas) => registrarHora.mutate({ tareaId: tareaActual.id, empleadoId, fecha, horas })}
                  guardando={registrarHora.isPending}
                />
              </div>
            </div>
          </Modal>
        )}
      </div>
    </RequierePermiso>
  );
}

function FormularioHora({
  empleados,
  onRegistrar,
  guardando,
}: {
  empleados: EmpleadoOpcion[];
  onRegistrar: (empleadoId: string, fecha: string, horas: string) => void;
  guardando: boolean;
}) {
  const [empleadoId, setEmpleadoId] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState('');

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (empleadoId && horas) {
          onRegistrar(empleadoId, fecha, horas);
          setHoras('');
        }
      }}
    >
      <Select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} className="w-auto">
        <option value="">Empleado…</option>
        {empleados.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.nombre}
          </option>
        ))}
      </Select>
      <FormField id="hora-fecha" label="" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-auto" />
      <FormField id="hora-cantidad" label="" type="number" min="0" step="0.5" placeholder="Horas" value={horas} onChange={(e) => setHoras(e.target.value)} className="w-24" />
      <Button type="submit" variante="secundario" disabled={guardando}>
        Registrar
      </Button>
    </form>
  );
}
