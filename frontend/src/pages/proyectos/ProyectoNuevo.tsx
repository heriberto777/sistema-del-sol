import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { Select } from '../../components/atoms/Select/Select';
import { FormField } from '../../components/molecules/FormField/FormField';
import { RequierePermiso } from '../../components/organisms/RequierePermiso/RequierePermiso';
import { GenerarTareasIaModal, PlanIaParaCrear } from '../../components/organisms/GenerarTareasIaModal/GenerarTareasIaModal';
import { useHayCambios } from '../../hooks/useHayCambios';
import { PaginaResultado } from '../../types/pagina-resultado';

const PLAN_IA_VACIO: PlanIaParaCrear = { hitos: [], sueltas: [] };

interface ClienteOpcion {
  id: string;
  nombre: string;
}

interface EmpleadoOpcion {
  id: string;
  nombre: string;
}

const FORM_VACIO = { nombre: '', clienteId: '', responsableId: '', presupuesto: '', modoFacturacion: 'PRECIO_FIJO', tarifaHoraFacturable: '' };

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza al modal
 * "Nuevo proyecto" de Proyectos.tsx (no estaba nombrado en la auditoría,
 * que solo mencionaba "editar proyecto", pero dejarlo en modal mientras
 * Editar pasa a página hubiera sido la misma migración a medias que el
 * propio documento de auditoría señala para Inventario). GenerarTareasIaModal
 * queda como modal — es un asistente embebido dentro de este formulario
 * (alta inline), no una pantalla de gestión propia.
 */
export function ProyectoNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState<string | null>(null);
  const [modalIaAbierto, setModalIaAbierto] = useState(false);
  const [planIaPendiente, setPlanIaPendiente] = useState<PlanIaParaCrear>(PLAN_IA_VACIO);

  const { data: clientes } = useQuery({
    queryKey: ['clientes-opciones'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ClienteOpcion>>('/clientes', { params: { tamanoPagina: 200 } })).data.datos,
  });
  const { data: empleados } = useQuery({
    queryKey: ['proyectos-empleados-opciones'],
    queryFn: async () => (await apiClient.get<EmpleadoOpcion[]>('/admin/proyectos/empleados')).data,
  });

  const crear = useMutation({
    mutationFn: async () => {
      const { data: proyecto } = await apiClient.post<{ id: string }>('/admin/proyectos', {
        nombre: form.nombre,
        clienteId: form.clienteId,
        responsableId: form.responsableId || undefined,
        presupuesto: form.presupuesto ? Number(form.presupuesto) : undefined,
        modoFacturacion: form.modoFacturacion,
        tarifaHoraFacturable: form.modoFacturacion === 'POR_HORAS' && form.tarifaHoraFacturable ? Number(form.tarifaHoraFacturable) : undefined,
      });
      // El plan sugerido por IA (si el usuario generó uno antes de enviar
      // el formulario) recién se puede crear una vez que el proyecto
      // existe de verdad — ver GenerarTareasIaModal.
      for (const h of planIaPendiente.hitos) {
        const { data: hito } = await apiClient.post<{ id: string }>(`/admin/proyectos/${proyecto.id}/hitos`, { nombre: h.nombre });
        for (const t of h.tareas) {
          await apiClient.post(`/admin/proyectos/${proyecto.id}/tareas`, { titulo: t.titulo, prioridad: t.prioridad, hitoId: hito.id });
        }
      }
      for (const t of planIaPendiente.sueltas) {
        await apiClient.post(`/admin/proyectos/${proyecto.id}/tareas`, { titulo: t.titulo, prioridad: t.prioridad, hitoId: null });
      }
      return proyecto;
    },
    onSuccess: (proyecto) => {
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      confirmarGuardado();
      navigate(`/proyectos/${proyecto.id}/resumen`);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el proyecto.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ form, planIaPendiente });

  return (
    <PaginaDocumento
      titulo="Nuevo proyecto"
      rutaVolver="/proyectos"
      etiquetaVolver="Volver a Proyectos"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{clientes?.find((c) => c.id === form.clienteId)?.nombre ?? 'Sin seleccionar'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-proyecto-nuevo" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Guardando…' : 'Crear proyecto'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/proyectos')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-proyecto-nuevo" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Datos del proyecto">
          <div className="sm:col-span-2">
            <FormField id="proyecto-nombre" label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
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
          <FormField id="proyecto-presupuesto" label="Presupuesto (opcional)" type="number" min="0" value={form.presupuesto} onChange={(e) => setForm({ ...form, presupuesto: e.target.value })} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Modo de facturación</label>
            <Select value={form.modoFacturacion} onChange={(e) => setForm({ ...form, modoFacturacion: e.target.value })}>
              <option value="PRECIO_FIJO">Precio fijo por hito</option>
              <option value="POR_HORAS">Por horas trabajadas</option>
            </Select>
          </div>
          {form.modoFacturacion === 'POR_HORAS' && (
            <FormField
              id="proyecto-tarifa"
              label="Tarifa por hora a cobrar al cliente"
              type="number"
              min="0"
              value={form.tarifaHoraFacturable}
              onChange={(e) => setForm({ ...form, tarifaHoraFacturable: e.target.value })}
              required
            />
          )}
        </Card>

        <Card titulo="Tareas iniciales (opcional)">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <RequierePermiso permiso="proyectos.ia_generar">
              <Button type="button" variante="secundario" icon={Sparkles} disabled={!form.nombre.trim()} onClick={() => setModalIaAbierto(true)}>
                Generar tareas con IA
              </Button>
            </RequierePermiso>
            {(planIaPendiente.hitos.length > 0 || planIaPendiente.sueltas.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {planIaPendiente.hitos.map((h, i) => (
                  <span key={`hito-${i}`} className="flex items-center gap-1 rounded-full bg-sol-50 px-2.5 py-1 text-xs text-sol-700 dark:bg-sol-500/10 dark:text-sol-400">
                    {h.nombre} ({h.tareas.length})
                    <button
                      type="button"
                      onClick={() => setPlanIaPendiente((actual) => ({ ...actual, hitos: actual.hitos.filter((_, j) => j !== i) }))}
                      className="text-sol-400 hover:text-red-600"
                      aria-label="Quitar"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {planIaPendiente.sueltas.map((t, i) => (
                  <span key={`suelta-${i}`} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {t.titulo}
                    <button
                      type="button"
                      onClick={() => setPlanIaPendiente((actual) => ({ ...actual, sueltas: actual.sueltas.filter((_, j) => j !== i) }))}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Quitar"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <span className="text-xs text-slate-400">se crearán junto con el proyecto</span>
              </div>
            )}
          </div>
        </Card>
      </form>

      {modalIaAbierto && (
        <GenerarTareasIaModal
          nombreProyecto={form.nombre}
          onClose={() => setModalIaAbierto(false)}
          onCrear={(plan) => {
            setPlanIaPendiente((actual) => ({ hitos: [...actual.hitos, ...plan.hitos], sueltas: [...actual.sueltas, ...plan.sueltas] }));
            setModalIaAbierto(false);
          }}
        />
      )}
    </PaginaDocumento>
  );
}
