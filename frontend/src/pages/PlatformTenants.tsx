import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, PauseCircle, Wallet, AlertTriangle } from 'lucide-react';
import { platformApiClient } from '../lib/platform-api-client';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { StatCard } from '../components/molecules/StatCard/StatCard';

interface Tenant {
  id: string;
  nombre: string;
  subdominio: string;
  rnc: string | null;
  logo: string | null;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO';
  plan: { id: string; nombre: string } | null;
  modulosOverride: { activo: boolean; modulo: { clave: string; nombre: string } }[];
  suscripcion: { fechaProximoCorte: string } | null;
}

const TONO_POR_ESTADO: Record<Tenant['estado'], 'exito' | 'advertencia' | 'peligro'> = {
  ACTIVO: 'exito',
  SUSPENDIDO: 'advertencia',
  CANCELADO: 'peligro',
};

// Mismo patrón que AccountMenu.tsx (avatar con iniciales) — acá en cuadrado
// para diferenciarlo del avatar circular de "persona" del header.
function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase();
}

// Subconjunto de PlatformDashboardService.resumen() — el resto de esa
// respuesta no aplica acá, activos/suspendidos ya salen de `tenants`
// (misma fuente que la tabla, sin riesgo de que ambos números diverjan).
interface ResumenPlataforma {
  mrrAproximado: number;
  cartera: { totalVencido: number; cantidadVencidas: number };
}

const fmtRD = (v: number) => `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza los 5
 * modales (Nuevo/Editar/Cambiar plan/Reiniciar/Factura adelantada) y los
 * 3 paneles auxiliares (Suscripción/Módulos/Dominios, que vivían también
 * como modal en este archivo aunque la auditoría no los nombraba) por
 * TenantNuevo.tsx y TenantVer.tsx.
 */
export function PlatformTenants() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: tenants } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => (await platformApiClient.get<Tenant[]>('/platform/tenants')).data,
  });

  // Mismo queryKey que PlatformDashboard.tsx — comparte caché, sin duplicar el fetch si ya se visitó esa pantalla.
  const { data: resumen } = useQuery({
    queryKey: ['platform-dashboard'],
    queryFn: async () => (await platformApiClient.get<ResumenPlataforma>('/platform/dashboard')).data,
  });

  const activos = (tenants ?? []).filter((t) => t.estado === 'ACTIVO').length;
  const suspendidos = (tenants ?? []).filter((t) => t.estado === 'SUSPENDIDO').length;

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: Tenant['estado'] }) => platformApiClient.patch(`/platform/tenants/${id}`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tenants</h1>
        <Button onClick={() => navigate('/plataforma/tenants/nuevo')}>Nuevo tenant</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard etiqueta="Tenants activos" valor={String(activos)} icono={Building2} />
        <StatCard etiqueta="Tenants suspendidos" valor={String(suspendidos)} icono={PauseCircle} />
        <StatCard etiqueta="Ingreso mensual aproximado (MRR)" valor={resumen ? fmtRD(resumen.mrrAproximado) : '—'} icono={Wallet} />
        <StatCard
          etiqueta="Cartera vencida"
          valor={resumen ? fmtRD(resumen.cartera.totalVencido) : '—'}
          variacion={resumen ? `${resumen.cartera.cantidadVencidas} factura(s)` : undefined}
          icono={AlertTriangle}
        />
      </div>

      <Card sinPadding titulo="Tenants" descripcion={tenants ? `${tenants.length} empresa(s) registradas` : undefined}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Tenant</th>
                <th className="px-5 py-3 font-medium">RNC</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Excepciones de módulo</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Próx. corte</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tenants?.map((tenant) => (
                <tr
                  key={tenant.id}
                  onClick={() => navigate(`/plataforma/tenants/${tenant.id}`)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {tenant.logo ? (
                        <img src={tenant.logo} alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sol-100 text-xs font-semibold text-sol-700 dark:bg-sol-900/40 dark:text-sol-300">
                          {iniciales(tenant.nombre)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{tenant.nombre}</p>
                        <p className="font-mono text-xs text-slate-400">{tenant.subdominio}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{tenant.rnc ?? '—'}</td>
                  <td className="px-5 py-3">{tenant.plan ? tenant.plan.nombre : <span className="text-slate-400">Sin plan asignado</span>}</td>
                  <td className="px-5 py-3">
                    {tenant.modulosOverride.length === 0 ? (
                      <span className="text-xs text-slate-400">Sin excepciones</span>
                    ) : (
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {tenant.modulosOverride.length} excepci{tenant.modulosOverride.length === 1 ? 'ón' : 'ones'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tono={TONO_POR_ESTADO[tenant.estado]}>{tenant.estado}</Badge>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {tenant.suscripcion ? new Date(tenant.suscripcion.fechaProximoCorte).toLocaleDateString('es-DO') : '—'}
                  </td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowActionsMenu
                      acciones={[
                        { etiqueta: 'Ver detalle', onClick: () => navigate(`/plataforma/tenants/${tenant.id}`) },
                        tenant.estado === 'ACTIVO'
                          ? { etiqueta: 'Suspender', tono: 'peligro' as const, onClick: () => cambiarEstado.mutate({ id: tenant.id, estado: 'SUSPENDIDO' }) }
                          : { etiqueta: 'Reactivar', onClick: () => cambiarEstado.mutate({ id: tenant.id, estado: 'ACTIVO' }) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {tenants?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                    Todavía no hay tenants creados.
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
