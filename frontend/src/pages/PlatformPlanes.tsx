import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { platformApiClient } from '../lib/platform-api-client';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { usePlatformAuth } from '../hooks/usePlatformAuth';

type CicloFacturacion = 'MENSUAL' | 'ANUAL';

interface Modulo {
  id: string;
  clave: string;
  nombre: string;
}

interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: string;
  cicloFacturacion: CicloFacturacion;
  activo: boolean;
  modulos: { modulo: Modulo }[];
}

interface Tenant {
  id: string;
  planId: string | null;
}

const ETIQUETA_CICLO: Record<CicloFacturacion, string> = { MENSUAL: 'mes', ANUAL: 'año' };

export function PlatformPlanes() {
  const navigate = useNavigate();
  const { tienePermiso } = usePlatformAuth();
  const puedeGestionar = tienePermiso('platform.planes.gestionar');
  const queryClient = useQueryClient();

  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const { data: planes } = useQuery({
    queryKey: ['platform-planes'],
    queryFn: async () => (await platformApiClient.get<Plan[]>('/platform/planes')).data,
  });

  // Mismo queryKey que PlatformTenants.tsx — comparten caché, sin duplicar el fetch si ya se visitó esa pantalla.
  const { data: tenants } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => (await platformApiClient.get<Tenant[]>('/platform/tenants')).data,
  });

  const cantidadPorPlan = new Map<string, number>();
  for (const t of tenants ?? []) {
    if (t.planId) cantidadPorPlan.set(t.planId, (cantidadPorPlan.get(t.planId) ?? 0) + 1);
  }

  const cambiarActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) =>
      platformApiClient.patch(`/platform/planes/${id}`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-planes'] }),
  });

  const planesVisibles = (planes ?? []).filter((p) => mostrarInactivos || p.activo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Planes</h1>
        {puedeGestionar && <Button onClick={() => navigate('/plataforma/planes/nuevo')}>Nuevo plan</Button>}
      </div>

      <Card
        sinPadding
        titulo="Planes existentes"
        descripcion={planes ? `${planes.length} plan(es) en el catálogo` : undefined}
        acciones={
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
            Mostrar inactivos
          </label>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Precio</th>
                <th className="px-5 py-3 font-medium">Módulos</th>
                <th className="px-5 py-3 font-medium">Tenants</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {planesVisibles.map((plan) => (
                <tr key={plan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{plan.nombre}</p>
                    {plan.descripcion && <p className="text-xs text-slate-500 dark:text-slate-400">{plan.descripcion}</p>}
                  </td>
                  <td className="px-5 py-3">
                    RD$ {Number(plan.precio).toLocaleString('es-DO')} / {ETIQUETA_CICLO[plan.cicloFacturacion]}{' '}
                    <span className="text-xs text-slate-400">+ ITBIS</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Badge tono="neutro">
                        {plan.modulos.length} módulo{plan.modulos.length === 1 ? '' : 's'}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => navigate(`/plataforma/planes/${plan.id}/modulos`)}
                        className="text-xs font-medium text-sol-600 hover:underline dark:text-sol-400"
                      >
                        Ver módulos
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{cantidadPorPlan.get(plan.id) ?? 0}</td>
                  <td className="px-5 py-3">
                    <Badge tono={plan.activo ? 'exito' : 'peligro'}>{plan.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {puedeGestionar && (
                      <RowActionsMenu
                        acciones={[
                          { etiqueta: 'Editar', onClick: () => navigate(`/plataforma/planes/${plan.id}`) },
                          plan.activo
                            ? {
                                etiqueta: 'Inactivar',
                                tono: 'peligro' as const,
                                onClick: () => cambiarActivo.mutate({ id: plan.id, activo: false }),
                              }
                            : { etiqueta: 'Activar', onClick: () => cambiarActivo.mutate({ id: plan.id, activo: true }) },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {planesVisibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    {planes?.length === 0 ? 'Todavía no hay planes creados.' : 'No hay planes activos — probá "Mostrar inactivos".'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
