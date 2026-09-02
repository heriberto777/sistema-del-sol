import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Banknote, CalendarClock, Globe, PackageX, Receipt, ShoppingCart, Store, type LucideIcon, XOctagon } from 'lucide-react';
import { StatCard } from '../components/molecules/StatCard/StatCard';
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

export function Dashboard() {
  const navigate = useNavigate();
  const { tienePermiso, tieneModulo } = useAuth();
  const urlTienda = useUrlTiendaPublica();
  const puedeIrAlPos = tienePermiso('pos.ver') && tieneModulo('pos');
  const { sucursales, sucursalActivaId } = useSucursalActiva();
  // `null` = el usuario todavía no tocó el filtro (usar la sucursal activa
  // como default); `''` = el usuario eligió explícitamente "Todas las
  // sucursales" — hay que respetarlo, NO recaer en sucursalActivaId (si
  // no, nunca se podría volver a "todas" una vez que hay una activa).
  const [sucursalId, setSucursalId] = useState<string | null>(null);
  const sucursalFiltro = sucursalId !== null ? sucursalId : (sucursalActivaId ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['reportes-dashboard', sucursalFiltro],
    queryFn: async () =>
      (await apiClient.get<DashboardStats>('/reportes/dashboard', { params: { sucursalId: sucursalFiltro || undefined } })).data,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Resumen operativo del día.</p>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            etiqueta="Ventas del día"
            valor={isLoading ? '…' : `RD$ ${(data?.ventasHoyTotal ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`}
            icono={Banknote}
          />
          <StatCard etiqueta="Facturas emitidas" valor={isLoading ? '…' : String(data?.facturasHoyCantidad ?? 0)} icono={Receipt} />
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
        </div>
        {sucursalFiltro && (
          <p className="text-xs text-slate-400">
            "Órdenes de compra pendientes" siempre muestra el total de la empresa — todavía no se puede filtrar por sucursal.
          </p>
        )}

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Alertas de inventario</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              etiqueta="Sin stock"
              valor={isLoading ? '…' : String(data?.alertasInventario.sinStock ?? 0)}
              icono={PackageX}
            />
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
            <StatCard
              etiqueta="Vencidos"
              valor={isLoading ? '…' : String(data?.alertasInventario.vencidos ?? 0)}
              icono={XOctagon}
            />
          </div>
        </div>
      </RequierePermiso>
    </div>
  );
}
