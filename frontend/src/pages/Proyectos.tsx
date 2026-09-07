import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface ProyectoResumen {
  id: string;
  nombre: string;
  cliente: { id: string; nombre: string };
  responsable: { id: string; nombre: string } | null;
  estado: string;
  presupuesto: string | null;
}

interface ClienteOpcion {
  id: string;
  nombre: string;
}

interface EmpleadoOpcion {
  id: string;
  nombre: string;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  PLANIFICADO: 'Planificado',
  EN_CURSO: 'En curso',
  PAUSADO: 'Pausado',
  TERMINADO: 'Terminado',
  CANCELADO: 'Cancelado',
};

const FORM_VACIO = { nombre: '', clienteId: '', responsableId: '', presupuesto: '', modoFacturacion: 'PRECIO_FIJO', tarifaHoraFacturable: '' };

export function Proyectos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['proyectos', pagina, busquedaDebounced],
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<ProyectoResumen>>('/admin/proyectos', { params: { pagina, busqueda: busquedaDebounced || undefined } })).data,
  });

  const { data: clientes } = useQuery({
    queryKey: ['clientes-opciones'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ClienteOpcion>>('/clientes', { params: { tamanoPagina: 200 } })).data.datos,
    enabled: modalAbierto,
  });

  const { data: empleados } = useQuery({
    queryKey: ['proyectos-empleados-opciones'],
    queryFn: async () => (await apiClient.get<EmpleadoOpcion[]>('/admin/proyectos/empleados')).data,
    enabled: modalAbierto,
  });

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/admin/proyectos', {
        nombre: form.nombre,
        clienteId: form.clienteId,
        responsableId: form.responsableId || undefined,
        presupuesto: form.presupuesto ? Number(form.presupuesto) : undefined,
        modoFacturacion: form.modoFacturacion,
        tarifaHoraFacturable: form.modoFacturacion === 'POR_HORAS' && form.tarifaHoraFacturable ? Number(form.tarifaHoraFacturable) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      setModalAbierto(false);
      setForm(FORM_VACIO);
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el proyecto.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  const proyectos = data?.datos ?? [];

  return (
    <RequierePermiso permiso="proyectos.ver">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Proyectos</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Proyectos por cliente, con hitos, tareas y horas registradas.</p>
          </div>
          <RequierePermiso permiso="proyectos.crear">
            <Button onClick={() => setModalAbierto(true)}>Nuevo proyecto</Button>
          </RequierePermiso>
        </div>

        <Card contentClassName="flex flex-wrap items-center gap-3" sinPadding>
          <div className="flex w-full items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar proyecto…" />
          </div>

          {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {!isLoading && proyectos.length === 0 && (
            <div className="w-full p-5">
              <EstadoVacio titulo="Sin proyectos todavía" descripcion="Creá el primero para empezar a asignar tareas y registrar horas." />
            </div>
          )}
          {proyectos.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-800">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Responsable</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Presupuesto</th>
                </tr>
              </thead>
              <tbody>
                {proyectos.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/proyectos/${p.id}`)}
                    className="cursor-pointer border-b border-slate-50 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{p.nombre}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.cliente.nombre}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.responsable?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ETIQUETA_ESTADO[p.estado] ?? p.estado}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.presupuesto ? `RD$ ${Number(p.presupuesto).toLocaleString('es-DO')}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {data && (
            <div className="w-full border-t border-slate-100 p-4 dark:border-slate-800">
              <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>

        {modalAbierto && (
          <Modal titulo="Nuevo proyecto" onClose={() => setModalAbierto(false)}>
            <form onSubmit={onSubmit} className="space-y-3">
              <FormField id="proyecto-nombre" label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />

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

              <FormField
                id="proyecto-presupuesto"
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
                  id="proyecto-tarifa"
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
                <Button type="button" variante="secundario" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={crear.isPending}>
                  {crear.isPending ? 'Guardando…' : 'Crear proyecto'}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </RequierePermiso>
  );
}
