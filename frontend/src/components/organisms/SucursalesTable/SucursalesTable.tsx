import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { useAuth } from '../../../hooks/useAuth';

interface Sucursal {
  id: string;
  nombre: string;
  nombreComercial: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  activa: boolean;
}

interface FormularioSucursal {
  nombre: string;
  nombreComercial: string;
  telefono: string;
  direccion: string;
  ciudad: string;
}

const FORMULARIO_VACIO: FormularioSucursal = { nombre: '', nombreComercial: '', telefono: '', direccion: '', ciudad: '' };

function aPayload(form: FormularioSucursal) {
  return {
    nombre: form.nombre,
    nombreComercial: form.nombreComercial || undefined,
    telefono: form.telefono || undefined,
    direccion: form.direccion || undefined,
    ciudad: form.ciudad || undefined,
  };
}

export function SucursalesTable() {
  const { tienePermiso } = useAuth();
  const [modalNueva, setModalNueva] = useState(false);
  const [sucursalEditar, setSucursalEditar] = useState<Sucursal | null>(null);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => (await apiClient.get<Sucursal[]>('/sucursales')).data,
  });

  return (
    <div className="space-y-4">
      {tienePermiso('sucursales.editar') && (
        <div className="flex justify-end">
          <Button onClick={() => setModalNueva(true)}>Nueva sucursal</Button>
        </div>
      )}

      <Card sinPadding titulo="Sucursales" descripcion={data ? `${data.length} sucursal(es)` : undefined}>
        {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando sucursales…</p>}
        {errorCarga && <p className="p-5 text-sm text-red-600">No se pudieron cargar las sucursales.</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Nombre comercial</th>
                  <th className="px-5 py-3 font-medium">Ciudad</th>
                  <th className="px-5 py-3 font-medium">Teléfono</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{s.nombre}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{s.nombreComercial ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{s.ciudad ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{s.telefono ?? '—'}</td>
                    <td className="px-5 py-3">
                      <Badge tono={s.activa ? 'exito' : 'neutro'}>{s.activa ? 'Activa' : 'Inactiva'}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {tienePermiso('sucursales.editar') && (
                        <button
                          type="button"
                          className="text-xs text-sol-600 hover:underline dark:text-sol-400"
                          onClick={() => setSucursalEditar(s)}
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-slate-500 dark:text-slate-400">
                      Sin sucursales registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalNueva && <ModalSucursal onClose={() => setModalNueva(false)} />}
      {sucursalEditar && <ModalSucursal sucursal={sucursalEditar} onClose={() => setSucursalEditar(null)} />}
    </div>
  );
}

function ModalSucursal({ sucursal, onClose }: { sucursal?: Sucursal; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormularioSucursal>(
    sucursal
      ? {
          nombre: sucursal.nombre,
          nombreComercial: sucursal.nombreComercial ?? '',
          telefono: sucursal.telefono ?? '',
          direccion: sucursal.direccion ?? '',
          ciudad: sucursal.ciudad ?? '',
        }
      : FORMULARIO_VACIO,
  );
  const [activa, setActiva] = useState(sucursal?.activa ?? true);
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () =>
      sucursal
        ? apiClient.patch(`/sucursales/${sucursal.id}`, { ...aPayload(form), activa })
        : apiClient.post('/sucursales', aPayload(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursales'] });
      onClose();
    },
    onError: (e: unknown) => {
      const mensaje = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(mensaje ?? 'No se pudo guardar la sucursal.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <Modal titulo={sucursal ? `Editar sucursal — ${sucursal.nombre}` : 'Nueva sucursal'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField
          id="sucursal-nombre"
          label="Nombre"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          required
        />
        <FormField
          id="sucursal-nombre-comercial"
          label="Nombre comercial (opcional)"
          value={form.nombreComercial}
          onChange={(e) => setForm((f) => ({ ...f, nombreComercial: e.target.value }))}
        />
        <FormField
          id="sucursal-telefono"
          label="Teléfono (opcional)"
          value={form.telefono}
          onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
        />
        <FormField
          id="sucursal-ciudad"
          label="Ciudad (opcional)"
          value={form.ciudad}
          onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))}
        />
        <FormField
          id="sucursal-direccion"
          label="Dirección (opcional)"
          value={form.direccion}
          onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
        />
        {sucursal && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
            Activa
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : sucursal ? 'Guardar cambios' : 'Crear sucursal'}
        </Button>
      </form>
    </Modal>
  );
}
