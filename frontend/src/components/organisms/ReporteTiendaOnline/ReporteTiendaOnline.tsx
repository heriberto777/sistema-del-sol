import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, DollarSign, Package, ShoppingCart } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { StatCard } from '../../molecules/StatCard/StatCard';

interface ResumenEcommerce {
  totalPedidos: number;
  pedidosMes: number;
  pendientesDePago: number;
  ventasMes: number;
  porEstado: Record<string, number>;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  PAGADA: 'Pagada',
  PENDIENTE: 'Pendiente de pago',
  BORRADOR: 'Borrador',
  ANULADA: 'Anulada',
};

const fmtRD = (n: number) => `RD$ ${n.toLocaleString('es-DO', { maximumFractionDigits: 2 })}`;

/** Auditoría UX Fase 8 — reporte propio de Tienda Online (antes `reportes: []`). El único dato agregado que existía (resumenPendientes, usado por el Dashboard) era un solo número — este resumen lo completa. */
export function ReporteTiendaOnline() {
  const { data, isLoading } = useQuery({
    queryKey: ['ecommerce-resumen'],
    queryFn: async () => (await apiClient.get<ResumenEcommerce>('/admin/ecommerce/pedidos/resumen')).data,
  });

  if (isLoading || !data) return <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  const estados = Object.keys(data.porEstado);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard etiqueta="Pedidos totales" valor={String(data.totalPedidos)} icono={Package} />
        <StatCard etiqueta="Pedidos este mes" valor={String(data.pedidosMes)} icono={ShoppingCart} />
        <StatCard etiqueta="Ventas este mes" valor={fmtRD(data.ventasMes)} icono={DollarSign} />
        <StatCard etiqueta="Pendientes de pago" valor={String(data.pendientesDePago)} icono={AlertTriangle} />
      </div>

      {estados.length > 0 && (
        <Card titulo="Pedidos por estado de factura">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {estados.map((estado) => (
              <div key={estado} className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">{ETIQUETA_ESTADO[estado] ?? estado}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{data.porEstado[estado]}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
