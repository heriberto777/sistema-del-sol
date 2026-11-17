import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { platformApiClient } from '../../lib/platform-api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { Select } from '../../components/atoms/Select/Select';
import { FormField } from '../../components/molecules/FormField/FormField';
import { CampoImagen } from '../../components/molecules/CampoImagen/CampoImagen';
import { useHayCambios } from '../../hooks/useHayCambios';

interface Plan {
  id: string;
  nombre: string;
  activo: boolean;
}

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * ModalNuevoTenant de PlatformTenants.tsx. Tras crear, ofrece generar la
 * primera factura (la suscripción no factura sola hasta el próximo corte
 * automático — ver el comentario original) antes de navegar al detalle.
 */
export function TenantNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [subdominio, setSubdominio] = useState('');
  const [rnc, setRnc] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [planId, setPlanId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tenantCreado, setTenantCreado] = useState<{ id: string; nombre: string } | null>(null);
  const [facturaGenerada, setFacturaGenerada] = useState(false);

  const { data: planes } = useQuery({
    queryKey: ['platform-planes'],
    queryFn: async () => (await platformApiClient.get<Plan[]>('/platform/planes')).data,
  });
  const planesAsignables = (planes ?? []).filter((p) => p.activo);

  const crearTenant = useMutation({
    mutationFn: async () =>
      (
        await platformApiClient.post<{ id: string; nombre: string }>('/platform/tenants', {
          nombre,
          subdominio,
          rnc: rnc || undefined,
          direccion: direccion || undefined,
          telefono: telefono || undefined,
          email: email || undefined,
          logo: logo || undefined,
          planId,
          adminEmail,
          adminNombre,
          adminPassword,
        })
      ).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      confirmarGuardado();
      setTenantCreado(data);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el tenant. Revisa que el subdominio no esté repetido y que el plan sea válido.')),
  });

  const generarPrimeraFactura = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/tenants/${tenantCreado?.id}/suscripcion/generar-factura`),
    onSuccess: () => {
      setError(null);
      setFacturaGenerada(true);
      queryClient.invalidateQueries({ queryKey: ['platform-facturas'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo generar la factura.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crearTenant.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ nombre, subdominio, rnc, direccion, telefono, email, logo, planId, adminEmail, adminNombre, adminPassword });

  if (tenantCreado) {
    return (
      <PaginaDocumento
        titulo="Tenant creado"
        rutaVolver="/plataforma/tenants"
        etiquetaVolver="Volver a Tenants"
        haycambios={false}
        resumen={null}
        acciones={null}
      >
        <Card titulo={tenantCreado.nombre}>
          <div className="sm:col-span-2 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-900 dark:text-slate-100">{tenantCreado.nombre}</span> se creó correctamente. La suscripción
              todavía no generó ninguna factura — eso pasa recién en el próximo corte automático. ¿Generamos la primera factura ahora?
            </p>
            {facturaGenerada ? (
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Factura generada ✓</p>
            ) : (
              error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variante="secundario" onClick={() => navigate(`/plataforma/tenants/${tenantCreado.id}`)}>
                {facturaGenerada ? 'Ver tenant' : 'Ahora no'}
              </Button>
              {!facturaGenerada && (
                <Button type="button" onClick={() => generarPrimeraFactura.mutate()} disabled={generarPrimeraFactura.isPending}>
                  {generarPrimeraFactura.isPending ? 'Generando…' : 'Generar la primera factura'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </PaginaDocumento>
    );
  }

  return (
    <PaginaDocumento
      titulo="Nuevo tenant"
      rutaVolver="/plataforma/tenants"
      etiquetaVolver="Volver a Tenants"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Empresa</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{nombre || 'Sin nombre'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nuevo-tenant" disabled={crearTenant.isPending} className="w-full">
            {crearTenant.isPending ? 'Creando…' : 'Crear tenant'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/plataforma/tenants')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nuevo-tenant" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Datos de la empresa">
          <FormField id="nombre" label="Nombre de la empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <FormField id="subdominio" label="Subdominio" value={subdominio} onChange={(e) => setSubdominio(e.target.value)} required />
          <FormField id="rnc" label="RNC (opcional)" value={rnc} onChange={(e) => setRnc(e.target.value)} />
          <FormField id="direccion" label="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          <FormField id="telefono" label="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <FormField id="email" label="Correo de la empresa (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="sm:col-span-2">
            <CampoImagen valor={logo} onChange={setLogo} label="Logo (opcional)" />
          </div>
          <div>
            <label htmlFor="plan" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Plan
            </label>
            <Select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
              <option value="" disabled>
                Selecciona un plan
              </option>
              {planesAsignables.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.nombre}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card titulo="Usuario administrador inicial">
          <FormField id="adminNombre" label="Nombre" value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} required />
          <FormField id="adminEmail" label="Email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          <FormField
            id="adminPassword"
            label="Contraseña"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            required
            minLength={8}
          />
        </Card>
      </form>
    </PaginaDocumento>
  );
}
