import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
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

interface Sucursal {
  id: string;
  nombre: string;
}

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  telefono: string | null;
  roles: { role: Rol }[];
  sucursales: { sucursal: Sucursal }[];
}

export function UsuariosPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

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
      <div className="flex justify-end">
        <Button onClick={() => navigate('/usuarios/nuevo')}>Nuevo usuario</Button>
      </div>

      <Card
        sinPadding
        titulo="Usuarios"
        descripcion={usuarios ? `${usuarios.total} usuario(s)` : undefined}
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
                <th className="px-5 py-3 font-medium">Roles</th>
                <th className="px-5 py-3 font-medium">Sucursales</th>
                <th className="px-5 py-3 font-medium">Activo</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {usuarios?.datos.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{usuario.nombre}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{usuario.email}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {usuario.roles.map(({ role }) => (
                        <Badge key={role.id}>{role.nombre}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {usuario.sucursales.length === 0 ? (
                      <span className="text-xs text-slate-400">Todas</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {usuario.sucursales.map(({ sucursal }) => (
                          <Badge key={sucursal.id}>{sucursal.nombre}</Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Switch
                      activo={usuario.activo}
                      onChange={(activo) => cambiarActivo.mutate({ id: usuario.id, activo })}
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs text-sol-600 hover:underline dark:text-sol-400"
                      onClick={() => navigate(`/usuarios/${usuario.id}`)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {usuarios && (
          <div className="px-5 py-3">
            <Paginacion
              pagina={usuarios.pagina}
              tamanoPagina={usuarios.tamanoPagina}
              total={usuarios.total}
              onCambiarPagina={setPagina}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
