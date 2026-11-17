import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { Select } from '../../components/atoms/Select/Select';
import { FormField } from '../../components/molecules/FormField/FormField';
import { useHayCambios } from '../../hooks/useHayCambios';
import { ETIQUETA_PRIORIDAD_TAREA, PRIORIDADES_TAREA, ProyectoDetalleDto } from '../../types/proyectos';

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza al modo
 * "Nueva tarea" de TareaFormModal.tsx (abierto antes desde KanbanTareas.tsx).
 * El `estado` no se pide acá (siempre arranca en Pendiente), igual que el
 * modal original.
 */
export function TareaNueva() {
  const { id: proyectoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [hitoId, setHitoId] = useState('');
  const [prioridad, setPrioridad] = useState('MEDIA');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: proyecto } = useQuery({
    queryKey: ['proyecto', proyectoId],
    queryFn: async () => (await apiClient.get<ProyectoDetalleDto>(`/admin/proyectos/${proyectoId}`)).data,
  });

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post(`/admin/proyectos/${proyectoId}/tareas`, {
        titulo,
        descripcion: descripcion || undefined,
        hitoId: hitoId || null,
        prioridad,
        fechaVencimiento: fechaVencimiento || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
      confirmarGuardado();
      navigate(`/proyectos/${proyectoId}/tablero`);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la tarea.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!titulo.trim()) {
      setError('Ingresá un título.');
      return;
    }
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ titulo, descripcion, hitoId, prioridad, fechaVencimiento });

  return (
    <PaginaDocumento
      titulo="Nueva tarea"
      rutaVolver={`/proyectos/${proyectoId}/tablero`}
      etiquetaVolver="Volver al tablero"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Título</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo || 'Sin título'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-tarea-nueva" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Guardando…' : 'Crear tarea'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/proyectos/${proyectoId}/tablero`)}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-tarea-nueva" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Datos de la tarea">
          <div className="sm:col-span-2">
            <FormField id="tarea-titulo" label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} required autoFocus />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción (opcional)</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Hito (opcional)</label>
            <Select value={hitoId} onChange={(e) => setHitoId(e.target.value)}>
              <option value="">Sin hito</option>
              {proyecto?.hitos.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prioridad</label>
            <Select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              {PRIORIDADES_TAREA.map((p) => (
                <option key={p} value={p}>
                  {ETIQUETA_PRIORIDAD_TAREA[p]}
                </option>
              ))}
            </Select>
          </div>
          <FormField id="tarea-fecha-vencimiento" label="Fecha de vencimiento (opcional)" type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
        </Card>
      </form>
    </PaginaDocumento>
  );
}
