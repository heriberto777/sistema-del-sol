import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApiClient } from '../lib/platform-api-client';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { PaginaResultado } from '../types/pagina-resultado';
import { usePlatformAuth } from '../hooks/usePlatformAuth';

interface Tenant {
  id: string;
  nombre: string;
  subdominio: string;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO';
  planBase: string;
  createdAt: string;
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

export function PlatformTenants() {
  const { admin, logout } = usePlatformAuth();
  const queryClient = useQueryClient();

  const [nombre, setNombre] = useState('');
  const [subdominio, setSubdominio] = useState('');
  const [rnc, setRnc] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [paginaAuditoria, setPaginaAuditoria] = useState(1);

  const { data: tenants } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => (await platformApiClient.get<Tenant[]>('/platform/tenants')).data,
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
        adminEmail,
        adminNombre,
        adminPassword,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      setNombre('');
      setSubdominio('');
      setRnc('');
      setAdminEmail('');
      setAdminNombre('');
      setAdminPassword('');
      setError(null);
    },
    onError: () => setError('No se pudo crear el tenant. Revisa que el subdominio no esté repetido.'),
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: Tenant['estado'] }) =>
      platformApiClient.patch(`/platform/tenants/${id}`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crearTenant.mutate();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-sol-600 dark:text-sol-400">Plataforma — Tenants</h1>
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
                    <Badge tono={TONO_POR_ESTADO[tenant.estado]}>{tenant.estado}</Badge>
                  </td>
                  <td className="px-4 py-2">
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
    </div>
  );
}
