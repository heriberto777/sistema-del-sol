import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { type CentroCosto } from '../../../hooks/useCentrosCosto';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

/**
 * Patrón CRUD simple calcado de CategoriasProveedorPanel (docs/PLAN.md,
 * punto 3). `icon={null}` en el botón de submit e invalidación diferida
 * un macrotask — sin esto, el texto del botón cambiando ("Crear centro de
 * costo" ↔ "Creando…") infiere un ícono distinto (`Button` →
 * `inferirIconoAccion`) que puede chocar con React al mismo tiempo que se
 * invalida la tabla — mismo bug real documentado en ARCHITECTURE.md
 * ("Auditoría UX: modal → página" → variante del ícono inferido),
 * encontrado creando categorías con este mismo patrón.
 */
export function CentrosCostoPanel() {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: centros } = useQuery({
    queryKey: ['admin-centros-costo'],
    queryFn: async () => (await apiClient.get<CentroCosto[]>('/centros-costo')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['admin-centros-costo'] });
    queryClient.invalidateQueries({ queryKey: ['centros-costo-activos'] });
  }

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/centros-costo', { nombre }),
    onSuccess: () => {
      setNombre('');
      setError(null);
      setTimeout(invalidar, 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el centro de costo (¿ya existe uno con ese nombre?).')),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => apiClient.patch(`/centros-costo/${id}`, { activo }),
    onSuccess: () => setTimeout(invalidar, 0),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Nuevo centro de costo">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField id="cc-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sucursal, departamento o área (ej. "Sucursal Santiago", "Administración") — independiente de Proyecto, se puede combinar con él en
            el mismo gasto/venta/asiento.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" icon={null} disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear centro de costo'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Centros de costo">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {centros?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{c.nombre}</td>
                <td className="px-5 py-3">
                  <Badge tono={c.activo ? 'exito' : 'neutro'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    icon={null}
                    variante={c.activo ? 'peligro' : 'secundario'}
                    disabled={actualizar.isPending}
                    onClick={() => actualizar.mutate({ id: c.id, activo: !c.activo })}
                  >
                    {c.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
            {centros?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-slate-400">
                  Sin centros de costo todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
