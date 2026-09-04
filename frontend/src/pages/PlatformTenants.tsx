import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApiClient } from '../lib/platform-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Switch } from '../components/atoms/Switch/Switch';
import { Modal } from '../components/molecules/Modal/Modal';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';

interface Tenant {
  id: string;
  nombre: string;
  subdominio: string;
  rnc: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO';
  planId: string | null;
  plan: { id: string; nombre: string } | null;
  createdAt: string;
}

interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface ModuloTenant {
  clave: string;
  nombre: string;
  activo: boolean;
  origen: 'plan' | 'override';
}

const TONO_POR_ESTADO: Record<Tenant['estado'], 'exito' | 'advertencia' | 'peligro'> = {
  ACTIVO: 'exito',
  SUSPENDIDO: 'advertencia',
  CANCELADO: 'peligro',
};

interface Suscripcion {
  id: string;
  estado: 'ACTIVA' | 'CANCELADA';
  fechaProximoCorte: string;
  feeMoraPct: string;
  plan: { nombre: string; precio: string; cicloFacturacion: 'MENSUAL' | 'ANUAL' };
}

const ETIQUETA_CICLO: Record<'MENSUAL' | 'ANUAL', string> = { MENSUAL: 'mes', ANUAL: 'año' };

function PanelSuscripcionTenant({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [feeMoraPct, setFeeMoraPct] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);

  const { data: suscripcion } = useQuery({
    queryKey: ['platform-tenant-suscripcion', tenant.id],
    queryFn: async () => (await platformApiClient.get<Suscripcion>(`/platform/tenants/${tenant.id}/suscripcion`)).data,
  });

  useEffect(() => {
    if (suscripcion) setFeeMoraPct(suscripcion.feeMoraPct);
  }, [suscripcion]);

  const actualizar = useMutation({
    mutationFn: async (data: { feeMoraPct?: number; estado?: 'ACTIVA' | 'CANCELADA' }) =>
      platformApiClient.patch(`/platform/tenants/${tenant.id}/suscripcion`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenant-suscripcion', tenant.id] }),
  });

  const generarFactura = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/tenants/${tenant.id}/suscripcion/generar-factura`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-facturas'] });
      setMensaje('Factura generada correctamente.');
    },
    onError: (err) => setMensaje(mensajeErrorApi(err, 'No se pudo generar la factura.')),
  });

  if (!suscripcion) {
    return (
      <Modal titulo={`Suscripción — ${tenant.nombre}`} onClose={onClose}>
        <p className="text-sm text-slate-400">Cargando…</p>
      </Modal>
    );
  }

  return (
    <Modal titulo={`Suscripción — ${tenant.nombre}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
          <p>
            Plan: <span className="font-medium">{suscripcion.plan.nombre}</span> — RD${' '}
            {Number(suscripcion.plan.precio).toLocaleString('es-DO')} / {ETIQUETA_CICLO[suscripcion.plan.cicloFacturacion]}
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            Próximo corte: {new Date(suscripcion.fechaProximoCorte).toLocaleDateString('es-DO')}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado de la suscripción</span>
          <Switch
            activo={suscripcion.estado === 'ACTIVA'}
            disabled={actualizar.isPending}
            onChange={(valor) => actualizar.mutate({ estado: valor ? 'ACTIVA' : 'CANCELADA' })}
          />
        </div>

        <div>
          <label htmlFor="fee-mora" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            % de mora (aplicado una vez al vencerse sin pago)
          </label>
          <div className="flex gap-2">
            <input
              id="fee-mora"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={feeMoraPct}
              onChange={(e) => setFeeMoraPct(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <Button
              variante="secundario"
              disabled={actualizar.isPending}
              onClick={() => actualizar.mutate({ feeMoraPct: Number(feeMoraPct) })}
            >
              Guardar
            </Button>
          </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-800" />

        <Button
          className="w-full"
          disabled={generarFactura.isPending}
          onClick={() => generarFactura.mutate()}
        >
          {generarFactura.isPending ? 'Generando…' : 'Generar factura ahora'}
        </Button>
        {mensaje && <p className="text-sm text-slate-500 dark:text-slate-400">{mensaje}</p>}
      </div>
    </Modal>
  );
}

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
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
        <span className="text-slate-500 dark:text-slate-400">Plan:</span>
        <Badge tono="neutro">{tenant.plan?.nombre ?? 'Sin plan'}</Badge>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Los módulos marcados como &quot;excepción&quot; no vienen del plan — fueron activados o desactivados puntualmente
        para este tenant.
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

interface TenantDominio {
  id: string;
  dominio: string;
  estado: 'PENDIENTE' | 'VERIFICANDO' | 'ACTIVO' | 'ERROR';
  mensajeError: string | null;
  activadoEn: string | null;
}

const TONO_POR_ESTADO_DOMINIO: Record<TenantDominio['estado'], 'neutro' | 'advertencia' | 'exito' | 'peligro'> = {
  PENDIENTE: 'neutro',
  VERIFICANDO: 'advertencia',
  ACTIVO: 'exito',
  ERROR: 'peligro',
};

/** Dominios propios de la tienda de un tenant (además de `<subdominio>.ciguadev.com`, que sigue funcionando siempre) — gestión 100% del super admin, ver TenantDominiosService en el backend. */
function PanelDominiosTenant({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [dominioNuevo, setDominioNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const queryKey = ['platform-tenant-dominios', tenant.id];

  const { data: dominios } = useQuery({
    queryKey,
    queryFn: async () => (await platformApiClient.get<TenantDominio[]>(`/platform/tenants/${tenant.id}/dominios`)).data,
  });

  const agregar = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/tenants/${tenant.id}/dominios`, { dominio: dominioNuevo }),
    onSuccess: () => {
      setDominioNuevo('');
      setError(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo agregar el dominio.')),
  });

  const verificar = useMutation({
    mutationFn: async (dominioId: string) => platformApiClient.post(`/platform/tenants/${tenant.id}/dominios/${dominioId}/verificar`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const eliminar = useMutation({
    mutationFn: async (dominioId: string) => platformApiClient.delete(`/platform/tenants/${tenant.id}/dominios/${dominioId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    agregar.mutate();
  }

  return (
    <Modal titulo={`Dominios — ${tenant.nombre}`} onClose={onClose}>
      <p className="mb-3 text-xs text-slate-400">
        Además de <span className="font-mono">{tenant.subdominio}.ciguadev.com</span> (siempre activo), este tenant puede
        tener uno o más dominios propios. Antes de agregar uno, pedile al cliente que apunte su DNS (CNAME o A record,
        según lo configurado en Configuración → Dominio propio) al destino público de la plataforma.
      </p>

      <div className="mb-4 space-y-2">
        {dominios?.length === 0 && <p className="text-sm text-slate-400">Sin dominios propios todavía.</p>}
        {dominios?.map((d) => (
          <div key={d.id} className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-slate-900 dark:text-slate-100">{d.dominio}</span>
              <div className="flex items-center gap-2">
                <Badge tono={TONO_POR_ESTADO_DOMINIO[d.estado]}>{d.estado}</Badge>
                {d.estado !== 'ACTIVO' && (
                  <button
                    type="button"
                    className="text-xs text-sol-600 hover:underline dark:text-sol-400"
                    disabled={verificar.isPending}
                    onClick={() => verificar.mutate(d.id)}
                  >
                    Verificar
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                  disabled={eliminar.isPending}
                  onClick={() => eliminar.mutate(d.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
            {d.mensajeError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{d.mensajeError}</p>}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <FormField
            id="dominio-nuevo"
            label="Nuevo dominio"
            value={dominioNuevo}
            onChange={(e) => setDominioNuevo(e.target.value)}
            placeholder="shopy-me.com"
            required
          />
        </div>
        <Button type="submit" disabled={agregar.isPending}>
          Agregar
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

export function PlatformTenants() {
  const queryClient = useQueryClient();

  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [tenantEditando, setTenantEditando] = useState<Tenant | null>(null);
  const [tenantModulos, setTenantModulos] = useState<Tenant | null>(null);
  const [tenantSuscripcion, setTenantSuscripcion] = useState<Tenant | null>(null);
  const [tenantDominios, setTenantDominios] = useState<Tenant | null>(null);

  const { data: tenants } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => (await platformApiClient.get<Tenant[]>('/platform/tenants')).data,
  });

  const { data: planes } = useQuery({
    queryKey: ['platform-planes'],
    queryFn: async () => (await platformApiClient.get<Plan[]>('/platform/planes')).data,
  });

  const planesAsignables = (planes ?? []).filter((p) => p.activo);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tenants</h1>
        <Button onClick={() => setModalNuevoAbierto(true)}>Nuevo tenant</Button>
      </div>

      <Card sinPadding titulo="Tenants" descripcion={tenants ? `${tenants.length} empresa(s) registradas` : undefined}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Subdominio</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tenants?.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3">{tenant.nombre}</td>
                  <td className="px-5 py-3 font-mono text-xs">{tenant.subdominio}</td>
                  <td className="px-5 py-3">
                    <Select
                      value={tenant.planId ?? ''}
                      disabled={cambiarPlan.isPending}
                      onChange={(e) => cambiarPlan.mutate({ id: tenant.id, planId: e.target.value })}
                      className="!w-auto py-1"
                    >
                      <option value="" disabled>
                        Sin plan
                      </option>
                      {planesAsignables.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.nombre}
                        </option>
                      ))}
                      {tenant.plan && !planesAsignables.some((p) => p.id === tenant.plan!.id) && (
                        <option value={tenant.plan.id}>{tenant.plan.nombre} (inactivo)</option>
                      )}
                    </Select>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tono={TONO_POR_ESTADO[tenant.estado]}>{tenant.estado}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <RowActionsMenu
                      acciones={[
                        { etiqueta: 'Editar', onClick: () => setTenantEditando(tenant) },
                        { etiqueta: 'Suscripción', onClick: () => setTenantSuscripcion(tenant) },
                        { etiqueta: 'Ver módulos', onClick: () => setTenantModulos(tenant) },
                        { etiqueta: 'Dominios', onClick: () => setTenantDominios(tenant) },
                        tenant.estado === 'ACTIVO'
                          ? {
                              etiqueta: 'Suspender',
                              tono: 'peligro' as const,
                              onClick: () => cambiarEstado.mutate({ id: tenant.id, estado: 'SUSPENDIDO' }),
                            }
                          : { etiqueta: 'Reactivar', onClick: () => cambiarEstado.mutate({ id: tenant.id, estado: 'ACTIVO' }) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {tenants?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                    Todavía no hay tenants creados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalNuevoAbierto && <ModalNuevoTenant planes={planesAsignables} onClose={() => setModalNuevoAbierto(false)} />}
      {tenantEditando && <ModalEditarTenant tenant={tenantEditando} onClose={() => setTenantEditando(null)} />}
      {tenantModulos && <PanelModulosTenant tenant={tenantModulos} onClose={() => setTenantModulos(null)} />}
      {tenantSuscripcion && <PanelSuscripcionTenant tenant={tenantSuscripcion} onClose={() => setTenantSuscripcion(null)} />}
      {tenantDominios && <PanelDominiosTenant tenant={tenantDominios} onClose={() => setTenantDominios(null)} />}
    </div>
  );
}

function ModalNuevoTenant({ planes, onClose }: { planes: Plan[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [subdominio, setSubdominio] = useState('');
  const [rnc, setRnc] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [planId, setPlanId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crearTenant = useMutation({
    mutationFn: async () =>
      platformApiClient.post('/platform/tenants', {
        nombre,
        subdominio,
        rnc: rnc || undefined,
        direccion: direccion || undefined,
        telefono: telefono || undefined,
        email: email || undefined,
        planId,
        adminEmail,
        adminNombre,
        adminPassword,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el tenant. Revisa que el subdominio no esté repetido y que el plan sea válido.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crearTenant.mutate();
  }

  return (
    <Modal titulo="Nuevo tenant" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="nombre" label="Nombre de la empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <FormField id="subdominio" label="Subdominio" value={subdominio} onChange={(e) => setSubdominio(e.target.value)} required />
        <FormField id="rnc" label="RNC (opcional)" value={rnc} onChange={(e) => setRnc(e.target.value)} />
        <FormField id="direccion" label="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <FormField id="telefono" label="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        <FormField id="email" label="Correo de la empresa (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <label htmlFor="plan" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Plan
          </label>
          <Select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
            <option value="" disabled>
              Selecciona un plan
            </option>
            {planes.map((plan) => (
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
    </Modal>
  );
}

function ModalEditarTenant({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(tenant.nombre);
  const [subdominio, setSubdominio] = useState(tenant.subdominio);
  const [rnc, setRnc] = useState(tenant.rnc ?? '');
  const [direccion, setDireccion] = useState(tenant.direccion ?? '');
  const [telefono, setTelefono] = useState(tenant.telefono ?? '');
  const [email, setEmail] = useState(tenant.email ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () =>
      platformApiClient.patch(`/platform/tenants/${tenant.id}`, {
        nombre,
        subdominio,
        rnc: rnc || undefined,
        direccion: direccion || undefined,
        telefono: telefono || undefined,
        email: email || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar. Revisa que el subdominio no esté repetido.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <Modal titulo={`Editar "${tenant.nombre}"`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="editar-nombre" label="Nombre de la empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <FormField id="editar-subdominio" label="Subdominio" value={subdominio} onChange={(e) => setSubdominio(e.target.value)} required />
        <FormField id="editar-rnc" label="RNC (opcional)" value={rnc} onChange={(e) => setRnc(e.target.value)} />
        <FormField id="editar-direccion" label="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <FormField id="editar-telefono" label="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        <FormField id="editar-email" label="Correo de la empresa (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
    </Modal>
  );
}
