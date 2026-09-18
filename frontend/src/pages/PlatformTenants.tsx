import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, PauseCircle, Wallet, AlertTriangle } from 'lucide-react';
import { platformApiClient } from '../lib/platform-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { usePlatformAuth } from '../hooks/usePlatformAuth';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Switch } from '../components/atoms/Switch/Switch';
import { Modal } from '../components/molecules/Modal/Modal';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { CampoImagen } from '../components/molecules/CampoImagen/CampoImagen';
import { StatCard } from '../components/molecules/StatCard/StatCard';

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
  plan: { id: string; nombre: string } | null;
  modulosOverride: { activo: boolean; modulo: { clave: string; nombre: string } }[];
  suscripcion: { fechaProximoCorte: string } | null;
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

const ETIQUETA_CICLO: Record<'MENSUAL' | 'ANUAL', string> = { MENSUAL: 'mes', ANUAL: 'año' };
const ETIQUETA_CICLO_PLURAL: Record<'MENSUAL' | 'ANUAL', string> = { MENSUAL: 'meses', ANUAL: 'años' };

function PanelSuscripcionTenant({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [feeMoraPct, setFeeMoraPct] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [modalAdelantadoAbierto, setModalAdelantadoAbierto] = useState(false);
  const [codigoCupon, setCodigoCupon] = useState('');
  const [errorCupon, setErrorCupon] = useState<string | null>(null);

  const { data: suscripcion } = useQuery({
    queryKey: ['platform-tenant-suscripcion', tenant.id],
    queryFn: async () => (await platformApiClient.get<Suscripcion>(`/platform/tenants/${tenant.id}/suscripcion`)).data,
  });

  const { data: cuponAplicado } = useQuery({
    queryKey: ['platform-tenant-suscripcion-cupon', tenant.id],
    queryFn: async () => (await platformApiClient.get<CuponAplicado | null>(`/platform/tenants/${tenant.id}/suscripcion/cupon`)).data,
  });

  useEffect(() => {
    if (suscripcion) setFeeMoraPct(suscripcion.feeMoraPct);
  }, [suscripcion]);

  const actualizar = useMutation({
    mutationFn: async (data: { feeMoraPct?: number; estado?: 'ACTIVA' | 'CANCELADA'; primerPeriodoGratis?: boolean }) =>
      platformApiClient.patch(`/platform/tenants/${tenant.id}/suscripcion`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenant-suscripcion', tenant.id] }),
  });

  const aplicarCupon = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/tenants/${tenant.id}/suscripcion/cupon`, { codigo: codigoCupon }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-suscripcion-cupon', tenant.id] });
      setCodigoCupon('');
      setErrorCupon(null);
    },
    onError: (err) => setErrorCupon(mensajeErrorApi(err, 'No se pudo aplicar el cupón.')),
  });

  const quitarCupon = useMutation({
    mutationFn: async () => platformApiClient.delete(`/platform/tenants/${tenant.id}/suscripcion/cupon`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenant-suscripcion-cupon', tenant.id] }),
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
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
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

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Primer período gratis</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">La próxima factura automática sale en RD$0 y se apaga sola.</p>
          </div>
          <Switch
            activo={suscripcion.primerPeriodoGratis}
            disabled={actualizar.isPending}
            onChange={(valor) => actualizar.mutate({ primerPeriodoGratis: valor })}
          />
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

        <Button
          className="w-full"
          disabled={generarFactura.isPending}
          onClick={() => generarFactura.mutate()}
        >
          {generarFactura.isPending ? 'Generando…' : 'Generar factura ahora'}
        </Button>
        <Button variante="secundario" className="w-full" onClick={() => setModalAdelantadoAbierto(true)}>
          Generar factura adelantada (varios ciclos)
        </Button>
        {mensaje && <p className="text-sm text-slate-500 dark:text-slate-400">{mensaje}</p>}
      </div>

      {modalAdelantadoAbierto && (
        <ModalFacturaAdelantada
          tenant={tenant}
          suscripcion={suscripcion}
          onClose={() => setModalAdelantadoAbierto(false)}
        />
      )}
    </Modal>
  );
}

function ModalFacturaAdelantada({
  tenant,
  suscripcion,
  onClose,
}: {
  tenant: Tenant;
  suscripcion: Suscripcion;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [ciclos, setCiclos] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const generarAdelantada = useMutation({
    mutationFn: async () =>
      platformApiClient.post(`/platform/tenants/${tenant.id}/suscripcion/generar-factura-adelantada`, { ciclos: Number(ciclos) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-suscripcion', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['platform-facturas'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo generar la factura adelantada.')),
  });

  const n = Number(ciclos) || 0;
  const monto = n * Number(suscripcion.plan.precio);
  const unidad = n === 1 ? ETIQUETA_CICLO[suscripcion.plan.cicloFacturacion] : ETIQUETA_CICLO_PLURAL[suscripcion.plan.cicloFacturacion];

  return (
    <Modal titulo={`Factura adelantada — ${tenant.nombre}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Cobra de una sola vez varios ciclos del plan y adelanta la fecha de próximo corte esa misma cantidad. No aplica
          descuentos (cupón/primer período gratis) — se trata como un cargo negociado aparte.
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
            Total: RD$ {monto.toLocaleString('es-DO')} + ITBIS por {n} {unidad}.
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button
          className="w-full"
          disabled={n < 1 || generarAdelantada.isPending}
          onClick={() => generarAdelantada.mutate()}
        >
          {generarAdelantada.isPending ? 'Generando…' : 'Generar factura'}
        </Button>
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
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Modal>
  );
}

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

/** Pedido del usuario (2026-09-10) — reiniciar los datos de un tenant sin recrearlo, en dos modos. Acción irreversible: confirmación por subdominio tipeado, mismo criterio que un borrado (ver `feedback_no_confirm_nativo`). */
function ModalResetearTenant({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<ModoReseteoTenant>('TRANSACCIONAL');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetear = useMutation({
    mutationFn: async () =>
      platformApiClient.post(`/platform/tenants/${tenant.id}/resetear`, { modo, confirmacionSubdominio: confirmacion }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo resetear el tenant.')),
  });

  const confirmacionValida = confirmacion === tenant.subdominio;

  return (
    <Modal titulo={`Reiniciar "${tenant.nombre}"`} onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          Esta acción es irreversible. Se aplica solo a este tenant — el resto de la plataforma no se ve afectado.
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Modo</label>
          <div className="space-y-2">
            {(['TRANSACCIONAL', 'COMPLETO'] as const).map((opcion) => (
              <label
                key={opcion}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
              >
                <input
                  type="radio"
                  name="modo-reseteo"
                  className="mt-1"
                  checked={modo === opcion}
                  onChange={() => setModo(opcion)}
                />
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
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Button
          variante="peligro"
          className="w-full"
          disabled={!confirmacionValida || resetear.isPending}
          onClick={() => resetear.mutate()}
        >
          {resetear.isPending ? 'Reiniciando…' : 'Reiniciar tenant'}
        </Button>
      </div>
    </Modal>
  );
}

export function PlatformTenants() {
  const queryClient = useQueryClient();
  const { tienePermiso } = usePlatformAuth();
  const puedeResetear = tienePermiso('platform.tenants.resetear');

  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [tenantEditando, setTenantEditando] = useState<Tenant | null>(null);
  const [tenantModulos, setTenantModulos] = useState<Tenant | null>(null);
  const [tenantSuscripcion, setTenantSuscripcion] = useState<Tenant | null>(null);
  const [tenantDominios, setTenantDominios] = useState<Tenant | null>(null);
  const [tenantAResetear, setTenantAResetear] = useState<Tenant | null>(null);
  const [tenantCambiandoPlan, setTenantCambiandoPlan] = useState<Tenant | null>(null);

  const { data: tenants } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => (await platformApiClient.get<Tenant[]>('/platform/tenants')).data,
  });

  const { data: planes } = useQuery({
    queryKey: ['platform-planes'],
    queryFn: async () => (await platformApiClient.get<Plan[]>('/platform/planes')).data,
  });

  // Mismo queryKey que PlatformDashboard.tsx — comparte caché, sin duplicar el fetch si ya se visitó esa pantalla.
  const { data: resumen } = useQuery({
    queryKey: ['platform-dashboard'],
    queryFn: async () => (await platformApiClient.get<ResumenPlataforma>('/platform/dashboard')).data,
  });

  const planesAsignables = (planes ?? []).filter((p) => p.activo);
  const activos = (tenants ?? []).filter((t) => t.estado === 'ACTIVO').length;
  const suspendidos = (tenants ?? []).filter((t) => t.estado === 'SUSPENDIDO').length;

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: Tenant['estado'] }) =>
      platformApiClient.patch(`/platform/tenants/${id}`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tenants</h1>
        <Button onClick={() => setModalNuevoAbierto(true)}>Nuevo tenant</Button>
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
                <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
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
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setTenantCambiandoPlan(tenant)}
                      className="text-left hover:underline"
                    >
                      {tenant.plan ? tenant.plan.nombre : <span className="text-slate-400">Sin plan asignado</span>}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    {tenant.modulosOverride.length === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {tenant.modulosOverride.map((ov) => (
                          <span
                            key={ov.modulo.clave}
                            className={
                              ov.activo
                                ? 'rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 line-through dark:bg-red-900/30 dark:text-red-400'
                            }
                          >
                            {ov.activo ? '+ ' : ''}
                            {ov.modulo.nombre}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tono={TONO_POR_ESTADO[tenant.estado]}>{tenant.estado}</Badge>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {tenant.suscripcion ? new Date(tenant.suscripcion.fechaProximoCorte).toLocaleDateString('es-DO') : '—'}
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
                        ...(puedeResetear
                          ? [{ etiqueta: 'Reiniciar…', tono: 'peligro' as const, onClick: () => setTenantAResetear(tenant) }]
                          : []),
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

      {modalNuevoAbierto && <ModalNuevoTenant planes={planesAsignables} onClose={() => setModalNuevoAbierto(false)} />}
      {tenantEditando && <ModalEditarTenant tenant={tenantEditando} onClose={() => setTenantEditando(null)} />}
      {tenantModulos && <PanelModulosTenant tenant={tenantModulos} onClose={() => setTenantModulos(null)} />}
      {tenantSuscripcion && <PanelSuscripcionTenant tenant={tenantSuscripcion} onClose={() => setTenantSuscripcion(null)} />}
      {tenantDominios && <PanelDominiosTenant tenant={tenantDominios} onClose={() => setTenantDominios(null)} />}
      {tenantAResetear && <ModalResetearTenant tenant={tenantAResetear} onClose={() => setTenantAResetear(null)} />}
      {tenantCambiandoPlan && (
        <ModalCambiarPlan tenant={tenantCambiandoPlan} planes={planesAsignables} onClose={() => setTenantCambiandoPlan(null)} />
      )}
    </div>
  );
}

/**
 * Reemplaza el <select> que vivía siempre visible en la fila — asignar un
 * plan es una acción con consecuencias reales (cambia qué módulos ve el
 * tenant) y ahora requiere abrir este modal y confirmar, en vez de bastar
 * un click accidental sobre un dropdown suelto en la tabla.
 */
function ModalCambiarPlan({ tenant, planes, onClose }: { tenant: Tenant; planes: Plan[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [planId, setPlanId] = useState(tenant.planId ?? '');
  const [error, setError] = useState<string | null>(null);

  const cambiarPlan = useMutation({
    mutationFn: async () => platformApiClient.patch(`/platform/tenants/${tenant.id}`, { planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el plan.')),
  });

  return (
    <Modal titulo={`Cambiar plan — ${tenant.nombre}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Plan actual: <span className="font-medium text-slate-700 dark:text-slate-300">{tenant.plan?.nombre ?? 'Sin plan'}</span>
        </p>
        <div>
          <label htmlFor="cambiar-plan-select" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Nuevo plan
          </label>
          <Select id="cambiar-plan-select" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="" disabled>
              Selecciona un plan
            </option>
            {planes.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.nombre}
              </option>
            ))}
            {tenant.plan && !planes.some((p) => p.id === tenant.plan!.id) && (
              <option value={tenant.plan.id}>{tenant.plan.nombre} (inactivo)</option>
            )}
          </Select>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button
          className="w-full"
          disabled={!planId || planId === tenant.planId || cambiarPlan.isPending}
          onClick={() => cambiarPlan.mutate()}
        >
          {cambiarPlan.isPending ? 'Guardando…' : 'Confirmar cambio de plan'}
        </Button>
      </div>
    </Modal>
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
  const [logo, setLogo] = useState<string | null>(null);
  const [planId, setPlanId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // La suscripción nueva queda con `fechaProximoCorte: hoy` (ver
  // TenantsRepository.crearConProvisioning) — recién factura sola en el
  // próximo tick del cron (mañana 8am), sin período de gracia. Sin este
  // paso, el admin de plataforma no veía NINGUNA factura hasta el día
  // siguiente y asumía que algo estaba roto (reporte real del usuario).
  const [tenantCreado, setTenantCreado] = useState<{ id: string; nombre: string } | null>(null);
  const [facturaGenerada, setFacturaGenerada] = useState(false);

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

  if (tenantCreado) {
    return (
      <Modal titulo="Tenant creado" onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-900 dark:text-slate-100">{tenantCreado.nombre}</span> se creó correctamente. La suscripción todavía no
            generó ninguna factura — eso pasa recién en el próximo corte automático. ¿Generamos la primera factura ahora?
          </p>
          {facturaGenerada ? (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Factura generada ✓</p>
          ) : (
            error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variante="secundario" onClick={onClose}>
              {facturaGenerada ? 'Cerrar' : 'Ahora no'}
            </Button>
            {!facturaGenerada && (
              <Button type="button" onClick={() => generarPrimeraFactura.mutate()} disabled={generarPrimeraFactura.isPending}>
                {generarPrimeraFactura.isPending ? 'Generando…' : 'Generar la primera factura'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    );
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
        <CampoImagen valor={logo} onChange={setLogo} label="Logo (opcional)" />
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
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
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
  const [logo, setLogo] = useState<string | null>(tenant.logo);
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
        logo: logo ?? '',
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
        <CampoImagen valor={logo} onChange={setLogo} label="Logo (opcional)" />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
    </Modal>
  );
}
