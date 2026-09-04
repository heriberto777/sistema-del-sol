import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { type CategoriaCliente } from '../../../hooks/useCategoriasCliente';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

export function CategoriasClientePanel() {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Trae también las inactivas (a diferencia de useCategoriasCliente) — un
  // admin necesita verlas todas para poder reactivarlas.
  const { data: categorias } = useQuery({
    queryKey: ['admin-categorias-cliente'],
    queryFn: async () => (await apiClient.get<CategoriaCliente[]>('/categorias-cliente')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['admin-categorias-cliente'] });
    queryClient.invalidateQueries({ queryKey: ['categorias-cliente-activas'] });
  }

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/categorias-cliente', { nombre }),
    onSuccess: () => {
      invalidar();
      setNombre('');
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la categoría (¿ya existe una con ese nombre?).')),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => apiClient.patch(`/categorias-cliente/${id}`, { activa }),
    onSuccess: invalidar,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Nueva categoría de cliente">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField id="cc-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Segmentación de clientes (VIP, Mayorista, etc.) — puramente informativa, sin efecto en precios ni permisos.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear categoría'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Categorías de cliente">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {categorias?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3">{c.nombre}</td>
                <td className="px-5 py-3">
                  <Badge tono={c.activa ? 'exito' : 'neutro'}>{c.activa ? 'Activa' : 'Inactiva'}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    variante={c.activa ? 'peligro' : 'secundario'}
                    disabled={actualizar.isPending}
                    onClick={() => actualizar.mutate({ id: c.id, activa: !c.activa })}
                  >
                    {c.activa ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
            {categorias?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-slate-400">
                  Sin categorías de cliente todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
