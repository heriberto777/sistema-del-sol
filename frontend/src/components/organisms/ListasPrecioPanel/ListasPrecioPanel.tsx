import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { type ListaPrecio } from '../../../hooks/useListasPrecio';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';

export function ListasPrecioPanel() {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Trae también las inactivas (a diferencia de useListasPrecio) — un
  // admin necesita verlas todas para poder reactivarlas.
  const { data: listasPrecio } = useQuery({
    queryKey: ['admin-listas-precio'],
    queryFn: async () => (await apiClient.get<ListaPrecio[]>('/listas-precio')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['admin-listas-precio'] });
    queryClient.invalidateQueries({ queryKey: ['listas-precio-activas'] });
  }

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/listas-precio', { nombre }),
    onSuccess: () => {
      invalidar();
      setNombre('');
      setError(null);
    },
    onError: () => setError('No se pudo crear el nivel de precio (¿ya existe uno con ese nombre?).'),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => apiClient.patch(`/listas-precio/${id}`, { activa }),
    onSuccess: invalidar,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Nuevo nivel de precio">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField id="lp-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Este nombre debe coincidir exacto con el que uses al crear precios de producto en ese nivel.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear nivel de precio'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Niveles de precio">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {listasPrecio?.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3">
                  {l.nombre}
                  {l.nombre === 'GENERAL' && <span className="ml-2 text-xs text-slate-400">(por defecto)</span>}
                </td>
                <td className="px-5 py-3">
                  <Badge tono={l.activa ? 'exito' : 'neutro'}>{l.activa ? 'Activa' : 'Inactiva'}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    variante={l.activa ? 'peligro' : 'secundario'}
                    disabled={actualizar.isPending}
                    onClick={() => actualizar.mutate({ id: l.id, activa: !l.activa })}
                  >
                    {l.activa ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
            {listasPrecio?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-slate-400">
                  Sin niveles de precio todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
