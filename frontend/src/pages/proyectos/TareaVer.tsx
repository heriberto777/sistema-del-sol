import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Trash2, UserPlus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { useAuth } from '../../hooks/useAuth';
import { useAutoAlturaTextarea } from '../../hooks/useAutoAlturaTextarea';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Badge } from '../../components/atoms/Badge/Badge';
import { Button } from '../../components/atoms/Button/Button';
import { Select } from '../../components/atoms/Select/Select';
import { FormField } from '../../components/molecules/FormField/FormField';
import { ConfirmModal } from '../../components/molecules/ConfirmModal/ConfirmModal';
import { BarraFormato, ContenidoComentario } from '../../components/molecules/ComentarioFormato/ComentarioFormato';
import { inicialesDe } from '../../lib/iniciales';
import { formatoFechaHoraComentario } from '../../lib/fecha';
import {
  EmpleadoOpcion,
  ESTADOS_TAREA,
  ETIQUETA_ESTADO_TAREA,
  ESTILO_PRIORIDAD_TAREA,
  ETIQUETA_PRIORIDAD_TAREA,
  PRIORIDADES_TAREA,
  ProyectoDetalleDto,
  Tarea,
} from '../../types/proyectos';

const PALETA_AVATAR = ['bg-sol-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500'];

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * TareaFormModal.tsx (modo "Editar") + el modal de detalle que vivía
 * inline en KanbanTareas.tsx (`tareaAbierta`). Mismo criterio de edición
 * directa (sin botón "Guardar" aparte) que ya tenía el modal de detalle —
 * Estado/Prioridad/Hito/Vencimiento y Descripción se guardan solos al
 * cambiarlos, igual que el título acá (antes solo editable reabriendo
 * TareaFormModal).
 */
export function TareaVer() {
  const { id: proyectoId, tareaId } = useParams<{ id: string; tareaId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { usuario, tienePermiso } = useAuth();
  const puedeEditar = tienePermiso('proyectos.editar');
  const puedeModerarComentarios = puedeEditar;

  const { data: tarea } = useQuery({
    queryKey: ['proyecto-tarea', tareaId],
    queryFn: async () => (await apiClient.get<Tarea>(`/admin/proyectos/tareas/${tareaId}`)).data,
  });
  const { data: proyecto } = useQuery({
    queryKey: ['proyecto', proyectoId],
    queryFn: async () => (await apiClient.get<ProyectoDetalleDto>(`/admin/proyectos/${proyectoId}`)).data,
  });
  const { data: empleados } = useQuery({
    queryKey: ['proyectos-empleados-opciones'],
    queryFn: async () => (await apiClient.get<EmpleadoOpcion[]>('/admin/proyectos/empleados')).data,
  });
  const { data: miEmpleado } = useQuery({
    queryKey: ['proyectos-mi-empleado'],
    queryFn: async () => (await apiClient.get<{ empleadoId: string | null }>('/admin/proyectos/mi-empleado')).data,
  });
  const miEmpleadoId = miEmpleado?.empleadoId ?? null;

  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['proyecto-tarea', tareaId] });
    queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
  }

  const actualizarTarea = useMutation({
    mutationFn: async (valores: Partial<{ titulo: string; descripcion: string; hitoId: string | null; prioridad: string; estado: string; fechaVencimiento: string | null }>) =>
      apiClient.patch(`/admin/proyectos/tareas/${tareaId}`, valores),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo actualizar la tarea.')),
  });

  const eliminarTarea = useMutation({
    mutationFn: async () => apiClient.delete(`/admin/proyectos/tareas/${tareaId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
      navigate(`/proyectos/${proyectoId}/tablero`);
    },
    onError: (err) => {
      setError(mensajeErrorApi(err, 'No se pudo eliminar la tarea.'));
      setEliminando(false);
    },
  });

  const asignarResponsable = useMutation({
    mutationFn: async (empleadoId: string) => apiClient.post(`/admin/proyectos/tareas/${tareaId}/responsables/${empleadoId}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo asignar el responsable.')),
  });

  const quitarResponsable = useMutation({
    mutationFn: async (empleadoId: string) => apiClient.delete(`/admin/proyectos/tareas/${tareaId}/responsables/${empleadoId}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo quitar el responsable.')),
  });

  const registrarHora = useMutation({
    mutationFn: async ({ empleadoId, fecha, horas }: { empleadoId: string; fecha: string; horas: string }) =>
      apiClient.post(`/admin/proyectos/tareas/${tareaId}/horas`, { empleadoId, fecha, horas: Number(horas) }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar la hora.')),
  });

  const agregarComentario = useMutation({
    mutationFn: async (contenido: string) => apiClient.post(`/admin/proyectos/tareas/${tareaId}/comentarios`, { contenido }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo agregar el comentario.')),
  });

  const eliminarComentario = useMutation({
    mutationFn: async (comentarioId: string) => apiClient.delete(`/admin/proyectos/comentarios/${comentarioId}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar el comentario.')),
  });

  if (!tarea || !proyecto) {
    return (
      <PaginaDocumento titulo="Tarea" rutaVolver={`/proyectos/${proyectoId}/tablero`} etiquetaVolver="Volver al tablero" haycambios={false} resumen={null} acciones={null}>
        <p className="text-sm text-slate-400">Cargando…</p>
      </PaginaDocumento>
    );
  }

  return (
    <PaginaDocumento
      titulo={tarea.titulo}
      rutaVolver={`/proyectos/${proyectoId}/tablero`}
      etiquetaVolver="Volver al tablero"
      haycambios={false}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
            <Badge>{ETIQUETA_ESTADO_TAREA[tarea.estado] ?? tarea.estado}</Badge>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Prioridad</span>
            <span className={clsx('inline-block w-fit rounded-full px-2 py-0.5 text-xs font-semibold', ESTILO_PRIORIDAD_TAREA[tarea.prioridad])}>
              {ETIQUETA_PRIORIDAD_TAREA[tarea.prioridad]}
            </span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {puedeEditar && (
            <Button type="button" variante="peligro" className="w-full" onClick={() => setEliminando(true)}>
              Eliminar
            </Button>
          )}
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/proyectos/${proyectoId}/tablero`)}>
            Volver
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Card titulo="Información">
          <div className="sm:col-span-2">
            <TituloTarea valorInicial={tarea.titulo} disabled={!puedeEditar} onGuardar={(titulo) => actualizarTarea.mutate({ titulo })} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</label>
            <Select value={tarea.estado} disabled={!puedeEditar} onChange={(e) => actualizarTarea.mutate({ estado: e.target.value })} className="text-sm">
              {ESTADOS_TAREA.map((es) => (
                <option key={es} value={es}>
                  {ETIQUETA_ESTADO_TAREA[es]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Prioridad</label>
            <Select value={tarea.prioridad} disabled={!puedeEditar} onChange={(e) => actualizarTarea.mutate({ prioridad: e.target.value })} className="text-sm">
              {PRIORIDADES_TAREA.map((p) => (
                <option key={p} value={p}>
                  {ETIQUETA_PRIORIDAD_TAREA[p]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Hito</label>
            <Select value={tarea.hitoId ?? ''} disabled={!puedeEditar} onChange={(e) => actualizarTarea.mutate({ hitoId: e.target.value || null })} className="text-sm">
              <option value="">Sin hito</option>
              {proyecto.hitos.map((h) => (
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
              value={tarea.fechaVencimiento ? tarea.fechaVencimiento.slice(0, 10) : ''}
              disabled={!puedeEditar}
              onChange={(e) => actualizarTarea.mutate({ fechaVencimiento: e.target.value || null })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción</label>
            <DescripcionTarea valorInicial={tarea.descripcion ?? ''} disabled={!puedeEditar} onGuardar={(descripcion) => actualizarTarea.mutate({ descripcion })} />
          </div>
        </Card>

        <Card titulo="Responsables">
          <div className="sm:col-span-2">
            <SelectorResponsablesAvatar
              responsables={tarea.responsables}
              empleados={empleados ?? []}
              disabled={!puedeEditar}
              onAsignar={(empleadoId) => asignarResponsable.mutate(empleadoId)}
              onQuitar={(empleadoId) => quitarResponsable.mutate(empleadoId)}
            />
          </div>
        </Card>

        <Card titulo="Horas registradas">
          <div className="sm:col-span-2 space-y-1">
            {tarea.registrosHoras.length === 0 && <p className="text-xs text-slate-400">Sin horas cargadas todavía.</p>}
            {tarea.registrosHoras.map((r) => (
              <div key={r.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>
                  {r.empleado.nombre} — {new Date(r.fecha).toLocaleDateString('es-DO')}
                </span>
                <span className="font-medium">{r.horas}h</span>
              </div>
            ))}
            <FormularioHora empleados={empleados ?? []} miEmpleadoId={miEmpleadoId} onRegistrar={(empleadoId, fecha, horas) => registrarHora.mutate({ empleadoId, fecha, horas })} guardando={registrarHora.isPending} />
          </div>
        </Card>

        <Card titulo="Comentarios">
          <div className="sm:col-span-2 space-y-1">
            {tarea.comentarios.length === 0 && <p className="py-2 text-xs text-slate-400">Sin comentarios todavía.</p>}
            {tarea.comentarios.map((c, i) => (
              <div key={c.id} className="group flex gap-2.5 border-b border-slate-100 py-2.5 first:pt-0 last:border-0 dark:border-slate-800">
                <div className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white', PALETA_AVATAR[i % PALETA_AVATAR.length])}>
                  {inicialesDe(c.autor.nombre)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{c.autor.nombre}</span>{' '}
                      <span className="text-slate-400">{formatoFechaHoraComentario(c.createdAt)}</span>
                    </p>
                    {(c.autor.id === usuario?.id || puedeModerarComentarios) && (
                      <button type="button" onClick={() => eliminarComentario.mutate(c.id)} className="shrink-0 text-slate-300 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100" aria-label="Eliminar comentario">
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
            <FormularioComentario onComentar={(contenido) => agregarComentario.mutate(contenido)} guardando={agregarComentario.isPending} />
          </div>
        </Card>
      </div>

      {eliminando && (
        <ConfirmModal
          titulo="¿Eliminar esta tarea?"
          descripcion={
            <>
              Se eliminará <b>{tarea.titulo}</b>
              {tarea.registrosHoras.length > 0 && ' junto con las horas ya registradas en ella'}.
            </>
          }
          confirmando={eliminarTarea.isPending}
          onConfirmar={() => eliminarTarea.mutate()}
          onCancelar={() => setEliminando(false)}
        />
      )}
    </PaginaDocumento>
  );
}

/** Guarda al salir del campo (blur), y solo si de verdad cambió — mismo criterio que DescripcionTarea. */
function TituloTarea({ valorInicial, disabled, onGuardar }: { valorInicial: string; disabled: boolean; onGuardar: (valor: string) => void }) {
  const [valor, setValor] = useState(valorInicial);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!editando) setValor(valorInicial);
  }, [valorInicial, editando]);

  return (
    <input
      type="text"
      value={valor}
      disabled={disabled}
      onFocus={() => setEditando(true)}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        setEditando(false);
        if (valor.trim() && valor !== valorInicial) onGuardar(valor);
        else setValor(valorInicial);
      }}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-semibold text-slate-900 outline-none transition-colors focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  );
}

/** Guarda al salir del campo (blur), y solo si de verdad cambió — evita un PATCH por cada tecla. Deja de resincronizar con `valorInicial` mientras el usuario está escribiendo (foco activo), para no pisarle lo que está tipeando si en el medio se invalida la query. */
function DescripcionTarea({ valorInicial, disabled, onGuardar }: { valorInicial: string; disabled: boolean; onGuardar: (valor: string) => void }) {
  const [valor, setValor] = useState(valorInicial);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!editando) setValor(valorInicial);
  }, [valorInicial, editando]);

  return (
    <textarea
      rows={4}
      disabled={disabled}
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

function FormularioHora({
  empleados,
  miEmpleadoId,
  onRegistrar,
  guardando,
}: {
  empleados: EmpleadoOpcion[];
  miEmpleadoId: string | null;
  onRegistrar: (empleadoId: string, fecha: string, horas: string) => void;
  guardando: boolean;
}) {
  const [empleadoId, setEmpleadoId] = useState(miEmpleadoId ?? '');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState('');

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

/** Avatares + popover para elegir responsables — mismo patrón de portal+posición ya usado en `RowActionsMenu`. */
function SelectorResponsablesAvatar({
  responsables,
  empleados,
  disabled,
  onAsignar,
  onQuitar,
}: {
  responsables: { empleado: { id: string; nombre: string } }[];
  empleados: EmpleadoOpcion[];
  disabled: boolean;
  onAsignar: (empleadoId: string) => void;
  onQuitar: (empleadoId: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
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
            className={clsx('flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white dark:border-slate-900', PALETA_AVATAR[i % PALETA_AVATAR.length])}
          >
            {inicialesDe(r.empleado.nombre)}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => onQuitar(r.empleado.id)}
              aria-label={`Quitar a ${r.empleado.nombre}`}
              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[9px] text-white hover:bg-red-600 group-hover:flex"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && (
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
      )}

      {abierto &&
        posicion &&
        createPortal(
          <div ref={panelRef} style={{ position: 'fixed', top: posicion.top, left: posicion.left }} className="z-50 max-h-64 w-60 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
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
                    asignado ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/20 dark:text-sol-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  <span className={clsx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white', PALETA_AVATAR[i % PALETA_AVATAR.length])}>{inicialesDe(emp.nombre)}</span>
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

const LARGO_MAXIMO_COMENTARIO = 20000;
const UMBRAL_AVISO_LARGO_COMENTARIO = LARGO_MAXIMO_COMENTARIO * 0.9;

function FormularioComentario({ onComentar, guardando }: { onComentar: (contenido: string) => void; guardando: boolean }) {
  const [contenido, setContenido] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useAutoAlturaTextarea(textareaRef, contenido);

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
            <span className={clsx('text-xs tabular-nums', contenido.length >= LARGO_MAXIMO_COMENTARIO ? 'text-red-500' : 'text-slate-400 dark:text-slate-500')}>
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
