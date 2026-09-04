import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApiClient } from '../lib/platform-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePlatformAuth } from '../hooks/usePlatformAuth';
import { PaginaResultado } from '../types/pagina-resultado';

interface PlatformRole {
  id: string;
  nombre: string;
}

interface PlatformAdminRow {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
  roleId: string | null;
  role: PlatformRole | null;
}

export function PlatformAdmins() {
  const { admin, tienePermiso } = usePlatformAuth();
  const puedeGestionar = tienePermiso('platform.admins.gestionar');
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data: admins } = useQuery({
    queryKey: ['platform-admins', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await platformApiClient.get<PaginaResultado<PlatformAdminRow>>('/platform/admins', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  const { data: roles } = useQuery({
    queryKey: ['platform-roles'],
    queryFn: async () => (await platformApiClient.get<PlatformRole[]>('/platform/roles')).data,
  });

  const crearAdmin = useMutation({
    mutationFn: async () =>
      platformApiClient.post('/platform/admins', { email, password, nombre, roleId: roleId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
      setEmail('');
      setPassword('');
      setNombre('');
      setRoleId('');
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el admin. Revisa que el email no esté repetido.')),
  });

  const cambiarRol = useMutation({
    mutationFn: async ({ id, roleId: nuevoRoleId }: { id: string; roleId: string }) =>
      platformApiClient.patch(`/platform/admins/${id}`, { roleId: nuevoRoleId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-admins'] }),
  });

  const cambiarActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) =>
      platformApiClient.patch(`/platform/admins/${id}`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-admins'] }),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo actualizar — no puedes desactivar tu propia cuenta.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crearAdmin.mutate();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Admins</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {puedeGestionar && (
          <Card
            className="lg:col-span-1"
            titulo="Nuevo admin de plataforma"
            descripcion="Da acceso a alguien de tu equipo, con un rol que limita lo que puede hacer."
          >
            <form onSubmit={onSubmit} className="space-y-3">
              <FormField id="admin-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              <FormField
                id="admin-email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <FormField
                id="admin-password"
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <div>
                <label htmlFor="admin-rol" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Rol
                </label>
                <Select id="admin-rol" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                  <option value="">Sin rol (sin acceso hasta asignarle uno)</option>
                  {roles?.map((rol) => (
                    <option key={rol.id} value={rol.id}>
                      {rol.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={crearAdmin.isPending} className="w-full">
                {crearAdmin.isPending ? 'Creando…' : 'Crear admin'}
              </Button>
            </form>
          </Card>
        )}

        <Card
          className={puedeGestionar ? 'lg:col-span-2' : 'lg:col-span-3'}
          sinPadding
          titulo="Admins de plataforma"
          descripcion={admins ? `${admins.total} admin(s) registrados` : undefined}
          acciones={
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por nombre o email…"
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Rol</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {admins?.datos.map((fila) => {
                  const esUnoMismo = fila.id === admin?.id;
                  return (
                    <tr key={fila.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        {fila.nombre} {esUnoMismo && <span className="text-xs text-slate-400">(tú)</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs">{fila.email}</td>
                      <td className="px-5 py-3">
                        {puedeGestionar ? (
                          <Select
                            value={fila.roleId ?? ''}
                            disabled={cambiarRol.isPending}
                            onChange={(e) => cambiarRol.mutate({ id: fila.id, roleId: e.target.value })}
                            className="!w-auto py-1"
                          >
                            <option value="" disabled>
                              Sin rol
                            </option>
                            {roles?.map((rol) => (
                              <option key={rol.id} value={rol.id}>
                                {rol.nombre}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Badge tono="neutro">{fila.role?.nombre ?? 'Sin rol'}</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tono={fila.activo ? 'exito' : 'peligro'}>{fila.activo ? 'ACTIVO' : 'INACTIVO'}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        {puedeGestionar &&
                          (fila.activo ? (
                            <Button
                              variante="peligro"
                              disabled={esUnoMismo}
                              onClick={() => cambiarActivo.mutate({ id: fila.id, activo: false })}
                            >
                              Desactivar
                            </Button>
                          ) : (
                            <Button variante="secundario" onClick={() => cambiarActivo.mutate({ id: fila.id, activo: true })}>
                              Reactivar
                            </Button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {admins && (
            <div className="px-5 py-3">
              <Paginacion pagina={admins.pagina} tamanoPagina={admins.tamanoPagina} total={admins.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
