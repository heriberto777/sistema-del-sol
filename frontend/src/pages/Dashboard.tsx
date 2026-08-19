import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Banknote, Receipt, ShoppingCart } from 'lucide-react';
import { StatCard } from '../components/molecules/StatCard/StatCard';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { apiClient } from '../lib/api-client';

interface DashboardStats {
  ventasHoyTotal: number;
  facturasHoyCantidad: number;
  productosStockBajo: number;
  ordenesCompraPendientes: number;
}

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['reportes-dashboard'],
    queryFn: async () => (await apiClient.get<DashboardStats>('/reportes/dashboard')).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Resumen operativo del día.</p>
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
      </RequierePermiso>
    </div>
  );
}
