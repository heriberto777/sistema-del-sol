import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Modal } from '../../molecules/Modal/Modal';
import { Switch } from '../../atoms/Switch/Switch';
import { Badge } from '../../atoms/Badge/Badge';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Rol {
  id: string;
  nombre: string;
}

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  roles: { role: Rol }[];
}

export function UsuariosPanel() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [modalNuevoUsuario, setModalNuevoUsuario] = useState(false);

  const { data: usuarios } = useQuery({
    queryKey: ['admin-usuarios', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Usuario>>('/admin/usuarios', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  const cambiarActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) =>
      apiClient.patch(`/admin/usuarios/${id}`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-slate-900 dark:text-slate-100">Usuarios</h2>
        <Button onClick={() => setModalNuevoUsuario(true)}>Nuevo usuario</Button>
      </div>

      <SearchInput
        value={busqueda}
        onChange={(v) => {
          setBusqueda(v);
          setPagina(1);
        }}
        placeholder="Buscar por nombre o email…"
      />
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Roles</th>
              <th className="px-4 py-2">Activo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {usuarios?.datos.map((usuario) => (
              <tr key={usuario.id}>
                <td className="px-4 py-2">{usuario.nombre}</td>
                <td className="px-4 py-2">{usuario.email}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {usuario.roles.map(({ role }) => (
                      <Badge key={role.id}>{role.nombre}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <Switch
                    activo={usuario.activo}
                    onChange={(activo) => cambiarActivo.mutate({ id: usuario.id, activo })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {usuarios && (
        <Paginacion
          pagina={usuarios.pagina}
          tamanoPagina={usuarios.tamanoPagina}
          total={usuarios.total}
          onCambiarPagina={setPagina}
        />
      )}

      {modalNuevoUsuario && <ModalNuevoUsuario onClose={() => setModalNuevoUsuario(false)} />}
    </div>
  );
}

function ModalNuevoUsuario({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [rolIds, setRolIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: roles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => (await apiClient.get<Rol[]>('/admin/roles')).data,
  });

  const crearUsuario = useMutation({
    mutationFn: async () => apiClient.post('/admin/usuarios', { email, nombre, password, rolIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] });
      onClose();
    },
    onError: () => setError('No se pudo crear el usuario. Revisa los datos.'),
  });

  function toggleRol(id: string) {
    setRolIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (rolIds.length === 0) {
      setError('Selecciona al menos un rol');
      return;
    }
    crearUsuario.mutate();
  }

  return (
    <Modal titulo="Nuevo usuario" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <FormField id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <FormField id="password" label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Roles</p>
          <div className="flex flex-wrap gap-2">
            {roles?.map((rol) => (
              <label key={rol.id} className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                <input type="checkbox" checked={rolIds.includes(rol.id)} onChange={() => toggleRol(rol.id)} />
                {rol.nombre}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crearUsuario.isPending} className="w-full">
          {crearUsuario.isPending ? 'Creando…' : 'Crear usuario'}
        </Button>
      </form>
    </Modal>
  );
}
