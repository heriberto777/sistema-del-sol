import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Switch } from '../../atoms/Switch/Switch';

interface PluginEstado {
  key: string;
  nombre: string;
  version: string;
  descripcion?: string;
  activo: boolean;
}

export function PluginsPanel() {
  const queryClient = useQueryClient();

  const { data: plugins, isLoading } = useQuery({
    queryKey: ['admin-plugins'],
    queryFn: async () => (await apiClient.get<PluginEstado[]>('/admin/plugins')).data,
  });

  const cambiarActivo = useMutation({
    mutationFn: async ({ key, activo }: { key: string; activo: boolean }) =>
      apiClient.post(`/admin/plugins/${key}/${activo ? 'activar' : 'desactivar'}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-plugins'] }),
  });

  if (isLoading) return <p className="text-sm text-slate-500">Cargando plugins…</p>;
  if (!plugins?.length) {
    return <p className="text-sm text-slate-500">No hay plugins instalados en este despliegue.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {plugins.map((plugin) => (
        <div key={plugin.key} className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">{plugin.nombre}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">v{plugin.version}</p>
            {plugin.descripcion && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plugin.descripcion}</p>}
          </div>
          <Switch
            activo={plugin.activo}
            onChange={(activo) => cambiarActivo.mutate({ key: plugin.key, activo })}
          />
        </div>
      ))}
    </div>
  );
}
