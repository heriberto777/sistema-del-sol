import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

interface Rol {
  id: string;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
}

export function RolesPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card
        sinPadding
        titulo="Roles"
        descripcion="Roles personalizados y de sistema, con sus permisos."
        acciones={<Button onClick={() => navigate('/roles-permisos/nuevo')}>Nuevo rol</Button>}
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
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{rol.nombre}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{rol.descripcion ?? '—'}</td>
                  <td className="px-5 py-3">
                    <Badge tono={rol.esSistema ? 'neutro' : 'exito'}>{rol.esSistema ? 'Sistema' : 'Personalizado'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <RowActionsMenu
                      acciones={[
                        { etiqueta: 'Editar permisos', onClick: () => navigate(`/roles-permisos/${rol.id}`) },
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

    </div>
  );
}
