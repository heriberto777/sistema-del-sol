import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { EmpleadoOpcion, ProyectoDetalleDto } from '../../../types/proyectos';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface ClienteOpcion {
  id: string;
  nombre: string;
}

interface EditarProyectoModalProps {
  proyecto: ProyectoDetalleDto;
  onClose: () => void;
  onGuardado: () => void;
}

/**
 * El `estado` del proyecto sigue editándose solo desde el `<Select>` del
 * header (ver `ProyectoDetalle.tsx`) — este modal no lo duplica, para no
 * tener dos controles distintos cambiando el mismo campo.
 */
export function EditarProyectoModal({ proyecto, onClose, onGuardado }: EditarProyectoModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
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
  const [error, setError] = useState<string | null>(null);

  const { data: clientes } = useQuery({
    queryKey: ['clientes-opciones'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ClienteOpcion>>('/clientes', { params: { tamanoPagina: 200 } })).data.datos,
  });

  const { data: empleados } = useQuery({
    queryKey: ['proyectos-empleados-opciones'],
    queryFn: async () => (await apiClient.get<EmpleadoOpcion[]>('/admin/proyectos/empleados')).data,
  });

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/admin/proyectos/${proyecto.id}`, {
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
        clienteId: form.clienteId,
        responsableId: form.responsableId || null,
        presupuesto: form.presupuesto !== '' ? Number(form.presupuesto) : undefined,
        modoFacturacion: form.modoFacturacion,
        tarifaHoraFacturable:
          form.modoFacturacion === 'POR_HORAS' && form.tarifaHoraFacturable !== '' ? Number(form.tarifaHoraFacturable) : undefined,
        fechaInicio: form.fechaInicio || undefined,
        fechaFinEstimada: form.fechaFinEstimada || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      onGuardado();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el proyecto.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <Modal titulo="Editar proyecto" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="editar-proyecto-nombre" label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />

        <div className="flex flex-col gap-1">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            id="editar-proyecto-fecha-inicio"
            label="Fecha de inicio (opcional)"
            type="date"
            value={form.fechaInicio}
            onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
          />
          <FormField
            id="editar-proyecto-fecha-fin"
            label="Fecha fin estimada (opcional)"
            type="date"
            value={form.fechaFinEstimada}
            onChange={(e) => setForm({ ...form, fechaFinEstimada: e.target.value })}
          />
        </div>

        <FormField
          id="editar-proyecto-presupuesto"
          label="Presupuesto (opcional)"
          type="number"
          min="0"
          value={form.presupuesto}
          onChange={(e) => setForm({ ...form, presupuesto: e.target.value })}
        />

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

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
