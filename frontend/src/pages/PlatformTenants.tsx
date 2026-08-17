import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { platformApiClient } from '../lib/platform-api-client';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Select } from '../components/atoms/Select/Select';
import { Switch } from '../components/atoms/Switch/Switch';
import { Modal } from '../components/molecules/Modal/Modal';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { PaginaResultado } from '../types/pagina-resultado';
import { usePlatformAuth } from '../hooks/usePlatformAuth';

interface Tenant {
  id: string;
  nombre: string;
  subdominio: string;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO';
  planId: string | null;
  plan: { id: string; nombre: string } | null;
  createdAt: string;
}

interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
}

interface ModuloTenant {
  clave: string;
  nombre: string;
  activo: boolean;
  origen: 'plan' | 'override';
}

interface RegistroAuditoria {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  createdAt: string;
  admin: { nombre: string; email: string } | null;
}

const TONO_POR_ESTADO: Record<Tenant['estado'], 'exito' | 'advertencia' | 'peligro'> = {
  ACTIVO: 'exito',
  SUSPENDIDO: 'advertencia',
  CANCELADO: 'peligro',
};

function PanelModulosTenant({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: modulos } = useQuery({
    queryKey: ['platform-tenant-modulos', tenant.id],
    queryFn: async () => (await platformApiClient.get<ModuloTenant[]>(`/platform/tenants/${tenant.id}/modulos`)).data,
  });

  const actualizarOverride = useMutation({
    mutationFn: async ({ clave, activo }: { clave: string; activo: boolean | null }) =>
      platformApiClient.patch(`/platform/tenants/${tenant.id}/modulos/${clave}`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenant-modulos', tenant.id] }),
  });

  return (
    <Modal titulo={`Módulos — ${tenant.nombre}`} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Plan: <span className="font-medium">{tenant.plan?.nombre ?? 'Sin plan'}</span>. Los módulos marcados como
        &quot;excepción&quot; no vienen del plan — fueron activados o desactivados puntualmente para este tenant.
      </p>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {modulos?.map((modulo) => (
          <div
            key={modulo.clave}
            className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{modulo.nombre}</p>
              <p className="text-xs text-slate-400">
                {modulo.origen === 'override' ? 'Excepción para este tenant' : 'Heredado del plan'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {modulo.origen === 'override' && (
                <button
                  type="button"
                  className="text-xs text-sol-600 hover:underline dark:text-sol-400"
                  onClick={() => actualizarOverride.mutate({ clave: modulo.clave, activo: null })}
                >
                  Quitar excepción
                </button>
              )}
              <Switch
                activo={modulo.activo}
                disabled={actualizarOverride.isPending}
                onChange={(valor) => actualizarOverride.mutate({ clave: modulo.clave, activo: valor })}
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function PlatformTenants() {
  const { admin, logout } = usePlatformAuth();
  const queryClient = useQueryClient();

  const [nombre, setNombre] = useState('');
  const [subdominio, setSubdominio] = useState('');
  const [rnc, setRnc] = useState('');
  const [planId, setPlanId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tenantModulos, setTenantModulos] = useState<Tenant | null>(null);

  const [paginaAuditoria, setPaginaAuditoria] = useState(1);

  const { data: tenants } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => (await platformApiClient.get<Tenant[]>('/platform/tenants')).data,
  });

  const { data: planes } = useQuery({
    queryKey: ['platform-planes'],
    queryFn: async () => (await platformApiClient.get<Plan[]>('/platform/planes')).data,
  });

  const { data: auditoria } = useQuery({
    queryKey: ['platform-audit-log', paginaAuditoria],
    queryFn: async () =>
      (
        await platformApiClient.get<PaginaResultado<RegistroAuditoria>>('/platform/audit-log', {
          params: { pagina: paginaAuditoria },
        })
      ).data,
  });

  const crearTenant = useMutation({
    mutationFn: async () =>
      platformApiClient.post('/platform/tenants', {
        nombre,
        subdominio,
        rnc: rnc || undefined,
        planId,
        adminEmail,
        adminNombre,
        adminPassword,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      setNombre('');
      setSubdominio('');
      setRnc('');
      setPlanId('');
      setAdminEmail('');
      setAdminNombre('');
      setAdminPassword('');
      setError(null);
    },
    onError: () => setError('No se pudo crear el tenant. Revisa que el subdominio no esté repetido y que el plan sea válido.'),
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: Tenant['estado'] }) =>
      platformApiClient.patch(`/platform/tenants/${id}`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
  });

  const cambiarPlan = useMutation({
    mutationFn: async ({ id, planId: nuevoPlanId }: { id: string; planId: string }) =>
      platformApiClient.patch(`/platform/tenants/${id}`, { planId: nuevoPlanId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crearTenant.mutate();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-sol-600 dark:text-sol-400">Plataforma — Tenants</h1>
          <Link to="/plataforma/planes" className="text-sm text-slate-500 hover:underline dark:text-slate-400">
            Ver planes
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">{admin?.nombre}</span>
          <ThemeToggle />
          <Button variante="secundario" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-medium text-slate-900 dark:text-slate-100">Nuevo tenant</h2>
          <FormField id="nombre" label="Nombre de la empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <FormField id="subdominio" label="Subdominio" value={subdominio} onChange={(e) => setSubdominio(e.target.value)} required />
          <FormField id="rnc" label="RNC (opcional)" value={rnc} onChange={(e) => setRnc(e.target.value)} />
          <div>
            <label htmlFor="plan" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Plan
            </label>
            <Select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
              <option value="" disabled>
                Selecciona un plan
              </option>
              {planes?.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.nombre}
                </option>
              ))}
            </Select>
          </div>
          <hr className="border-slate-200 dark:border-slate-800" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Usuario administrador inicial</p>
          <FormField id="adminNombre" label="Nombre" value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} required />
          <FormField id="adminEmail" label="Email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          <FormField id="adminPassword" label="Contraseña" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={8} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crearTenant.isPending} className="w-full">
            {crearTenant.isPending ? 'Creando…' : 'Crear tenant'}
          </Button>
        </form>

        <div className="lg:col-span-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Subdominio</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tenants?.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="px-4 py-2">{tenant.nombre}</td>
                  <td className="px-4 py-2 font-mono text-xs">{tenant.subdominio}</td>
                  <td className="px-4 py-2">
                    <Select
                      value={tenant.planId ?? ''}
                      disabled={cambiarPlan.isPending}
                      onChange={(e) => cambiarPlan.mutate({ id: tenant.id, planId: e.target.value })}
                      className="!w-auto py-1"
                    >
                      <option value="" disabled>
                        Sin plan
                      </option>
                      {planes?.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.nombre}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    <Badge tono={TONO_POR_ESTADO[tenant.estado]}>{tenant.estado}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Button variante="secundario" onClick={() => setTenantModulos(tenant)}>
                        Ver módulos
                      </Button>
                      {tenant.estado === 'ACTIVO' ? (
                        <Button
                          variante="peligro"
                          onClick={() => cambiarEstado.mutate({ id: tenant.id, estado: 'SUSPENDIDO' })}
                        >
                          Suspender
                        </Button>
                      ) : (
                        <Button
                          variante="secundario"
                          onClick={() => cambiarEstado.mutate({ id: tenant.id, estado: 'ACTIVO' })}
                        >
                          Reactivar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <h2 className="font-medium text-slate-900 dark:text-slate-100">Actividad reciente</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Admin</th>
                <th className="px-4 py-2">Acción</th>
                <th className="px-4 py-2">Entidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditoria?.datos.map((registro) => (
                <tr key={registro.id}>
                  <td className="px-4 py-2">{new Date(registro.createdAt).toLocaleString('es-DO')}</td>
                  <td className="px-4 py-2">{registro.admin?.nombre ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{registro.accion}</td>
                  <td className="px-4 py-2">{registro.entidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {auditoria && (
          <Paginacion
            pagina={auditoria.pagina}
            tamanoPagina={auditoria.tamanoPagina}
            total={auditoria.total}
            onCambiarPagina={setPaginaAuditoria}
          />
        )}
      </div>

      {tenantModulos && <PanelModulosTenant tenant={tenantModulos} onClose={() => setTenantModulos(null)} />}
    </div>
  );
}
