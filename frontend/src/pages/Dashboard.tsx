import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Banknote, Receipt, ShoppingCart } from 'lucide-react';
import { StatCard } from '../components/molecules/StatCard/StatCard';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { Select } from '../components/atoms/Select/Select';
import { apiClient } from '../lib/api-client';
import { useSucursalActiva } from '../hooks/useSucursalActiva';

interface DashboardStats {
  ventasHoyTotal: number;
  facturasHoyCantidad: number;
  productosStockBajo: number;
  ordenesCompraPendientes: number;
}

export function Dashboard() {
  const { sucursales, sucursalActivaId } = useSucursalActiva();
  const [sucursalId, setSucursalId] = useState('');
  const sucursalFiltro = sucursalId || sucursalActivaId || '';

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
      </RequierePermiso>
    </div>
  );
}
