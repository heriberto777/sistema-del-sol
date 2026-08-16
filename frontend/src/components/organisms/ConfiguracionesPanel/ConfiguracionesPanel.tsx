import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { Button } from '../../atoms/Button/Button';

interface Configuracion {
  clave: string;
  valor: string;
}

function FilaConfiguracion({ configuracion }: { configuracion: Configuracion }) {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState(configuracion.valor);

  const guardar = useMutation({
    mutationFn: async () => apiClient.put(`/admin/configuraciones/${configuracion.clave}`, { valor }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-configuraciones'] }),
  });

  return (
    <tr>
      <td className="px-4 py-2 font-mono text-xs">{configuracion.clave}</td>
      <td className="px-4 py-2">
        <Input value={valor} onChange={(e) => setValor(e.target.value)} />
      </td>
      <td className="px-4 py-2">
        <Button
          type="button"
          variante="secundario"
          disabled={valor === configuracion.valor || guardar.isPending}
          onClick={() => guardar.mutate()}
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </td>
    </tr>
  );
}

export function ConfiguracionesPanel() {
  const { data: configuraciones } = useQuery({
    queryKey: ['admin-configuraciones'],
    queryFn: async () => (await apiClient.get<Configuracion[]>('/admin/configuraciones')).data,
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-4 py-2">Clave</th>
            <th className="px-4 py-2">Valor</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {configuraciones?.map((configuracion) => (
            <FilaConfiguracion key={configuracion.clave} configuracion={configuracion} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
