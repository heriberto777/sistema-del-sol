import { DragEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsLeft, ChevronsRight, ChevronsUpDown, MessageSquare, Pause, Play, Sparkles, Trash2, UserPlus } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { ConfirmModal } from '../../molecules/ConfirmModal/ConfirmModal';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../RequierePermiso/RequierePermiso';
import { BarraFormato, ContenidoComentario } from '../../molecules/ComentarioFormato/ComentarioFormato';
import { TareaFormModal, TareaFormValues } from '../TareaFormModal/TareaFormModal';
import { GenerarTareasIaModal, PlanIaParaCrear } from '../GenerarTareasIaModal/GenerarTareasIaModal';
import {
  EmpleadoOpcion,
  ESTADOS_TAREA,
  ETIQUETA_ESTADO_TAREA,
  ESTILO_PRIORIDAD_TAREA,
  ETIQUETA_PRIORIDAD_TAREA,
  Hito,
  PRIORIDADES_TAREA,
  Tarea,
} from '../../../types/proyectos';
import { soloFecha, formatoFechaHoraComentario, formatearDuracion } from '../../../lib/fecha';
import { inicialesDe } from '../../../lib/iniciales';

/** Re-renderiza el Kanban cada `intervaloMs` para que el tiempo del cronómetro corriendo se vea en vivo, sin pedirle nada nuevo al backend hasta que se pause. */
function useAhora(intervaloMs: number): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return ahora;
}

function formatoFechaVencimiento(fecha: string): string {
  return soloFecha(fecha).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
}
/** Solo visual (el aviso real por email/WhatsApp lo dispara TareasProyectoCronService en el backend) — una tarea TERMINADA nunca se resalta. */
function estadoVencimiento(fecha: string, estado: string): 'vencida' | 'hoy' | null {
  if (estado === 'TERMINADA') return null;
  const dia = soloFecha(fecha);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (dia.getTime() === hoy.getTime()) return 'hoy';
  if (dia.getTime() < hoy.getTime()) return 'vencida';
  return null;
}
const CLASE_BADGE_VENCIMIENTO: Record<'vencida' | 'hoy', string> = {
  vencida: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  hoy: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
};
const ETIQUETA_BADGE_VENCIMIENTO: Record<'vencida' | 'hoy', string> = { vencida: 'Vencida', hoy: 'Vence hoy' };

const CLAVE_VISTA = 'proyectos-kanban-vista';
const CLAVE_COLUMNAS_COLAPSADAS = 'proyectos-kanban-columnas-colapsadas';
/** Valor del filtro de Hito para "tareas sin ningún hito asignado" — distinto de '' (que significa "todos los hitos"). */
const SIN_HITO = '__sin-hito__';

const COLUMNAS: { estado: string; etiqueta: string; dot: string }[] = [
  { estado: 'PENDIENTE', etiqueta: 'Pendiente', dot: 'bg-slate-400' },
  { estado: 'EN_CURSO', etiqueta: 'En curso', dot: 'bg-blue-500' },
  { estado: 'EN_REVISION', etiqueta: 'En revisión', dot: 'bg-amber-500' },
  { estado: 'TERMINADA', etiqueta: 'Terminada', dot: 'bg-emerald-500' },
];

const PUNTO_PRIORIDAD: Record<string, string> = {
  BAJA: 'bg-slate-400',
  MEDIA: 'bg-blue-500',
  ALTA: 'bg-amber-500',
  URGENTE: 'bg-red-500',
};

const PALETA_AVATAR = ['bg-sol-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500'];

interface KanbanTareasProps {
  proyectoId: string;
  proyectoNombre: string;
  proyectoDescripcion: string | null;
  tareas: Tarea[];
  hitos: Hito[];
  onInvalidar: () => void;
  onError: (mensaje: string | null) => void;
}

export function KanbanTareas({ proyectoId, proyectoNombre, proyectoDescripcion, tareas, hitos, onInvalidar, onError }: KanbanTareasProps) {
  const queryClient = useQueryClient();
  const { usuario, tienePermiso } = useAuth();
  const puedeModerarComentarios = tienePermiso('proyectos.editar');
  const [vista, setVista] = useState<'clasico' | 'compacto'>(() => {
    const guardada = localStorage.getItem(CLAVE_VISTA);
    return guardada === 'compacto' ? 'compacto' : 'clasico';
  });
  const [columnaDestacada, setColumnaDestacada] = useState<string | null>(null);
  const [tareaAbierta, setTareaAbierta] = useState<Tarea | null>(null);
  // Panel lateral de comentarios (dentro del modal de detalle) — abierto por
  // defecto, con un botón para ocultarlo y ganar ancho para Responsables/
  // Horas. Se resetea a abierto cada vez que se abre una tarea a propósito
  // (no persiste): es una preferencia de "estoy leyendo esto ahora", no una
  // configuración de largo plazo como el colapso del Sidebar.
  const [panelComentariosAbierto, setPanelComentariosAbierto] = useState(true);
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [tareaEditando, setTareaEditando] = useState<Tarea | null>(null);
  const [tareaAEliminar, setTareaAEliminar] = useState<Tarea | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [modalIaAbierto, setModalIaAbierto] = useState(false);
  const [creandoDesdeIa, setCreandoDesdeIa] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroHito, setFiltroHito] = useState('');
  const [columnasColapsadas, setColumnasColapsadas] = useState<Set<string>>(() => {
    try {
      const guardadas = JSON.parse(localStorage.getItem(CLAVE_COLUMNAS_COLAPSADAS) ?? '[]');
      return new Set(Array.isArray(guardadas) ? guardadas : []);
    } catch {
      return new Set();
    }
  });
  // Tarjetas expandidas manualmente (solo vista Clásico) — a propósito NO
  // persistido: la lista de tareas cambia todo el tiempo, un set de ids
  // guardado entre sesiones quedaría obsoleto casi de inmediato.
  const [tarjetasExpandidas, setTarjetasExpandidas] = useState<Set<string>>(new Set());
  const ahora = useAhora(30_000);

  useEffect(() => {
    localStorage.setItem(CLAVE_VISTA, vista);
  }, [vista]);

  useEffect(() => {
    localStorage.setItem(CLAVE_COLUMNAS_COLAPSADAS, JSON.stringify(Array.from(columnasColapsadas)));
  }, [columnasColapsadas]);

  // Fase 6 — "¿quién soy yo como empleado?" para saber si el cronómetro de
  // esta tarea es mío (mostrar Pausar) o de otro responsable (solo lectura).
  const { data: miEmpleado } = useQuery({
    queryKey: ['proyectos-mi-empleado'],
    queryFn: async () => (await apiClient.get<{ empleadoId: string | null }>('/admin/proyectos/mi-empleado')).data,
  });
  const miEmpleadoId = miEmpleado?.empleadoId ?? null;

  const { data: empleados } = useQuery({
    queryKey: ['proyectos-empleados-opciones'],
    queryFn: async () => (await apiClient.get<EmpleadoOpcion[]>('/admin/proyectos/empleados')).data,
    enabled: !!tareaAbierta,
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
    onInvalidar();
  };

  const crearTarea = useMutation({
    mutationFn: async (valores: TareaFormValues) => apiClient.post(`/admin/proyectos/${proyectoId}/tareas`, valores),
    onSuccess: () => {
      setModalCrearAbierto(false);
      setErrorForm(null);
      invalidar();
    },
    onError: (err) => setErrorForm(mensajeErrorApi(err, 'No se pudo crear la tarea.')),
  });

  async function crearPlanDesdeIa(plan: PlanIaParaCrear) {
    setCreandoDesdeIa(true);
    try {
      for (const h of plan.hitos) {
        const { data: hito } = await apiClient.post<{ id: string }>(`/admin/proyectos/${proyectoId}/hitos`, { nombre: h.nombre });
        for (const t of h.tareas) {
          await apiClient.post(`/admin/proyectos/${proyectoId}/tareas`, { titulo: t.titulo, prioridad: t.prioridad, hitoId: hito.id });
        }
      }
      for (const t of plan.sueltas) {
        await apiClient.post(`/admin/proyectos/${proyectoId}/tareas`, { titulo: t.titulo, prioridad: t.prioridad, hitoId: null });
      }
      setModalIaAbierto(false);
      onError(null);
      invalidar();
    } catch (err) {
      onError(mensajeErrorApi(err, 'No se pudieron crear todas las tareas.'));
    } finally {
      setCreandoDesdeIa(false);
    }
  }

  const editarTarea = useMutation({
    mutationFn: async (valores: TareaFormValues) => apiClient.patch(`/admin/proyectos/tareas/${tareaEditando?.id}`, valores),
    onSuccess: () => {
      setTareaEditando(null);
      setErrorForm(null);
      invalidar();
    },
    onError: (err) => setErrorForm(mensajeErrorApi(err, 'No se pudo guardar la tarea.')),
  });

  const eliminarTarea = useMutation({
    mutationFn: async (tareaId: string) => apiClient.delete(`/admin/proyectos/tareas/${tareaId}`),
    onSuccess: () => {
      setTareaAEliminar(null);
      invalidar();
    },
    onError: (err) => {
      onError(mensajeErrorApi(err, 'No se pudo eliminar la tarea.'));
      setTareaAEliminar(null);
    },
  });

  const cambiarEstadoTarea = useMutation({
    mutationFn: async ({ tareaId, estado }: { tareaId: string; estado: string }) => apiClient.patch(`/admin/proyectos/tareas/${tareaId}`, { estado }),
    onSuccess: invalidar,
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo cambiar el estado de la tarea.')),
  });

  /**
   * Genérica para los campos editables directo desde el panel de detalle
   * (Estado/Prioridad/Hito/Fecha/Descripción) — antes esa información solo
   * se veía/editaba reabriendo `TareaFormModal` por separado (bug real
   * reportado: la Descripción capturada al crear nunca se mostraba en el
   * detalle). Mismo endpoint que ya usa `cambiarEstadoTarea`, que se deja
   * intacta porque el drag-and-drop del tablero depende de su firma exacta.
   */
  const actualizarTarea = useMutation({
    mutationFn: async ({ tareaId, valores }: { tareaId: string; valores: Partial<TareaFormValues> }) =>
      apiClient.patch(`/admin/proyectos/tareas/${tareaId}`, valores),
    onSuccess: invalidar,
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo actualizar la tarea.')),
  });

  const iniciarCronometro = useMutation({
    mutationFn: async (tareaId: string) => apiClient.post(`/admin/proyectos/tareas/${tareaId}/cronometro/iniciar`),
    onSuccess: invalidar,
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo iniciar el cronómetro.')),
  });

  const pausarCronometro = useMutation({
    mutationFn: async (tareaId: string) => apiClient.post(`/admin/proyectos/tareas/${tareaId}/cronometro/pausar`),
    onSuccess: invalidar,
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo pausar el cronómetro.')),
  });

  const asignarResponsable = useMutation({
    mutationFn: async ({ tareaId, empleadoId }: { tareaId: string; empleadoId: string }) =>
      apiClient.post(`/admin/proyectos/tareas/${tareaId}/responsables/${empleadoId}`),
    onSuccess: invalidar,
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo asignar el responsable.')),
  });

  const quitarResponsable = useMutation({
    mutationFn: async ({ tareaId, empleadoId }: { tareaId: string; empleadoId: string }) =>
      apiClient.delete(`/admin/proyectos/tareas/${tareaId}/responsables/${empleadoId}`),
    onSuccess: invalidar,
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo quitar el responsable.')),
  });

  const registrarHora = useMutation({
    mutationFn: async ({ tareaId, empleadoId, fecha, horas }: { tareaId: string; empleadoId: string; fecha: string; horas: string }) =>
      apiClient.post(`/admin/proyectos/tareas/${tareaId}/horas`, { empleadoId, fecha, horas: Number(horas) }),
    onSuccess: invalidar,
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo registrar la hora.')),
  });

  const agregarComentario = useMutation({
    mutationFn: async ({ tareaId, contenido }: { tareaId: string; contenido: string }) =>
      apiClient.post(`/admin/proyectos/tareas/${tareaId}/comentarios`, { contenido }),
    onSuccess: invalidar,
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo agregar el comentario.')),
  });

  const eliminarComentario = useMutation({
    mutationFn: async (comentarioId: string) => apiClient.delete(`/admin/proyectos/comentarios/${comentarioId}`),
    onSuccess: invalidar,
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo eliminar el comentario.')),
  });

  const tareaActual = tareaAbierta ? tareas.find((t) => t.id === tareaAbierta.id) ?? tareaAbierta : null;
  const hitoPorId = Object.fromEntries(hitos.map((h) => [h.id, h.nombre]));

  function onDragStart(e: DragEvent<HTMLDivElement>, tareaId: string) {
    e.dataTransfer.setData('text/plain', tareaId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDropColumna(e: DragEvent<HTMLDivElement>, estado: string) {
    e.preventDefault();
    setColumnaDestacada(null);
    const tareaId = e.dataTransfer.getData('text/plain');
    const tarea = tareas.find((t) => t.id === tareaId);
    if (!tarea || tarea.estado === estado) return;
    cambiarEstadoTarea.mutate({ tareaId, estado });
  }

  function coincideConBusqueda(t: Tarea): boolean {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return true;
    return t.titulo.toLowerCase().includes(termino) || t.responsables.some((r) => r.empleado.nombre.toLowerCase().includes(termino));
  }

  function coincideConFiltroHito(t: Tarea): boolean {
    if (!filtroHito) return true;
    if (filtroHito === SIN_HITO) return t.hitoId === null;
    return t.hitoId === filtroHito;
  }

  function pasaFiltros(t: Tarea): boolean {
    return coincideConBusqueda(t) && coincideConFiltroHito(t);
  }

  const hayFiltroActivo = !!busqueda || !!filtroHito;

  function alternarColumna(estado: string) {
    setColumnasColapsadas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(estado)) nuevo.delete(estado);
      else nuevo.add(estado);
      return nuevo;
    });
  }

  function alternarTarjeta(tareaId: string) {
    setTarjetasExpandidas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(tareaId)) nuevo.delete(tareaId);
      else nuevo.add(tareaId);
      return nuevo;
    });
  }

  const hayAlgunaExpandida = tarjetasExpandidas.size > 0;

  function alternarTodasLasTarjetas() {
    setTarjetasExpandidas((actual) => (actual.size > 0 ? new Set() : new Set(tareas.filter(pasaFiltros).map((t) => t.id))));
  }

  function accionesTarea(t: Tarea) {
    return [
      { etiqueta: 'Editar', onClick: () => setTareaEditando(t) },
      { etiqueta: 'Eliminar', tono: 'peligro' as const, onClick: () => setTareaAEliminar(t) },
    ];
  }

  function alternarCronometro(e: MouseEvent, tareaId: string, corriendo: boolean) {
    e.stopPropagation();
    if (corriendo) pausarCronometro.mutate(tareaId);
    else iniciarCronometro.mutate(tareaId);
  }

  /**
   * Chip completo (vista Clásico) — botón Iniciar/Pausar si soy responsable,
   * más quién más está trabajando ahora mismo. En una tarea Terminada el
   * botón "Iniciar" queda oculto (confirmado con el usuario) — hay que
   * reabrirla cambiando el estado antes de poder volver a cronometrarla;
   * "Pausar" sigue visible si por algún motivo quedó una sesión abierta.
   */
  function chipCronometro(t: Tarea) {
    const miSesion = t.sesionesTrabajo.find((s) => s.empleadoId === miEmpleadoId);
    const otras = t.sesionesTrabajo.filter((s) => s.empleadoId !== miEmpleadoId);
    const soyResponsable = miEmpleadoId != null && t.responsables.some((r) => r.empleado.id === miEmpleadoId);
    const puedeMostrarBoton = soyResponsable && (!!miSesion || t.estado !== 'TERMINADA');
    if (!puedeMostrarBoton && otras.length === 0) return null;
    return (
      <div className="flex items-center gap-2">
        {puedeMostrarBoton && (
          <button
            type="button"
            onClick={(e) => alternarCronometro(e, t.id, !!miSesion)}
            disabled={iniciarCronometro.isPending || pausarCronometro.isPending}
            className={clsx(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              miSesion
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400',
            )}
          >
            {miSesion ? <Pause size={10} /> : <Play size={10} />}
            {miSesion ? formatearDuracion(ahora - new Date(miSesion.inicio).getTime()) : 'Iniciar'}
          </button>
        )}
        {otras.length > 0 && (
          <span
            className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
            title={otras.map((s) => s.empleado.nombre).join(', ')}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {otras.length === 1 ? otras[0].empleado.nombre : `${otras.length} trabajando`}
          </span>
        )}
      </div>
    );
  }

  /** Icono compacto (vista Compacto) — mismo control y misma regla de Terminada, sin duración a la vista para no romper la fila angosta. */
  function iconoCronometro(t: Tarea) {
    const miSesion = t.sesionesTrabajo.find((s) => s.empleadoId === miEmpleadoId);
    const soyResponsable = miEmpleadoId != null && t.responsables.some((r) => r.empleado.id === miEmpleadoId);
    const puedeMostrarBoton = soyResponsable && (!!miSesion || t.estado !== 'TERMINADA');
    if (!puedeMostrarBoton) return null;
    return (
      <button
        type="button"
        onClick={(e) => alternarCronometro(e, t.id, !!miSesion)}
        disabled={iniciarCronometro.isPending || pausarCronometro.isPending}
        title={miSesion ? `Pausar (${formatearDuracion(ahora - new Date(miSesion.inicio).getTime())})` : 'Iniciar cronómetro'}
        className={clsx(
          'shrink-0 rounded p-0.5',
          miSesion ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
        )}
      >
        {miSesion ? <Pause size={12} /> : <Play size={12} />}
      </button>
    );
  }

  return (
    <Card
      titulo="Tablero"
      descripcion="Arrastrá una tarea a otra columna para cambiar su estado."
      acciones={
        <div className="flex items-center gap-2">
          <RequierePermiso permiso="proyectos.ia_generar">
            <Button variante="secundario" icon={Sparkles} onClick={() => setModalIaAbierto(true)}>
              Generar con IA
            </Button>
          </RequierePermiso>
          <RequierePermiso permiso="proyectos.crear">
            <Button onClick={() => setModalCrearAbierto(true)}>Nueva tarea</Button>
          </RequierePermiso>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar tarea o responsable…" />
        <Select value={filtroHito} onChange={(e) => setFiltroHito(e.target.value)} className="w-auto">
          <option value="">Todos los hitos</option>
          <option value={SIN_HITO}>Sin hito</option>
          {hitos.map((h) => (
            <option key={h.id} value={h.id}>
              {h.nombre}
            </option>
          ))}
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {vista === 'clasico' && (
            <button
              type="button"
              onClick={alternarTodasLasTarjetas}
              className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              title={hayAlgunaExpandida ? 'Contraer todas las tarjetas' : 'Expandir todas las tarjetas'}
            >
              {hayAlgunaExpandida ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
              {hayAlgunaExpandida ? 'Contraer todo' : 'Expandir todo'}
            </button>
          )}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800">
            {(['clasico', 'compacto'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                className={clsx(
                  'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  vista === v ? 'bg-sol-500 text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tareas.length === 0 ? (
        <p className="text-sm text-slate-400">Sin tareas todavía — creá la primera con "Nueva tarea".</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNAS.map((col) => {
            const tareasColumnaTotal = tareas.filter((t) => t.estado === col.estado);
            const tareasColumna = tareasColumnaTotal.filter(pasaFiltros);
            const colapsada = columnasColapsadas.has(col.estado);

            if (colapsada) {
              return (
                <div
                  key={col.estado}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setColumnaDestacada(col.estado);
                  }}
                  onDragLeave={() => setColumnaDestacada((c) => (c === col.estado ? null : c))}
                  onDrop={(e) => onDropColumna(e, col.estado)}
                  className={clsx(
                    'flex w-11 shrink-0 flex-col items-center gap-2 rounded-lg border p-2 transition-colors',
                    columnaDestacada === col.estado
                      ? 'border-sol-400 bg-sol-50/60 dark:border-sol-500/60 dark:bg-sol-500/5'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => alternarColumna(col.estado)}
                    className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title={`Expandir ${col.etiqueta}`}
                  >
                    <ChevronRight size={14} />
                  </button>
                  <span className={clsx('h-2 w-2 shrink-0 rounded-full', col.dot)} />
                  <span className="rounded-full bg-white px-1.5 text-[10px] text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                    {tareasColumnaTotal.length}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={col.estado}
                onDragOver={(e) => {
                  e.preventDefault();
                  setColumnaDestacada(col.estado);
                }}
                onDragLeave={() => setColumnaDestacada((c) => (c === col.estado ? null : c))}
                onDrop={(e) => onDropColumna(e, col.estado)}
                className={clsx(
                  'flex min-w-[250px] flex-1 flex-col gap-2 rounded-lg border p-2 transition-colors',
                  columnaDestacada === col.estado
                    ? 'border-sol-400 bg-sol-50/60 dark:border-sol-500/60 dark:bg-sol-500/5'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30',
                )}
              >
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className={clsx('h-2 w-2 rounded-full', col.dot)} /> {col.etiqueta}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="rounded-full bg-white px-1.5 text-[10px] text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                      {hayFiltroActivo ? `${tareasColumna.length}/${tareasColumnaTotal.length}` : tareasColumnaTotal.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => alternarColumna(col.estado)}
                      className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title={`Contraer ${col.etiqueta}`}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {tareasColumna.length === 0 && (
                    <p className="px-1 text-xs text-slate-400">{hayFiltroActivo ? 'Sin coincidencias' : 'Sin tareas'}</p>
                  )}

                  {vista === 'clasico'
                    ? tareasColumna.map((t) => {
                        const expandida = tarjetasExpandidas.has(t.id);
                        return (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, t.id)}
                            onClick={() => setTareaAbierta(t)}
                            className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-sol-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sol-500/50"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className={clsx('h-2 w-2 shrink-0 rounded-full', PUNTO_PRIORIDAD[t.prioridad])} />
                                <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{t.titulo}</span>
                                {t.comentarios.length > 0 && (
                                  <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-slate-400" title={`${t.comentarios.length} comentario(s)`}>
                                    <MessageSquare size={11} /> {t.comentarios.length}
                                  </span>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => alternarTarjeta(t.id)}
                                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                  aria-label={expandida ? 'Contraer tarjeta' : 'Expandir tarjeta'}
                                >
                                  {expandida ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                <RowActionsMenu acciones={accionesTarea(t)} />
                              </div>
                            </div>

                            {/* Siempre visible (colapsada o no) — es una ACCIÓN (Iniciar/Pausar), no un detalle a esconder; mismo criterio que la vista Compacto, que también lo muestra siempre. */}
                            <div onClick={(e) => e.stopPropagation()}>{chipCronometro(t)}</div>

                            {expandida && (
                              <div className="mt-2 space-y-2">
                                {t.hitoId && hitoPorId[t.hitoId] && (
                                  <span className="inline-block truncate rounded bg-sol-50 px-1.5 py-0.5 text-[10px] font-medium text-sol-700 dark:bg-sol-500/10 dark:text-sol-400">
                                    {hitoPorId[t.hitoId]}
                                  </span>
                                )}
                                <div className="flex items-center justify-between">
                                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold', ESTILO_PRIORIDAD_TAREA[t.prioridad])}>
                                    {ETIQUETA_PRIORIDAD_TAREA[t.prioridad]}
                                  </span>
                                  {t.responsables.length > 0 && (
                                    <div className="flex -space-x-1.5">
                                      {t.responsables.map((r, i) => (
                                        <span
                                          key={r.empleado.id}
                                          title={r.empleado.nombre}
                                          className={clsx(
                                            'flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white dark:border-slate-900',
                                            PALETA_AVATAR[i % PALETA_AVATAR.length],
                                          )}
                                        >
                                          {inicialesDe(r.empleado.nombre)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {t.fechaVencimiento &&
                                  (() => {
                                    const vencimiento = estadoVencimiento(t.fechaVencimiento, t.estado);
                                    return vencimiento ? (
                                      <span className={clsx('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', CLASE_BADGE_VENCIMIENTO[vencimiento])}>
                                        {ETIQUETA_BADGE_VENCIMIENTO[vencimiento]}
                                      </span>
                                    ) : (
                                      <p className="text-xs text-slate-400">Vence {formatoFechaVencimiento(t.fechaVencimiento)}</p>
                                    );
                                  })()}
                              </div>
                            )}
                          </div>
                        );
                      })
                    : tareasColumna.map((t) => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, t.id)}
                          onClick={() => setTareaAbierta(t)}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:border-sol-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sol-500/50"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={clsx('h-2 w-2 shrink-0 rounded-full', PUNTO_PRIORIDAD[t.prioridad])} />
                            <span className="truncate font-medium text-slate-800 dark:text-slate-200">{t.titulo}</span>
                            {t.sesionesTrabajo.some((s) => s.empleadoId !== miEmpleadoId) && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" title="alguien más está trabajando en esto ahora" />
                            )}
                            {t.comentarios.length > 0 && (
                              <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-slate-400" title={`${t.comentarios.length} comentario(s)`}>
                                <MessageSquare size={10} /> {t.comentarios.length}
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {iconoCronometro(t)}
                            <RowActionsMenu acciones={accionesTarea(t)} />
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalCrearAbierto && (
        <TareaFormModal
          hitos={hitos}
          guardando={crearTarea.isPending}
          error={errorForm}
          onClose={() => {
            setModalCrearAbierto(false);
            setErrorForm(null);
          }}
          onGuardar={(valores) => crearTarea.mutate(valores)}
        />
      )}

      {modalIaAbierto && (
        <GenerarTareasIaModal
          nombreProyecto={proyectoNombre}
          descripcionInicial={proyectoDescripcion ?? undefined}
          onClose={() => setModalIaAbierto(false)}
          onCrear={crearPlanDesdeIa}
          creando={creandoDesdeIa}
        />
      )}

      {tareaEditando && (
        <TareaFormModal
          tareaInicial={tareaEditando}
          hitos={hitos}
          guardando={editarTarea.isPending}
          error={errorForm}
          onClose={() => {
            setTareaEditando(null);
            setErrorForm(null);
          }}
          onGuardar={(valores) => editarTarea.mutate(valores)}
        />
      )}

      {tareaAEliminar && (
        <ConfirmModal
          titulo="¿Eliminar esta tarea?"
          descripcion={
            <>
              Se eliminará <b>{tareaAEliminar.titulo}</b>
              {tareaAEliminar.registrosHoras.length > 0 && ' junto con las horas ya registradas en ella'}.
            </>
          }
          confirmando={eliminarTarea.isPending}
          onConfirmar={() => eliminarTarea.mutate(tareaAEliminar.id)}
          onCancelar={() => setTareaAEliminar(null)}
        />
      )}

      {tareaActual && (
        <Modal titulo={tareaActual.titulo} onClose={() => setTareaAbierta(null)} ancho="full">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setPanelComentariosAbierto((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <MessageSquare size={13} />
              Comentarios
              {tareaActual.comentarios.length > 0 && (
                <span className="rounded-full bg-sol-500 px-1.5 text-[10px] font-bold text-white">{tareaActual.comentarios.length}</span>
              )}
              {panelComentariosAbierto ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
            </button>
          </div>

          <div className={clsx('flex flex-col gap-5 md:items-start', panelComentariosAbierto && 'md:flex-row')}>
            <div className="min-w-0 flex-1 space-y-5">
              {/* Información — antes esto (Descripción, Prioridad, Hito, Fecha,
                  Estado) se capturaba bien al crear/editar pero nunca se veía
                  acá (bug real reportado: solo aparecía reabriendo "Editar").
                  Editable directo, mismo endpoint que ya usa `cambiarEstadoTarea`. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</label>
                  <Select
                    value={tareaActual.estado}
                    onChange={(e) => actualizarTarea.mutate({ tareaId: tareaActual.id, valores: { estado: e.target.value } })}
                    className="text-sm"
                  >
                    {ESTADOS_TAREA.map((es) => (
                      <option key={es} value={es}>
                        {ETIQUETA_ESTADO_TAREA[es]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Prioridad</label>
                  <Select
                    value={tareaActual.prioridad}
                    onChange={(e) => actualizarTarea.mutate({ tareaId: tareaActual.id, valores: { prioridad: e.target.value } })}
                    className="text-sm"
                  >
                    {PRIORIDADES_TAREA.map((p) => (
                      <option key={p} value={p}>
                        {ETIQUETA_PRIORIDAD_TAREA[p]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Hito</label>
                  <Select
                    value={tareaActual.hitoId ?? ''}
                    onChange={(e) => actualizarTarea.mutate({ tareaId: tareaActual.id, valores: { hitoId: e.target.value || null } })}
                    className="text-sm"
                  >
                    <option value="">Sin hito</option>
                    {hitos.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vencimiento</label>
                  <input
                    type="date"
                    value={tareaActual.fechaVencimiento ? tareaActual.fechaVencimiento.slice(0, 10) : ''}
                    onChange={(e) => actualizarTarea.mutate({ tareaId: tareaActual.id, valores: { fechaVencimiento: e.target.value || undefined } })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Descripción</h3>
                <DescripcionTarea
                  valorInicial={tareaActual.descripcion ?? ''}
                  onGuardar={(descripcion) => actualizarTarea.mutate({ tareaId: tareaActual.id, valores: { descripcion } })}
                />
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Responsables</h3>
                <SelectorResponsablesAvatar
                  responsables={tareaActual.responsables}
                  empleados={empleados ?? []}
                  onAsignar={(empleadoId) => asignarResponsable.mutate({ tareaId: tareaActual.id, empleadoId })}
                  onQuitar={(empleadoId) => quitarResponsable.mutate({ tareaId: tareaActual.id, empleadoId })}
                />
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
                  miEmpleadoId={miEmpleadoId}
                  onRegistrar={(empleadoId, fecha, horas) => registrarHora.mutate({ tareaId: tareaActual.id, empleadoId, fecha, horas })}
                  guardando={registrarHora.isPending}
                />
              </div>
            </div>

            {panelComentariosAbierto && (
              <div className="flex flex-col border-t border-slate-100 pt-5 dark:border-slate-800 md:h-[36rem] md:w-96 md:shrink-0 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                <h3 className="mb-1 shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Comentarios{tareaActual.comentarios.length > 0 && <span className="ml-1 font-normal text-slate-400">({tareaActual.comentarios.length})</span>}
                </h3>
                {/* min-h-0 es lo que hace que un flex item pueda encogerse por debajo de su contenido — sin esto, overflow-y-auto no scrollea nunca dentro de un flex column (bug real, confirmado: antes esta columna vivía en un `grid`, donde `flex-1` no hacía nada). */}
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {tareaActual.comentarios.length === 0 && <p className="py-2 text-xs text-slate-400">Sin comentarios todavía.</p>}
                  {tareaActual.comentarios.map((c, i) => (
                    <div key={c.id} className="group flex gap-2.5 border-b border-slate-100 py-2.5 first:pt-0 last:border-0 dark:border-slate-800">
                      <div
                        className={clsx(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
                          PALETA_AVATAR[i % PALETA_AVATAR.length],
                        )}
                      >
                        {inicialesDe(c.autor.nombre)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{c.autor.nombre}</span>{' '}
                            <span className="text-slate-400">{formatoFechaHoraComentario(c.createdAt)}</span>
                          </p>
                          {(c.autor.id === usuario?.id || puedeModerarComentarios) && (
                            <button
                              type="button"
                              onClick={() => eliminarComentario.mutate(c.id)}
                              className="shrink-0 text-slate-300 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                              aria-label="Eliminar comentario"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <div className="mt-0.5">
                          <ContenidoComentario contenido={c.contenido} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="shrink-0">
                  <FormularioComentario
                    onComentar={(contenido) => agregarComentario.mutate({ tareaId: tareaActual.id, contenido })}
                    guardando={agregarComentario.isPending}
                  />
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </Card>
  );
}

function FormularioHora({
  empleados,
  miEmpleadoId,
  onRegistrar,
  guardando,
}: {
  empleados: EmpleadoOpcion[];
  /** Precarga el select con quien está logueado (mismo criterio que el cronómetro) — sigue siendo editable para que un supervisor pueda cargar horas de otra persona. */
  miEmpleadoId: string | null;
  onRegistrar: (empleadoId: string, fecha: string, horas: string) => void;
  guardando: boolean;
}) {
  const [empleadoId, setEmpleadoId] = useState(miEmpleadoId ?? '');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState('');

  // Si `miEmpleado` todavía no había resuelto en el primer render (la query
  // no tiene ningún `enabled` que la demore, pero puede tardar un toque),
  // esto lo completa apenas llega — sin pisar una elección manual ya hecha.
  useEffect(() => {
    if (!empleadoId && miEmpleadoId) setEmpleadoId(miEmpleadoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miEmpleadoId]);

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

/** Guarda al salir del campo (blur), y solo si de verdad cambió — evita un PATCH por cada tecla. Deja de resincronizar con `valorInicial` mientras el usuario está escribiendo (foco activo), para no pisarle lo que está tipeando si en el medio se invalida la query. */
function DescripcionTarea({ valorInicial, onGuardar }: { valorInicial: string; onGuardar: (valor: string) => void }) {
  const [valor, setValor] = useState(valorInicial);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!editando) setValor(valorInicial);
  }, [valorInicial, editando]);

  return (
    <textarea
      rows={4}
      placeholder="Sin descripción — agregá una para que el equipo tenga contexto."
      value={valor}
      onFocus={() => setEditando(true)}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        setEditando(false);
        if (valor !== valorInicial) onGuardar(valor);
      }}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
    />
  );
}

/**
 * Avatares + popover para elegir responsables — reemplaza los chips de
 * texto + `<select>` de antes (pedido explícito, estilo ClickUp). Mismo
 * patrón de portal+posición ya usado en `RowActionsMenu` para escapar de
 * cualquier `overflow` recortado (acá, el propio `Modal`).
 */
function SelectorResponsablesAvatar({
  responsables,
  empleados,
  onAsignar,
  onQuitar,
}: {
  responsables: { empleado: { id: string; nombre: string } }[];
  empleados: EmpleadoOpcion[];
  onAsignar: (empleadoId: string) => void;
  onQuitar: (empleadoId: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    // `globalThis.MouseEvent` a propósito — este archivo ya importa el
    // `MouseEvent` de React (para el cronómetro), que no es asignable al
    // listener nativo de `document.addEventListener`.
    function onClickFuera(e: globalThis.MouseEvent) {
      const objetivo = e.target as Node;
      if (panelRef.current?.contains(objetivo) || botonRef.current?.contains(objetivo)) return;
      setAbierto(false);
    }
    function cerrar() {
      setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', onClickFuera);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [abierto]);

  function alternar() {
    if (!abierto && botonRef.current) {
      const rect = botonRef.current.getBoundingClientRect();
      const ANCHO_PANEL = 240;
      setPosicion({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - ANCHO_PANEL - 8) });
    }
    setAbierto((v) => !v);
  }

  const idsAsignados = new Set(responsables.map((r) => r.empleado.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {responsables.map((r, i) => (
        <div key={r.empleado.id} className="group relative">
          <span
            title={r.empleado.nombre}
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white dark:border-slate-900',
              PALETA_AVATAR[i % PALETA_AVATAR.length],
            )}
          >
            {inicialesDe(r.empleado.nombre)}
          </span>
          <button
            type="button"
            onClick={() => onQuitar(r.empleado.id)}
            aria-label={`Quitar a ${r.empleado.nombre}`}
            className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[9px] text-white hover:bg-red-600 group-hover:flex"
          >
            ×
          </button>
        </div>
      ))}
      <button
        ref={botonRef}
        type="button"
        onClick={alternar}
        aria-label="Agregar responsable"
        title="Agregar responsable"
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400 hover:border-sol-400 hover:text-sol-600 dark:border-slate-700 dark:text-slate-500"
      >
        <UserPlus size={14} />
      </button>

      {abierto &&
        posicion &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: posicion.top, left: posicion.left }}
            className="z-50 max-h-64 w-60 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Responsables</p>
            {empleados.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Sin empleados disponibles.</p>}
            {empleados.map((emp, i) => {
              const asignado = idsAsignados.has(emp.id);
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => (asignado ? onQuitar(emp.id) : onAsignar(emp.id))}
                  className={clsx(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    asignado
                      ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/20 dark:text-sol-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white',
                      PALETA_AVATAR[i % PALETA_AVATAR.length],
                    )}
                  >
                    {inicialesDe(emp.nombre)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{emp.nombre}</span>
                  {asignado && <span className="text-xs">✓</span>}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

// Debe calzar con LARGO_MAXIMO_COMENTARIO del backend
// (`crear-comentario-tarea.dto.ts`) — acá solo para el contador y el
// `maxLength` nativo del textarea (que trunca un paste largo en vez de
// dejar que el usuario descubra el límite con un 400 recién al enviar).
const LARGO_MAXIMO_COMENTARIO = 20000;
const UMBRAL_AVISO_LARGO_COMENTARIO = LARGO_MAXIMO_COMENTARIO * 0.9;

function FormularioComentario({ onComentar, guardando }: { onComentar: (contenido: string) => void; guardando: boolean }) {
  const [contenido, setContenido] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <form
      className="mt-3 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700"
      onSubmit={(e) => {
        e.preventDefault();
        if (contenido.trim()) {
          onComentar(contenido.trim());
          setContenido('');
        }
      }}
    >
      <textarea
        ref={textareaRef}
        rows={2}
        maxLength={LARGO_MAXIMO_COMENTARIO}
        placeholder="Escribí un comentario para el equipo — usá ``` para un bloque de código…"
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        className="w-full resize-none border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      <div className="flex items-center justify-between gap-2">
        <BarraFormato textareaRef={textareaRef} valor={contenido} onChange={setContenido} />
        <div className="flex items-center gap-2">
          {contenido.length >= UMBRAL_AVISO_LARGO_COMENTARIO && (
            <span
              className={clsx(
                'text-xs tabular-nums',
                contenido.length >= LARGO_MAXIMO_COMENTARIO ? 'text-red-500' : 'text-slate-400 dark:text-slate-500',
              )}
            >
              {contenido.length.toLocaleString('es-DO')} / {LARGO_MAXIMO_COMENTARIO.toLocaleString('es-DO')}
            </span>
          )}
          <Button type="submit" disabled={!contenido.trim() || guardando}>
            {guardando ? 'Enviando…' : 'Comentar'}
          </Button>
        </div>
      </div>
    </form>
  );
}
