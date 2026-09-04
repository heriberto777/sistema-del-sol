import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

interface Rol {
  id: string;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
}

interface RolDetalle extends Rol {
  rolePermissions: { permission: { clave: string } }[];
}

interface Permiso {
  id: string;
  clave: string;
  descripcion: string | null;
}

export function RolesPanel() {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [rolEditandoId, setRolEditandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: roles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => (await apiClient.get<Rol[]>('/admin/roles')).data,
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar el rol — puede ser un rol del sistema o tener usuarios asignados.')),
  });

  function abrirNuevo() {
    setRolEditandoId(null);
    setModalAbierto(true);
  }

  function abrirEditar(id: string) {
    setRolEditandoId(id);
    setModalAbierto(true);
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card
        sinPadding
        titulo="Roles"
        descripcion="Roles personalizados y de sistema, con sus permisos."
        acciones={<Button onClick={abrirNuevo}>Nuevo rol</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Descripción</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {roles?.map((rol) => (
                <tr key={rol.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3">{rol.nombre}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{rol.descripcion ?? '—'}</td>
                  <td className="px-5 py-3">
                    <Badge tono={rol.esSistema ? 'neutro' : 'exito'}>{rol.esSistema ? 'Sistema' : 'Personalizado'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <RowActionsMenu
                      acciones={[
                        { etiqueta: 'Editar permisos', onClick: () => abrirEditar(rol.id) },
                        ...(!rol.esSistema
                          ? [{ etiqueta: 'Eliminar', onClick: () => eliminar.mutate(rol.id), tono: 'peligro' as const }]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {modalAbierto && <ModalRol rolId={rolEditandoId} onClose={() => setModalAbierto(false)} />}
    </div>
  );
}

function agruparPermisos(permisos: Permiso[]) {
  const grupos = new Map<string, Permiso[]>();
  for (const permiso of permisos) {
    const [modulo] = permiso.clave.split('.');
    if (!grupos.has(modulo)) grupos.set(modulo, []);
    grupos.get(modulo)!.push(permiso);
  }
  return Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function ModalRol({ rolId, onClose }: { rolId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data: catalogoPermisos } = useQuery({
    queryKey: ['admin-permisos'],
    queryFn: async () => (await apiClient.get<Permiso[]>('/admin/permisos')).data,
  });

  const { data: rolDetalle } = useQuery({
    queryKey: ['admin-rol-detalle', rolId],
    enabled: !!rolId,
    queryFn: async () => (await apiClient.get<RolDetalle>(`/admin/roles/${rolId}`)).data,
  });

  useEffect(() => {
    if (!rolDetalle) return;
    setNombre(rolDetalle.nombre);
    setDescripcion(rolDetalle.descripcion ?? '');
    setPermisosSeleccionados(new Set(rolDetalle.rolePermissions.map((rp) => rp.permission.clave)));
  }, [rolDetalle]);

  const guardar = useMutation({
    mutationFn: async () => {
      const permisos = Array.from(permisosSeleccionados);
      if (rolId) {
        return apiClient.patch(`/admin/roles/${rolId}`, { nombre, descripcion: descripcion || undefined, permisos });
      }
      return apiClient.post('/admin/roles', { nombre, descripcion: descripcion || undefined, permisos });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el rol. Revisa que el nombre no esté repetido y que haya al menos un permiso.')),
  });

  function alternarPermiso(clave: string) {
    setPermisosSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (permisosSeleccionados.size === 0) {
      setError('Seleccioná al menos un permiso.');
      return;
    }
    guardar.mutate();
  }

  const grupos = agruparPermisos(catalogoPermisos ?? []);

  return (
    <Modal titulo={rolId ? 'Editar rol' : 'Nuevo rol'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="rol-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required disabled={!!rolId && rolDetalle?.esSistema} />
        <FormField id="rol-descripcion" label="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Permisos</p>
          <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-3 dark:border-slate-800">
            {grupos.map(([modulo, permisos]) => (
              <div key={modulo}>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-400">{modulo}</p>
                <div className="flex flex-wrap gap-3">
                  {permisos.map((permiso) => (
                    <label key={permiso.id} className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={permisosSeleccionados.has(permiso.clave)}
                        onChange={() => alternarPermiso(permiso.clave)}
                      />
                      {permiso.clave}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Modal>
  );
}
