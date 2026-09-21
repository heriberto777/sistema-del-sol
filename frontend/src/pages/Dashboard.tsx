import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  Package,
  PackageX,
  PiggyBank,
  Plane,
  Receipt,
  ShoppingCart,
  Store,
  TrendingUp,
  type LucideIcon,
  Wallet,
  XOctagon,
} from 'lucide-react';
import { StatCard } from '../components/molecules/StatCard/StatCard';
import { Card } from '../components/atoms/Card/Card';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { Select } from '../components/atoms/Select/Select';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';
import { useSucursalActiva } from '../hooks/useSucursalActiva';
import { useUrlTiendaPublica } from '../hooks/useUrlTiendaPublica';

interface DashboardStats {
  ventasHoyTotal: number;
  facturasHoyCantidad: number;
  productosStockBajo: number;
  ordenesCompraPendientes: number;
  alertasInventario: { sinStock: number; stockBajo: number; porVencer7Dias: number; vencidos: number };
}

interface VentaPorDia {
  fecha: string;
  total: number;
  cantidad: number;
}

interface ResumenAntiguedad {
  totalCxC?: number;
  totalCxP?: number;
  totalVencido: number;
  totalPorVencer: number;
  buckets: Record<string, number>;
}

interface ResumenConversion {
  cotizaciones: number;
  convertidas: number;
  tasaConversion: number | null;
}

interface EstadoResultados {
  utilidadNeta: number;
}

interface ResumenRentabilidadProyectos {
  proyectosActivos: number;
  facturado: number;
  costoTotal: number;
  margen: number;
  margenPorcentaje: number | null;
}

interface ResumenAlertasProyectos {
  hitosProximos: { id: string; nombre: string; fechaObjetivo: string; proyecto: string }[];
  tareasVencidasTotal: number;
  tareasVencidas: { id: string; titulo: string; fechaVencimiento: string; proyecto: string; responsables: string[] }[];
}

interface ResumenPedidosPendientes {
  pendientes: number;
}

interface ResumenTravel {
  reservasPorEstado: Record<string, number>;
  ingresosMes: number;
  pendientesDeFacturar: number;
}

const BUCKETS_AGING = [
  { clave: 'CORRIENTE', etiqueta: 'Corriente' },
  { clave: 'D1_30', etiqueta: '1-30' },
  { clave: 'D31_60', etiqueta: '31-60' },
  { clave: 'D61_90', etiqueta: '61-90' },
  { clave: 'D90_MAS', etiqueta: '90+' },
] as const;

function moneda(v: number) {
  return `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fechaCorta(iso: string) {
  return new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
}

function AccesoRapido({
  icono: Icono,
  titulo,
  descripcion,
  onClick,
  href,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
  onClick?: () => void;
  href?: string;
}) {
  const contenido = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sol-50 text-sol-600 dark:bg-sol-900/30 dark:text-sol-400">
        <Icono size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{descripcion}</p>
      </div>
      <ArrowRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600" />
    </>
  );
  const clase =
    'flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-sol-300 dark:border-slate-800 dark:bg-slate-900';
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={clase}>
        {contenido}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={clase}>
      {contenido}
    </button>
  );
}

/** Línea de tendencia de ventas — SVG a mano, un solo trazo (serie única, sin leyenda necesaria). Tooltip vía `<title>` nativo en cada punto. */
function GraficoTendenciaVentas({ datos }: { datos: VentaPorDia[] }) {
  if (datos.length === 0) {
    return <p className="py-14 text-center text-sm text-slate-400 dark:text-slate-500">Sin ventas registradas en los últimos 30 días.</p>;
  }
  const ANCHO = 720;
  const ALTO = 200;
  const PAD_IZQ = 8;
  const PAD_DER = 8;
  const PAD_TOP = 16;
  const PAD_BOT = 24;
  const anchoUtil = ANCHO - PAD_IZQ - PAD_DER;
  const altoUtil = ALTO - PAD_TOP - PAD_BOT;
  const max = Math.max(...datos.map((d) => d.total), 1);

  const x = (i: number) => PAD_IZQ + (datos.length === 1 ? anchoUtil / 2 : (i / (datos.length - 1)) * anchoUtil);
  const y = (v: number) => PAD_TOP + altoUtil - (v / max) * altoUtil;
  const puntos = datos.map((d, i) => `${x(i)},${y(d.total)}`).join(' ');
  const areaPath = `M${x(0)},${PAD_TOP + altoUtil} L${puntos} L${x(datos.length - 1)},${PAD_TOP + altoUtil} Z`;

  const indicesEtiqueta =
    datos.length <= 6 ? datos.map((_, i) => i) : [0, Math.floor((datos.length - 1) / 2), datos.length - 1];

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" role="img" aria-label="Tendencia de ventas de los últimos 30 días">
      {[0, 0.5, 1].map((f) => (
        <line
          key={f}
          x1={PAD_IZQ}
          x2={ANCHO - PAD_DER}
          y1={PAD_TOP + altoUtil * (1 - f)}
          y2={PAD_TOP + altoUtil * (1 - f)}
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth={1}
        />
      ))}
      <text x={PAD_IZQ} y={PAD_TOP - 4} className="fill-slate-400 dark:fill-slate-500" style={{ fontSize: 9 }}>
        Máx {moneda(max)}
      </text>
      <path d={areaPath} className="fill-sol-500/10 dark:fill-sol-400/10" />
      <polyline
        points={puntos}
        fill="none"
        className="stroke-sol-500 dark:stroke-sol-400"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {datos.map((d, i) => (
        <circle
          key={d.fecha}
          cx={x(i)}
          cy={y(d.total)}
          r={i === datos.length - 1 ? 3.5 : 2}
          className="fill-sol-500 dark:fill-sol-400"
        >
          <title>
            {fechaCorta(d.fecha)}: {moneda(d.total)} ({d.cantidad} factura{d.cantidad === 1 ? '' : 's'})
          </title>
        </circle>
      ))}
      {indicesEtiqueta.map((i) => (
        <text key={i} x={x(i)} y={ALTO - 6} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" style={{ fontSize: 9 }}>
          {fechaCorta(datos[i].fecha)}
        </text>
      ))}
    </svg>
  );
}

/** Antigüedad de saldos — barras agrupadas CxC (ámbar, color de marca) vs CxP (azul), 2 series categóricas con leyenda. */
function GraficoAging({ cxc, cxp }: { cxc: Record<string, number>; cxp: Record<string, number> }) {
  const ANCHO = 720;
  const ALTO = 200;
  const PAD_IZQ = 8;
  const PAD_DER = 8;
  const PAD_TOP = 12;
  const PAD_BOT = 28;
  const altoUtil = ALTO - PAD_TOP - PAD_BOT;
  const max = Math.max(...BUCKETS_AGING.flatMap((b) => [cxc[b.clave] ?? 0, cxp[b.clave] ?? 0]), 1);
  const grupoAncho = (ANCHO - PAD_IZQ - PAD_DER) / BUCKETS_AGING.length;
  const barraAncho = grupoAncho * 0.28;
  const gapCentro = 4;

  return (
    <div>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" role="img" aria-label="Antigüedad de saldos: por cobrar vs por pagar">
        <line
          x1={PAD_IZQ}
          x2={ANCHO - PAD_DER}
          y1={PAD_TOP + altoUtil}
          y2={PAD_TOP + altoUtil}
          className="stroke-slate-300 dark:stroke-slate-700"
          strokeWidth={1}
        />
        {BUCKETS_AGING.map((b, i) => {
          const cx = PAD_IZQ + grupoAncho * i + grupoAncho / 2;
          const vCxC = cxc[b.clave] ?? 0;
          const vCxP = cxp[b.clave] ?? 0;
          const hCxC = (vCxC / max) * altoUtil;
          const hCxP = (vCxP / max) * altoUtil;
          return (
            <g key={b.clave}>
              <rect
                x={cx - gapCentro / 2 - barraAncho}
                y={PAD_TOP + altoUtil - hCxC}
                width={barraAncho}
                height={Math.max(hCxC, vCxC > 0 ? 1.5 : 0)}
                rx={2}
                className="fill-sol-500 dark:fill-sol-400"
              >
                <title>Por cobrar {b.etiqueta}: {moneda(vCxC)}</title>
              </rect>
              <rect
                x={cx + gapCentro / 2}
                y={PAD_TOP + altoUtil - hCxP}
                width={barraAncho}
                height={Math.max(hCxP, vCxP > 0 ? 1.5 : 0)}
                rx={2}
                className="fill-sky-500 dark:fill-sky-400"
              >
                <title>Por pagar {b.etiqueta}: {moneda(vCxP)}</title>
              </rect>
              <text x={cx} y={ALTO - 10} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" style={{ fontSize: 9 }}>
                {b.etiqueta}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sol-500 dark:bg-sol-400" /> Por cobrar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-500 dark:bg-sky-400" /> Por pagar
        </span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { tienePermiso, tieneModulo } = useAuth();
  const urlTienda = useUrlTiendaPublica();
  const puedeIrAlPos = tienePermiso('pos.ver') && tieneModulo('pos');
  const { sucursales, sucursalActivaId } = useSucursalActiva();
  const [sucursalId, setSucursalId] = useState<string | null>(null);
  const sucursalFiltro = sucursalId !== null ? sucursalId : (sucursalActivaId ?? '');

  const puedeVerReportes = tienePermiso('reportes.ver');
  const puedeVerInventario = tienePermiso('inventario.ver');
  const puedeVerCxC = tienePermiso('cuentasporcobrar.ver');
  const puedeVerCxP = tienePermiso('cuentasporpagar.ver');
  const puedeVerContabilidad = tienePermiso('contabilidad.ver');
  const puedeVerCotizaciones = tieneModulo('cotizaciones') && tienePermiso('cotizaciones.ver');
  const puedeVerProyectos = tieneModulo('proyectos') && tienePermiso('proyectos.ver');
  const puedeVerRentabilidadProyectos = puedeVerProyectos && tienePermiso('proyectos.rentabilidad.ver');
  const puedeVerTravel = tieneModulo('travel') && tienePermiso('travel.ver');
  const puedeVerPedidosTienda = tieneModulo('ecommerce') && tienePermiso('admin.configuracion');

  const { data, isLoading } = useQuery({
    queryKey: ['reportes-dashboard', sucursalFiltro],
    queryFn: async () =>
      (await apiClient.get<DashboardStats>('/reportes/dashboard', { params: { sucursalId: sucursalFiltro || undefined } })).data,
    enabled: puedeVerReportes,
  });

  const { data: ventasPorDia, isLoading: cargandoTendencia } = useQuery({
    queryKey: ['reportes-ventas-por-dia'],
    queryFn: async () => (await apiClient.get<VentaPorDia[]>('/reportes/ventas/por-dia')).data,
    enabled: puedeVerReportes,
  });

  const { data: cxc } = useQuery({
    queryKey: ['cuentas-por-cobrar-resumen'],
    queryFn: async () => (await apiClient.get<ResumenAntiguedad>('/cuentas-por-cobrar/resumen')).data,
    enabled: puedeVerCxC,
  });

  const { data: cxp } = useQuery({
    queryKey: ['cuentas-por-pagar-resumen'],
    queryFn: async () => (await apiClient.get<ResumenAntiguedad>('/cuentas-por-pagar/resumen')).data,
    enabled: puedeVerCxP,
  });

  const { data: conversionCotizaciones } = useQuery({
    queryKey: ['cotizaciones-resumen-conversion'],
    queryFn: async () => (await apiClient.get<ResumenConversion>('/cotizaciones/resumen-conversion')).data,
    enabled: puedeVerCotizaciones,
  });

  const { data: estadoResultados } = useQuery({
    queryKey: ['contabilidad-estado-resultados-mes'],
    queryFn: async () => (await apiClient.get<EstadoResultados>('/contabilidad/estado-resultados')).data,
    enabled: puedeVerContabilidad,
  });

  const { data: rentabilidadProyectos } = useQuery({
    queryKey: ['proyectos-resumen-rentabilidad'],
    queryFn: async () => (await apiClient.get<ResumenRentabilidadProyectos>('/admin/proyectos/resumen-rentabilidad')).data,
    enabled: puedeVerRentabilidadProyectos,
  });

  const { data: alertasProyectos } = useQuery({
    queryKey: ['proyectos-resumen-alertas'],
    queryFn: async () => (await apiClient.get<ResumenAlertasProyectos>('/admin/proyectos/resumen-alertas')).data,
    enabled: puedeVerProyectos,
  });

  const { data: pedidosPendientes } = useQuery({
    queryKey: ['ecommerce-pedidos-resumen-pendientes'],
    queryFn: async () => (await apiClient.get<ResumenPedidosPendientes>('/admin/ecommerce/pedidos/resumen-pendientes')).data,
    enabled: puedeVerPedidosTienda,
  });

  const { data: travel } = useQuery({
    queryKey: ['travel-resumen'],
    queryFn: async () => (await apiClient.get<ResumenTravel>('/admin/travel/reservas/resumen')).data,
    enabled: puedeVerTravel,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Resumen ejecutivo del negocio.</p>
        </div>
        {sucursales.length > 1 && (
          <div className="w-56">
            <Select value={sucursalFiltro} onChange={(e) => setSucursalId(e.target.value)} className="!w-auto">
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {(puedeIrAlPos || urlTienda) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {puedeIrAlPos && (
            <AccesoRapido icono={Store} titulo="Ir al POS" descripcion="Abrir una caja o continuar un turno" onClick={() => navigate('/pos')} />
          )}
          {urlTienda && (
            <AccesoRapido icono={Globe} titulo="Ver mi tienda online" descripcion="Abre el storefront público en una pestaña nueva" href={urlTienda} />
          )}
        </div>
      )}

      <RequierePermiso permiso="reportes.ver">
        {/* KPI row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            etiqueta="Ventas del día"
            valor={isLoading ? '…' : moneda(data?.ventasHoyTotal ?? 0)}
            icono={Banknote}
          />
          <StatCard etiqueta="Facturas emitidas hoy" valor={isLoading ? '…' : String(data?.facturasHoyCantidad ?? 0)} icono={Receipt} />
          {puedeVerCxC && (
            <StatCard
              etiqueta="Por cobrar vencido"
              valor={cxc ? moneda(cxc.totalVencido) : '…'}
              variacion={cxc ? `de ${moneda(cxc.totalCxC ?? 0)} en total` : undefined}
              icono={Wallet}
            />
          )}
          {puedeVerCxP && (
            <StatCard
              etiqueta="Por pagar vencido"
              valor={cxp ? moneda(cxp.totalVencido) : '…'}
              variacion={cxp ? `de ${moneda(cxp.totalCxP ?? 0)} en total` : undefined}
              icono={PiggyBank}
            />
          )}
        </div>

        {/* Tendencia + antigüedad */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card titulo="Ventas — últimos 30 días" descripcion="Total facturado por día.">
            {cargandoTendencia ? (
              <p className="py-14 text-center text-sm text-slate-400">Cargando…</p>
            ) : (
              <GraficoTendenciaVentas datos={ventasPorDia ?? []} />
            )}
          </Card>
          {(puedeVerCxC || puedeVerCxP) && (
            <Card titulo="Antigüedad de saldos" descripcion="Cuentas por cobrar vs. por pagar, por rango de días vencidos.">
              <GraficoAging cxc={cxc?.buckets ?? {}} cxp={cxp?.buckets ?? {}} />
            </Card>
          )}
        </div>

        {sucursalFiltro && (
          <p className="text-xs text-slate-400">
            "Órdenes de compra pendientes" y los gráficos de este dashboard siempre muestran el total de la empresa — todavía no se puede
            filtrar por sucursal.
          </p>
        )}

        {/* Operación */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Operación</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              etiqueta="Productos con stock bajo"
              valor={isLoading ? '…' : String(data?.productosStockBajo ?? 0)}
              icono={AlertTriangle}
            />
            <StatCard
              etiqueta="Órdenes de compra pendientes"
              valor={isLoading ? '…' : String(data?.ordenesCompraPendientes ?? 0)}
              icono={ShoppingCart}
            />
            {puedeVerCotizaciones && (
              <StatCard
                etiqueta="Conversión de cotizaciones"
                valor={
                  conversionCotizaciones
                    ? conversionCotizaciones.tasaConversion !== null
                      ? `${Math.round(conversionCotizaciones.tasaConversion * 100)}%`
                      : '—'
                    : '…'
                }
                variacion={conversionCotizaciones ? `${conversionCotizaciones.convertidas} de ${conversionCotizaciones.cotizaciones} este mes` : undefined}
                icono={FileText}
              />
            )}
            {puedeVerContabilidad && (
              <StatCard
                etiqueta="Utilidad neta del mes"
                valor={estadoResultados ? moneda(estadoResultados.utilidadNeta) : '…'}
                icono={TrendingUp}
              />
            )}
          </div>
        </div>

        {puedeVerInventario && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Alertas de inventario</h2>
              <Link to="/inventario/alertas" className="flex items-center gap-1 text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400">
                Ver alertas <ArrowRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard etiqueta="Sin stock" valor={isLoading ? '…' : String(data?.alertasInventario.sinStock ?? 0)} icono={PackageX} />
              <StatCard
                etiqueta="Stock bajo"
                valor={isLoading ? '…' : String(data?.alertasInventario.stockBajo ?? 0)}
                icono={AlertTriangle}
              />
              <StatCard
                etiqueta="Por vencer (7 días)"
                valor={isLoading ? '…' : String(data?.alertasInventario.porVencer7Dias ?? 0)}
                icono={CalendarClock}
              />
              <StatCard etiqueta="Vencidos" valor={isLoading ? '…' : String(data?.alertasInventario.vencidos ?? 0)} icono={XOctagon} />
            </div>
          </div>
        )}

        {/* Proyectos */}
        {puedeVerProyectos && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Proyectos</h2>
              <Link to="/proyectos" className="flex items-center gap-1 text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400">
                Ver proyectos <ArrowRight size={12} />
              </Link>
            </div>
            {puedeVerRentabilidadProyectos && (
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  etiqueta="Proyectos activos"
                  valor={rentabilidadProyectos ? String(rentabilidadProyectos.proyectosActivos) : '…'}
                  icono={Package}
                />
                <StatCard
                  etiqueta="Facturado (activos)"
                  valor={rentabilidadProyectos ? moneda(rentabilidadProyectos.facturado) : '…'}
                  icono={Banknote}
                />
                <StatCard
                  etiqueta="Margen (activos)"
                  valor={rentabilidadProyectos ? moneda(rentabilidadProyectos.margen) : '…'}
                  variacion={
                    rentabilidadProyectos?.margenPorcentaje != null
                      ? `${rentabilidadProyectos.margenPorcentaje.toFixed(1)}% de margen`
                      : undefined
                  }
                  icono={TrendingUp}
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card titulo="Hitos próximos" descripcion="Vencen dentro de los próximos 14 días.">
                {!alertasProyectos ? (
                  <p className="text-sm text-slate-400">Cargando…</p>
                ) : alertasProyectos.hitosProximos.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin hitos próximos a vencer.</p>
                ) : (
                  <ul className="space-y-2">
                    {alertasProyectos.hitosProximos.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">
                          {h.nombre} <span className="text-slate-400 dark:text-slate-500">— {h.proyecto}</span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{fechaCorta(h.fechaObjetivo)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card
                titulo="Tareas vencidas del equipo"
                descripcion={alertasProyectos ? `${alertasProyectos.tareasVencidasTotal} en total` : undefined}
              >
                {!alertasProyectos ? (
                  <p className="text-sm text-slate-400">Cargando…</p>
                ) : alertasProyectos.tareasVencidas.length === 0 ? (
                  <p className="flex items-center gap-1.5 text-sm text-slate-400">
                    <CheckCircle2 size={14} /> Sin tareas vencidas.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {alertasProyectos.tareasVencidas.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">
                          {t.titulo} <span className="text-slate-400 dark:text-slate-500">— {t.proyecto}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-red-500">
                          <Clock size={12} /> {fechaCorta(t.fechaVencimiento)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* Plugins activos */}
        {(puedeVerTravel || puedeVerPedidosTienda) && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Plugins activos</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {puedeVerTravel && (
                <Card titulo="Travel" acciones={<Plane size={18} className="text-slate-400" />}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Ingresos del mes</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{travel ? moneda(travel.ingresosMes) : '…'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Pendientes de facturar</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{travel ? travel.pendientesDeFacturar : '…'}</p>
                    </div>
                  </div>
                  <Link to="/travel/reservas" className="mt-3 flex items-center gap-1 text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400">
                    Ver reservas <ArrowRight size={12} />
                  </Link>
                </Card>
              )}
              {puedeVerPedidosTienda && (
                <Card titulo="Tienda Online" acciones={<Store size={18} className="text-slate-400" />}>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Pedidos pendientes de pago</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {pedidosPendientes ? pedidosPendientes.pendientes : '…'}
                    </p>
                  </div>
                  <Link to="/tienda-online" className="mt-3 flex items-center gap-1 text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400">
                    Ver pedidos <ArrowRight size={12} />
                  </Link>
                </Card>
              )}
            </div>
          </div>
        )}
      </RequierePermiso>
    </div>
  );
}
