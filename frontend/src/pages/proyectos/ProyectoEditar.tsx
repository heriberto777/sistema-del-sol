import { FormEvent, useEffect, useState } from 'react';
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
import { EmpleadoOpcion, ProyectoDetalleDto } from '../../types/proyectos';
import { PaginaResultado } from '../../types/pagina-resultado';

interface ClienteOpcion {
  id: string;
  nombre: string;
}

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * EditarProyectoModal.tsx, abierto antes desde ProyectoDetalle.tsx. El
 * `estado` sigue editándose solo desde el `<Select>` del header de
 * ProyectoDetalle — esta página no lo duplica, mismo criterio que el
 * modal original.
 */
export function ProyectoEditar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: proyecto } = useQuery({
    queryKey: ['proyecto', id],
    queryFn: async () => (await apiClient.get<ProyectoDetalleDto>(`/admin/proyectos/${id}`)).data,
  });
  const { data: clientes } = useQuery({
    queryKey: ['clientes-opciones'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ClienteOpcion>>('/clientes', { params: { tamanoPagina: 200 } })).data.datos,
  });
  const { data: empleados } = useQuery({
    queryKey: ['proyectos-empleados-opciones'],
    queryFn: async () => (await apiClient.get<EmpleadoOpcion[]>('/admin/proyectos/empleados')).data,
  });

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    clienteId: '',
    responsableId: '',
    presupuesto: '',
    modoFacturacion: 'PRECIO_FIJO',
    tarifaHoraFacturable: '',
    fechaInicio: '',
    fechaFinEstimada: '',
  });
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (proyecto && !cargado) {
      setForm({
        nombre: proyecto.nombre,
        descripcion: proyecto.descripcion ?? '',
        clienteId: proyecto.cliente.id,
        responsableId: proyecto.responsable?.id ?? '',
        presupuesto: proyecto.presupuesto ?? '',
        modoFacturacion: proyecto.modoFacturacion,
        tarifaHoraFacturable: proyecto.tarifaHoraFacturable ?? '',
        fechaInicio: proyecto.fechaInicio ? proyecto.fechaInicio.slice(0, 10) : '',
        fechaFinEstimada: proyecto.fechaFinEstimada ? proyecto.fechaFinEstimada.slice(0, 10) : '',
      });
      setCargado(true);
    }
  }, [proyecto, cargado]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/admin/proyectos/${id}`, {
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
        clienteId: form.clienteId,
        responsableId: form.responsableId || null,
        presupuesto: form.presupuesto !== '' ? Number(form.presupuesto) : undefined,
        modoFacturacion: form.modoFacturacion,
        tarifaHoraFacturable: form.modoFacturacion === 'POR_HORAS' && form.tarifaHoraFacturable !== '' ? Number(form.tarifaHoraFacturable) : undefined,
        fechaInicio: form.fechaInicio || undefined,
        fechaFinEstimada: form.fechaFinEstimada || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      queryClient.invalidateQueries({ queryKey: ['proyecto', id] });
      confirmarGuardado();
      navigate(`/proyectos/${id}/resumen`);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el proyecto.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios(form, cargado);

  return (
    <PaginaDocumento
      titulo={proyecto ? `Editar — ${proyecto.nombre}` : 'Editar proyecto'}
      rutaVolver={`/proyectos/${id}/resumen`}
      etiquetaVolver="Volver al proyecto"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{clientes?.find((c) => c.id === form.clienteId)?.nombre ?? '—'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-proyecto-editar" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/proyectos/${id}/resumen`)}>
            Cancelar
          </Button>
        </>
      }
    >
      {!proyecto ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form id="form-proyecto-editar" onSubmit={onSubmit} className="space-y-4">
          <Card titulo="Datos del proyecto">
            <div className="sm:col-span-2">
              <FormField id="editar-proyecto-nombre" label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción (opcional)</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                rows={3}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
              <Select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} required>
                <option value="">Elegí un cliente…</option>
                {clientes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Responsable (opcional)</label>
              <Select value={form.responsableId} onChange={(e) => setForm({ ...form, responsableId: e.target.value })}>
                <option value="">Sin responsable</option>
                {empleados?.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <FormField id="editar-proyecto-fecha-inicio" label="Fecha de inicio (opcional)" type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
            <FormField
              id="editar-proyecto-fecha-fin"
              label="Fecha fin estimada (opcional)"
              type="date"
              value={form.fechaFinEstimada}
              onChange={(e) => setForm({ ...form, fechaFinEstimada: e.target.value })}
            />
            <FormField id="editar-proyecto-presupuesto" label="Presupuesto (opcional)" type="number" min="0" value={form.presupuesto} onChange={(e) => setForm({ ...form, presupuesto: e.target.value })} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Modo de facturación</label>
              <Select value={form.modoFacturacion} onChange={(e) => setForm({ ...form, modoFacturacion: e.target.value })}>
                <option value="PRECIO_FIJO">Precio fijo por hito</option>
                <option value="POR_HORAS">Por horas trabajadas</option>
              </Select>
            </div>
            {form.modoFacturacion === 'POR_HORAS' && (
              <FormField
                id="editar-proyecto-tarifa"
                label="Tarifa por hora a cobrar al cliente"
                type="number"
                min="0"
                value={form.tarifaHoraFacturable}
                onChange={(e) => setForm({ ...form, tarifaHoraFacturable: e.target.value })}
                required
              />
            )}
          </Card>
        </form>
      )}
    </PaginaDocumento>
  );
}
