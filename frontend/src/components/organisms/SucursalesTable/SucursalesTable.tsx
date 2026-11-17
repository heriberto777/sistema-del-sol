import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
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

export function SucursalesTable() {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => (await apiClient.get<Sucursal[]>('/sucursales')).data,
  });

  return (
    <div className="space-y-4">
      {tienePermiso('sucursales.editar') && (
        <div className="flex justify-end">
          <Button onClick={() => navigate('/sucursales/nueva')}>Nueva sucursal</Button>
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
                          onClick={() => navigate(`/sucursales/${s.id}`)}
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
    </div>
  );
}
