import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { type Puesto } from '../../../hooks/usePuestos';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';

/** Catálogo de puestos (plan de integración Cuadre, ítem G-8) — mismo molde que ListasPrecioPanel/CategoriasClientePanel. */
export function PuestosPanel() {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Trae también los inactivos (a diferencia de usePuestos) — un admin
  // necesita verlos todos para poder reactivarlos.
  const { data: puestos } = useQuery({
    queryKey: ['admin-puestos'],
    queryFn: async () => (await apiClient.get<Puesto[]>('/nomina/puestos')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['admin-puestos'] });
    queryClient.invalidateQueries({ queryKey: ['puestos-activos'] });
  }

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/nomina/puestos', { nombre }),
    onSuccess: () => {
      invalidar();
      setNombre('');
      setError(null);
    },
    onError: () => setError('No se pudo crear el puesto (¿ya existe uno con ese nombre?).'),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => apiClient.patch(`/nomina/puestos/${id}`, { activo }),
    onSuccess: invalidar,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Nuevo puesto">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField id="puesto-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear puesto'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Puestos">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {puestos?.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3">{p.nombre}</td>
                <td className="px-5 py-3">
                  <Badge tono={p.activo ? 'exito' : 'neutro'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    variante={p.activo ? 'peligro' : 'secundario'}
                    disabled={actualizar.isPending}
                    onClick={() => actualizar.mutate({ id: p.id, activo: !p.activo })}
                  >
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
            {puestos?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-slate-400">
                  Sin puestos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
