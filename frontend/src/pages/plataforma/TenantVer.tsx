import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { platformApiClient } from '../../lib/platform-api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { usePlatformAuth } from '../../hooks/usePlatformAuth';
import { useHayCambios } from '../../hooks/useHayCambios';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { CardColapsable } from '../../components/molecules/CardColapsable/CardColapsable';
import { Card } from '../../components/atoms/Card/Card';
import { Badge } from '../../components/atoms/Badge/Badge';
import { Button } from '../../components/atoms/Button/Button';
import { Select } from '../../components/atoms/Select/Select';
import { Switch } from '../../components/atoms/Switch/Switch';
import { FormField } from '../../components/molecules/FormField/FormField';
import { CampoImagen } from '../../components/molecules/CampoImagen/CampoImagen';

interface Tenant {
  id: string;
  nombre: string;
  subdominio: string;
  rnc: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  logo: string | null;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO';
  planId: string | null;
  plan: { id: string; nombre: string; precio: string; cicloFacturacion: 'MENSUAL' | 'ANUAL' } | null;
  modulosOverride: { activo: boolean; modulo: { clave: string; nombre: string } }[];
  suscripcion: { fechaProximoCorte: string } | null;
}

interface Plan {
  id: string;
  nombre: string;
  precio: string;
  cicloFacturacion: 'MENSUAL' | 'ANUAL';
  activo: boolean;
}

interface ModuloTenant {
  clave: string;
  nombre: string;
  activo: boolean;
  origen: 'plan' | 'override';
}

interface Suscripcion {
  id: string;
  estado: 'ACTIVA' | 'CANCELADA';
  fechaProximoCorte: string;
  feeMoraPct: string;
  primerPeriodoGratis: boolean;
  plan: { nombre: string; precio: string; cicloFacturacion: 'MENSUAL' | 'ANUAL' };
}

interface CuponAplicado {
  id: string;
  ciclosRestantes: number | null;
  cupon: { codigo: string; tipo: 'PORCENTAJE' | 'MONTO_FIJO'; valor: string };
}

interface TenantDominio {
  id: string;
  dominio: string;
  estado: 'PENDIENTE' | 'VERIFICANDO' | 'ACTIVO' | 'ERROR';
  mensajeError: string | null;
}

const TONO_POR_ESTADO: Record<Tenant['estado'], 'exito' | 'advertencia' | 'peligro'> = {
  ACTIVO: 'exito',
  SUSPENDIDO: 'advertencia',
  CANCELADO: 'peligro',
};

const TONO_POR_ESTADO_DOMINIO: Record<TenantDominio['estado'], 'neutro' | 'advertencia' | 'exito' | 'peligro'> = {
  PENDIENTE: 'neutro',
  VERIFICANDO: 'advertencia',
  ACTIVO: 'exito',
  ERROR: 'peligro',
};

const ETIQUETA_CICLO: Record<'MENSUAL' | 'ANUAL', string> = { MENSUAL: 'mes', ANUAL: 'año' };
const ETIQUETA_CICLO_PLURAL: Record<'MENSUAL' | 'ANUAL', string> = { MENSUAL: 'meses', ANUAL: 'años' };

type ModoReseteoTenant = 'TRANSACCIONAL' | 'COMPLETO';

const DESCRIPCION_MODO_RESETEO: Record<ModoReseteoTenant, string> = {
  TRANSACCIONAL:
    'Borra solo lo generado: facturas, cotizaciones, remisiones, pagos, asientos contables, movimientos de inventario, ' +
    'proyectos, nómina procesada, turnos de caja, pedidos de la tienda, publicaciones sociales, notificaciones y auditoría. ' +
    'Preserva Productos, Clientes, Empleados, Roles, Configuración, Cuentas contables, Formas de pago, Listas de precio y NCF.',
  COMPLETO:
    'Todo lo de "Solo movimientos" MÁS vacía Productos, Clientes y Empleados, y reinicia a sus valores base Roles/Permisos, ' +
    'Cuentas contables, Formas de pago, Listas de precio, Correlativos, Configuración y Secciones del Home. ' +
    'Los NCF configurados se borran sin recrear (hay que volver a cargar los rangos reales de la DGII). ' +
    'El Tenant y los usuarios (logins) NUNCA se borran, en ningún modo.',
};

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * ModalEditarTenant, ModalCambiarPlan, ModalResetearTenant,
 * ModalFacturaAdelantada (y, para no dejarlos a medio migrar al cambiar
 * de contenedor, PanelSuscripcionTenant/PanelModulosTenant/
 * PanelDominiosTenant, que no estaban nombrados en la auditoría pero
 * vivían como modal dentro de este mismo archivo) de PlatformTenants.tsx.
 * Mismo criterio que ClienteFormulario: las secciones auxiliares (acá
 * Suscripción/Módulos/Dominios) quedan como `CardColapsable` en vez de
 * modal — "Cambiar plan"/"Reiniciar" quedan como tarjetas inline, mismo
 * patrón que "Cerrar negocio"/"Iniciar preventa" en PropiedadVer.
 */
export function TenantVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = usePlatformAuth();
  const puedeResetear = tienePermiso('platform.tenants.resetear');

  const { data: tenant } = useQuery({
    queryKey: ['platform-tenant', id],
    queryFn: async () => (await platformApiClient.get<Tenant>(`/platform/tenants/${id}`)).data,
  });
  const { data: planes } = useQuery({
    queryKey: ['platform-planes'],
    queryFn: async () => (await platformApiClient.get<Plan[]>('/platform/planes')).data,
  });
  const planesAsignables = (planes ?? []).filter((p) => p.activo);

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [subdominio, setSubdominio] = useState('');
  const [rnc, setRnc] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cambiandoPlan, setCambiandoPlan] = useState(false);
  const [planIdNuevo, setPlanIdNuevo] = useState('');
  const [reseteando, setReseteando] = useState(false);
  const [modoReseteo, setModoReseteo] = useState<ModoReseteoTenant>('TRANSACCIONAL');
  const [confirmacionReseteo, setConfirmacionReseteo] = useState('');

  const [suscripcionColapsada, setSuscripcionColapsada] = useState(true);
  const [modulosColapsada, setModulosColapsada] = useState(true);
  const [dominiosColapsada, setDominiosColapsada] = useState(true);

  useEffect(() => {
    if (tenant && !cargado) {
      setNombre(tenant.nombre);
      setSubdominio(tenant.subdominio);
      setRnc(tenant.rnc ?? '');
      setDireccion(tenant.direccion ?? '');
      setTelefono(tenant.telefono ?? '');
      setEmail(tenant.email ?? '');
      setLogo(tenant.logo);
      setPlanIdNuevo(tenant.planId ?? '');
      setCargado(true);
    }
  }, [tenant, cargado]);

  const guardar = useMutation({
    mutationFn: async () =>
      platformApiClient.patch(`/platform/tenants/${id}`, {
        nombre,
        subdominio,
        rnc: rnc || undefined,
        direccion: direccion || undefined,
        telefono: telefono || undefined,
        email: email || undefined,
        logo: logo ?? '',
      }),
    onSuccess: () => {
      confirmarGuardado();
      setEditando(false);
      // Diferido un macrotask — ver el comentario equivalente en
      // OrdenCompraVer.tsx (bug real de removeChild, intermitente, por la
      // carrera entre este refetch y el cambio de editando→false).
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
        queryClient.invalidateQueries({ queryKey: ['platform-tenant', id] });
      }, 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar. Revisa que el subdominio no esté repetido.')),
  });

  const cambiarEstado = useMutation({
    mutationFn: async (estado: Tenant['estado']) => platformApiClient.patch(`/platform/tenants/${id}`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant', id] });
    },
  });

  const cambiarPlan = useMutation({
    mutationFn: async () => platformApiClient.patch(`/platform/tenants/${id}`, { planId: planIdNuevo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant', id] });
      setCambiandoPlan(false);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el plan.')),
  });

  const resetear = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/tenants/${id}/resetear`, { modo: modoReseteo, confirmacionSubdominio: confirmacionReseteo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      setReseteando(false);
      setConfirmacionReseteo('');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo resetear el tenant.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  const [hayCambiosForm, confirmarGuardado] = useHayCambios({ nombre, subdominio, rnc, direccion, telefono, email, logo }, cargado);
  const haycambios = editando && hayCambiosForm;

  const planNuevo = planes?.find((p) => p.id === planIdNuevo) ?? (tenant?.plan?.id === planIdNuevo ? tenant.plan : undefined);
  const cambiaCiclo = Boolean(tenant?.plan && planNuevo && planIdNuevo !== tenant.planId && planNuevo.cicloFacturacion !== tenant.plan.cicloFacturacion);
  const confirmacionResetValida = tenant && confirmacionReseteo === tenant.subdominio;

  if (!tenant) {
    return (
      <PaginaDocumento titulo="Tenant" rutaVolver="/plataforma/tenants" etiquetaVolver="Volver a Tenants" haycambios={false} resumen={null} acciones={null}>
        <p className="text-sm text-slate-400">Cargando…</p>
      </PaginaDocumento>
    );
  }

  return (
    <PaginaDocumento
      titulo={tenant.nombre}
      rutaVolver="/plataforma/tenants"
      etiquetaVolver="Volver a Tenants"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
            <Badge tono={TONO_POR_ESTADO[tenant.estado]}>{tenant.estado}</Badge>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Plan</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tenant.plan?.nombre ?? 'Sin plan'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Próx. corte</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {tenant.suscripcion ? new Date(tenant.suscripcion.fechaProximoCorte).toLocaleDateString('es-DO') : '—'}
            </span>
          </div>
        </>
      }
      acciones={
        editando ? (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" form="form-tenant" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="button" className="w-full" onClick={() => setEditando(true)}>
              Editar
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => setCambiandoPlan((v) => !v)}>
              Cambiar plan
            </Button>
            {tenant.estado === 'ACTIVO' ? (
              <Button type="button" variante="secundario" className="w-full" disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate('SUSPENDIDO')}>
                Suspender
              </Button>
            ) : (
              <Button type="button" variante="secundario" className="w-full" disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate('ACTIVO')}>
                Reactivar
              </Button>
            )}
            {puedeResetear && (
              <Button type="button" variante="peligro" className="w-full" onClick={() => setReseteando((v) => !v)}>
                Reiniciar…
              </Button>
            )}
            <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/plataforma/tenants')}>
              Volver
            </Button>
          </>
        )
      }
    >
      {editando ? (
        <form id="form-tenant" onSubmit={onSubmit} className="space-y-4">
          <Card titulo="Datos de la empresa">
            <FormField id="editar-nombre" label="Nombre de la empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            <FormField id="editar-subdominio" label="Subdominio" value={subdominio} onChange={(e) => setSubdominio(e.target.value)} required />
            <FormField id="editar-rnc" label="RNC (opcional)" value={rnc} onChange={(e) => setRnc(e.target.value)} />
            <FormField id="editar-direccion" label="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            <FormField id="editar-telefono" label="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            <FormField id="editar-email" label="Correo de la empresa (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="sm:col-span-2">
              <CampoImagen valor={logo} onChange={setLogo} label="Logo (opcional)" />
            </div>
          </Card>
        </form>
      ) : (
        <div className="space-y-4">
          <Card titulo="Datos de la empresa">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Subdominio</span>
              <p className="font-mono text-sm text-slate-700 dark:text-slate-300">{tenant.subdominio}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">RNC</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{tenant.rnc ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Teléfono</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{tenant.telefono ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{tenant.email ?? '—'}</p>
            </div>
            {tenant.direccion && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Dirección</span>
                <p className="text-sm text-slate-700 dark:text-slate-300">{tenant.direccion}</p>
              </div>
            )}
          </Card>

          {cambiandoPlan && (
            <Card titulo="Cambiar plan">
              <div className="sm:col-span-2 space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Plan actual: <span className="font-medium text-slate-700 dark:text-slate-300">{tenant.plan?.nombre ?? 'Sin plan'}</span>
                  {tenant.plan && ` (${ETIQUETA_CICLO[tenant.plan.cicloFacturacion]})`}
                </p>
                <div>
                  <label htmlFor="cambiar-plan-select" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Nuevo plan
                  </label>
                  <Select id="cambiar-plan-select" value={planIdNuevo} onChange={(e) => setPlanIdNuevo(e.target.value)}>
                    <option value="" disabled>
                      Selecciona un plan
                    </option>
                    {planesAsignables.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.nombre} ({ETIQUETA_CICLO[plan.cicloFacturacion]})
                      </option>
                    ))}
                    {tenant.plan && !planesAsignables.some((p) => p.id === tenant.plan!.id) && (
                      <option value={tenant.plan.id}>
                        {tenant.plan.nombre} (inactivo, {ETIQUETA_CICLO[tenant.plan.cicloFacturacion]})
                      </option>
                    )}
                  </Select>
                </div>

                {cambiaCiclo && planNuevo && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    <p className="font-medium">
                      Este cambio pasa de facturación {ETIQUETA_CICLO[tenant.plan!.cicloFacturacion]} a {ETIQUETA_CICLO[planNuevo.cicloFacturacion]}.
                    </p>
                    <p className="mt-1">
                      La fecha de corte no se mueve
                      {tenant.suscripcion && (
                        <>
                          {' '}
                          (sigue agendada para el <strong>{new Date(tenant.suscripcion.fechaProximoCorte).toLocaleDateString('es-DO')}</strong>)
                        </>
                      )}
                      , pero esa próxima factura ya va a cobrar el precio completo del plan nuevo: RD$ {Number(planNuevo.precio).toLocaleString('es-DO')} /{' '}
                      {ETIQUETA_CICLO[planNuevo.cicloFacturacion]}.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variante="secundario" onClick={() => setCambiandoPlan(false)}>
                    Cancelar
                  </Button>
                  <Button disabled={!planIdNuevo || planIdNuevo === tenant.planId || cambiarPlan.isPending} onClick={() => cambiarPlan.mutate()}>
                    {cambiarPlan.isPending ? 'Guardando…' : 'Confirmar cambio de plan'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {reseteando && (
            <Card titulo={`Reiniciar "${tenant.nombre}"`}>
              <div className="sm:col-span-2 space-y-3">
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  Esta acción es irreversible. Se aplica solo a este tenant — el resto de la plataforma no se ve afectado.
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Modo</label>
                  <div className="space-y-2">
                    {(['TRANSACCIONAL', 'COMPLETO'] as const).map((opcion) => (
                      <label key={opcion} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                        <input type="radio" name="modo-reseteo" className="mt-1" checked={modoReseteo === opcion} onChange={() => setModoReseteo(opcion)} />
                        <span>
                          <span className="block font-medium text-slate-900 dark:text-slate-100">
                            {opcion === 'TRANSACCIONAL' ? 'Solo movimientos/transacciones' : 'Global — desde cero'}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{DESCRIPCION_MODO_RESETEO[opcion]}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <FormField
                  id="confirmacion-subdominio"
                  label={`Para confirmar, escribe el subdominio exacto: ${tenant.subdominio}`}
                  value={confirmacionReseteo}
                  onChange={(e) => setConfirmacionReseteo(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variante="secundario" onClick={() => setReseteando(false)}>
                    Cancelar
                  </Button>
                  <Button variante="peligro" disabled={!confirmacionResetValida || resetear.isPending} onClick={() => resetear.mutate()}>
                    {resetear.isPending ? 'Reiniciando…' : 'Reiniciar tenant'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <CardColapsable
            titulo="Suscripción"
            colapsada={suscripcionColapsada}
            onToggle={() => setSuscripcionColapsada((v) => !v)}
            resumen={tenant.plan ? `${tenant.plan.nombre} — RD$ ${Number(tenant.plan.precio).toLocaleString('es-DO')}/${ETIQUETA_CICLO[tenant.plan.cicloFacturacion]}` : 'Sin plan'}
          >
            <div className="sm:col-span-2">
              <SeccionSuscripcion tenantId={tenant.id} />
            </div>
          </CardColapsable>

          <CardColapsable
            titulo="Módulos"
            colapsada={modulosColapsada}
            onToggle={() => setModulosColapsada((v) => !v)}
            resumen={
              !tenant.modulosOverride || tenant.modulosOverride.length === 0
                ? 'Sin excepciones'
                : `${tenant.modulosOverride.length} excepción(es) sobre el plan`
            }
          >
            <div className="sm:col-span-2">
              <SeccionModulos tenantId={tenant.id} planNombre={tenant.plan?.nombre ?? 'Sin plan'} />
            </div>
          </CardColapsable>

          <CardColapsable
            titulo="Dominios propios"
            colapsada={dominiosColapsada}
            onToggle={() => setDominiosColapsada((v) => !v)}
            resumen={`Además de ${tenant.subdominio}.ciguadev.com`}
          >
            <div className="sm:col-span-2">
              <SeccionDominios tenantId={tenant.id} subdominio={tenant.subdominio} />
            </div>
          </CardColapsable>
        </div>
      )}
    </PaginaDocumento>
  );
}

function SeccionSuscripcion({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [feeMoraPct, setFeeMoraPct] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [codigoCupon, setCodigoCupon] = useState('');
  const [errorCupon, setErrorCupon] = useState<string | null>(null);
  const [generandoAdelantada, setGenerandoAdelantada] = useState(false);
  const [ciclos, setCiclos] = useState('1');
  const [errorAdelantada, setErrorAdelantada] = useState<string | null>(null);

  const { data: suscripcion } = useQuery({
    queryKey: ['platform-tenant-suscripcion', tenantId],
    queryFn: async () => (await platformApiClient.get<Suscripcion>(`/platform/tenants/${tenantId}/suscripcion`)).data,
  });
  const { data: cuponAplicado } = useQuery({
    queryKey: ['platform-tenant-suscripcion-cupon', tenantId],
    queryFn: async () => (await platformApiClient.get<CuponAplicado | null>(`/platform/tenants/${tenantId}/suscripcion/cupon`)).data,
  });

  useEffect(() => {
    if (suscripcion) setFeeMoraPct(suscripcion.feeMoraPct);
  }, [suscripcion]);

  const actualizar = useMutation({
    mutationFn: async (data: { feeMoraPct?: number; estado?: 'ACTIVA' | 'CANCELADA'; primerPeriodoGratis?: boolean }) =>
      platformApiClient.patch(`/platform/tenants/${tenantId}/suscripcion`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenant-suscripcion', tenantId] }),
  });

  const aplicarCupon = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/tenants/${tenantId}/suscripcion/cupon`, { codigo: codigoCupon }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-suscripcion-cupon', tenantId] });
      setCodigoCupon('');
      setErrorCupon(null);
    },
    onError: (err) => setErrorCupon(mensajeErrorApi(err, 'No se pudo aplicar el cupón.')),
  });

  const quitarCupon = useMutation({
    mutationFn: async () => platformApiClient.delete(`/platform/tenants/${tenantId}/suscripcion/cupon`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenant-suscripcion-cupon', tenantId] }),
  });

  const generarFactura = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/tenants/${tenantId}/suscripcion/generar-factura`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-facturas'] });
      setMensaje('Factura generada correctamente.');
    },
    onError: (err) => setMensaje(mensajeErrorApi(err, 'No se pudo generar la factura.')),
  });

  const generarAdelantada = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/tenants/${tenantId}/suscripcion/generar-factura-adelantada`, { ciclos: Number(ciclos) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-suscripcion', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['platform-facturas'] });
      setGenerandoAdelantada(false);
      setCiclos('1');
    },
    onError: (err) => setErrorAdelantada(mensajeErrorApi(err, 'No se pudo generar la factura adelantada.')),
  });

  if (!suscripcion) return <p className="text-sm text-slate-400">Cargando…</p>;

  const n = Number(ciclos) || 0;
  const montoAdelantado = n * Number(suscripcion.plan.precio);
  const unidadAdelantada = n === 1 ? ETIQUETA_CICLO[suscripcion.plan.cicloFacturacion] : ETIQUETA_CICLO_PLURAL[suscripcion.plan.cicloFacturacion];

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
        <p>
          Plan: <span className="font-medium">{suscripcion.plan.nombre}</span> — RD$ {Number(suscripcion.plan.precio).toLocaleString('es-DO')} /{' '}
          {ETIQUETA_CICLO[suscripcion.plan.cicloFacturacion]}
        </p>
        <p className="text-slate-500 dark:text-slate-400">Próximo corte: {new Date(suscripcion.fechaProximoCorte).toLocaleDateString('es-DO')}</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado de la suscripción</span>
        <Switch activo={suscripcion.estado === 'ACTIVA'} disabled={actualizar.isPending} onChange={(valor) => actualizar.mutate({ estado: valor ? 'ACTIVA' : 'CANCELADA' })} />
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
          <Button variante="secundario" disabled={actualizar.isPending} onClick={() => actualizar.mutate({ feeMoraPct: Number(feeMoraPct) })}>
            Guardar
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Primer período gratis</span>
          <p className="text-xs text-slate-500 dark:text-slate-400">La próxima factura automática sale en RD$0 y se apaga sola.</p>
        </div>
        <Switch activo={suscripcion.primerPeriodoGratis} disabled={actualizar.isPending} onChange={(valor) => actualizar.mutate({ primerPeriodoGratis: valor })} />
      </div>

      <hr className="border-slate-200 dark:border-slate-800" />

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Cupón de descuento</p>
        {cuponAplicado ? (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
            <div>
              <Badge tono="exito">{cuponAplicado.cupon.codigo}</Badge>{' '}
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {cuponAplicado.cupon.tipo === 'PORCENTAJE' ? `${cuponAplicado.cupon.valor}%` : `RD$ ${Number(cuponAplicado.cupon.valor).toLocaleString('es-DO')}`}
                {' — '}
                {cuponAplicado.ciclosRestantes === null ? 'indefinido' : `${cuponAplicado.ciclosRestantes} ciclo(s) restante(s)`}
              </span>
            </div>
            <Button variante="secundario" disabled={quitarCupon.isPending} onClick={() => quitarCupon.mutate()}>
              Quitar
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Código de cupón"
              value={codigoCupon}
              onChange={(e) => setCodigoCupon(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <Button variante="secundario" disabled={!codigoCupon || aplicarCupon.isPending} onClick={() => aplicarCupon.mutate()}>
              Aplicar
            </Button>
          </div>
        )}
        {errorCupon && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorCupon}</p>}
      </div>

      <hr className="border-slate-200 dark:border-slate-800" />

      <Button className="w-full" disabled={generarFactura.isPending} onClick={() => generarFactura.mutate()}>
        {generarFactura.isPending ? 'Generando…' : 'Generar factura ahora'}
      </Button>
      <Button type="button" variante="secundario" className="w-full" onClick={() => setGenerandoAdelantada((v) => !v)}>
        Generar factura adelantada (varios ciclos)
      </Button>
      {mensaje && <p className="text-sm text-slate-500 dark:text-slate-400">{mensaje}</p>}

      {generandoAdelantada && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Cobra de una sola vez varios ciclos del plan y adelanta la fecha de próximo corte esa misma cantidad. No aplica descuentos (cupón/primer
            período gratis) — se trata como un cargo negociado aparte.
          </p>
          <FormField
            id="factura-adelantada-ciclos"
            label={`Cantidad de ${ETIQUETA_CICLO_PLURAL[suscripcion.plan.cicloFacturacion]}`}
            type="number"
            min="1"
            step="1"
            value={ciclos}
            onChange={(e) => setCiclos(e.target.value)}
          />
          {n > 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Total: RD$ {montoAdelantado.toLocaleString('es-DO')} + ITBIS por {n} {unidadAdelantada}.
            </p>
          )}
          {errorAdelantada && <p className="text-sm text-red-600 dark:text-red-400">{errorAdelantada}</p>}
          <Button className="w-full" disabled={n < 1 || generarAdelantada.isPending} onClick={() => generarAdelantada.mutate()}>
            {generarAdelantada.isPending ? 'Generando…' : 'Generar factura'}
          </Button>
        </div>
      )}
    </div>
  );
}

function SeccionModulos({ tenantId, planNombre }: { tenantId: string; planNombre: string }) {
  const queryClient = useQueryClient();

  const { data: modulos } = useQuery({
    queryKey: ['platform-tenant-modulos', tenantId],
    queryFn: async () => (await platformApiClient.get<ModuloTenant[]>(`/platform/tenants/${tenantId}/modulos`)).data,
  });

  const actualizarOverride = useMutation({
    mutationFn: async ({ clave, activo }: { clave: string; activo: boolean | null }) => platformApiClient.patch(`/platform/tenants/${tenantId}/modulos/${clave}`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenant-modulos', tenantId] }),
  });

  const modulosOrdenados = modulos ? [...modulos].sort((a, b) => Number(b.origen === 'override') - Number(a.origen === 'override')) : [];
  const cantidadExcepciones = modulos?.filter((m) => m.origen === 'override').length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
        <span className="text-slate-500 dark:text-slate-400">Plan:</span>
        <Badge tono="neutro">{planNombre}</Badge>
        {cantidadExcepciones > 0 && (
          <Badge tono="advertencia">
            {cantidadExcepciones} excepci{cantidadExcepciones === 1 ? 'ón' : 'ones'}
          </Badge>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Los módulos marcados como &quot;Excepción&quot; no vienen del plan — fueron activados o desactivados puntualmente para este tenant. Aparecen
        primero en la lista.
      </p>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {modulosOrdenados.map((modulo) => (
          <div
            key={modulo.clave}
            className={
              modulo.origen === 'override'
                ? 'flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20'
                : 'flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800'
            }
          >
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{modulo.nombre}</p>
                <p className="text-xs text-slate-400">{modulo.origen === 'override' ? 'Excepción para este tenant' : 'Heredado del plan'}</p>
              </div>
              {modulo.origen === 'override' && <Badge tono="advertencia">Excepción</Badge>}
            </div>
            <div className="flex items-center gap-2">
              {modulo.origen === 'override' && (
                <button type="button" className="text-xs text-sol-600 hover:underline dark:text-sol-400" onClick={() => actualizarOverride.mutate({ clave: modulo.clave, activo: null })}>
                  Quitar excepción
                </button>
              )}
              <Switch activo={modulo.activo} disabled={actualizarOverride.isPending} onChange={(valor) => actualizarOverride.mutate({ clave: modulo.clave, activo: valor })} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeccionDominios({ tenantId, subdominio }: { tenantId: string; subdominio: string }) {
  const queryClient = useQueryClient();
  const [dominioNuevo, setDominioNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryKey = ['platform-tenant-dominios', tenantId];

  const { data: dominios } = useQuery({
    queryKey,
    queryFn: async () => (await platformApiClient.get<TenantDominio[]>(`/platform/tenants/${tenantId}/dominios`)).data,
  });

  const agregar = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/tenants/${tenantId}/dominios`, { dominio: dominioNuevo }),
    onSuccess: () => {
      setDominioNuevo('');
      setError(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo agregar el dominio.')),
  });

  const verificar = useMutation({
    mutationFn: async (dominioId: string) => platformApiClient.post(`/platform/tenants/${tenantId}/dominios/${dominioId}/verificar`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const eliminar = useMutation({
    mutationFn: async (dominioId: string) => platformApiClient.delete(`/platform/tenants/${tenantId}/dominios/${dominioId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    agregar.mutate();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Además de <span className="font-mono">{subdominio}.ciguadev.com</span> (siempre activo), este tenant puede tener uno o más dominios propios.
        Antes de agregar uno, pedile al cliente que apunte su DNS (CNAME o A record, según lo configurado en Configuración → Dominio propio) al destino
        público de la plataforma.
      </p>

      <div className="space-y-2">
        {dominios?.length === 0 && <p className="text-sm text-slate-400">Sin dominios propios todavía.</p>}
        {dominios?.map((d) => (
          <div key={d.id} className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-slate-900 dark:text-slate-100">{d.dominio}</span>
              <div className="flex items-center gap-2">
                <Badge tono={TONO_POR_ESTADO_DOMINIO[d.estado]}>{d.estado}</Badge>
                {d.estado !== 'ACTIVO' && (
                  <button type="button" className="text-xs text-sol-600 hover:underline dark:text-sol-400" disabled={verificar.isPending} onClick={() => verificar.mutate(d.id)}>
                    Verificar
                  </button>
                )}
                <button type="button" className="text-xs text-red-600 hover:underline dark:text-red-400" disabled={eliminar.isPending} onClick={() => eliminar.mutate(d.id)}>
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
          <FormField id="dominio-nuevo" label="Nuevo dominio" value={dominioNuevo} onChange={(e) => setDominioNuevo(e.target.value)} placeholder="shopy-me.com" required />
        </div>
        <Button type="submit" disabled={agregar.isPending}>
          Agregar
        </Button>
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
