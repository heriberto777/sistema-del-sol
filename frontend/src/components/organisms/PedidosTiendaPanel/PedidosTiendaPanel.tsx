import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Badge } from '../../atoms/Badge/Badge';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface FacturaResumen {
  id: string;
  numero: string | null;
  ncf: string | null;
  total: string;
  estado: string;
  pagada: boolean;
  fecha: string;
}

interface PedidoTienda {
  id: string;
  facturaId: string;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail: string | null;
  direccionEntrega: string;
  notas: string | null;
  createdAt: string;
  factura: FacturaResumen | null;
}

function badgeFactura(factura: FacturaResumen | null) {
  if (!factura) return <Badge tono="peligro">Sin factura</Badge>;
  if (factura.estado === 'ANULADA') return <Badge tono="peligro">Anulada</Badge>;
  if (factura.pagada) return <Badge tono="exito">Pagada</Badge>;
  return <Badge tono="advertencia">Pendiente de pago</Badge>;
}

/** Lista los pedidos creados desde el storefront público (Fase 3) — solo lectura, el cobro se resuelve en el checkout público ya existente. */
export function PedidosTiendaPanel() {
  const [pagina, setPagina] = useState(1);

  const { data } = useQuery({
    queryKey: ['admin-ecommerce-pedidos', pagina],
    queryFn: async () => (await apiClient.get<PaginaResultado<PedidoTienda>>('/admin/ecommerce/pedidos', { params: { pagina } })).data,
  });

  return (
    <Card titulo="Pedidos de mi tienda" descripcion="Pedidos creados por clientes desde el storefront público." sinPadding>
      {data && data.datos.length === 0 ? (
        <div className="p-5">
          <EstadoVacio titulo="Todavía no hay pedidos" descripcion="Cuando un cliente compre desde tu tienda, aparecerá acá." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Teléfono</th>
                <th className="px-5 py-3">Dirección</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Factura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data?.datos ?? []).map((pedido) => (
                <tr key={pedido.id}>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{new Date(pedido.createdAt).toLocaleDateString('es-DO')}</td>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{pedido.clienteNombre}</td>
                  <td className="px-5 py-3">{pedido.clienteTelefono}</td>
                  <td className="max-w-xs truncate px-5 py-3 text-slate-500 dark:text-slate-400" title={pedido.direccionEntrega}>
                    {pedido.direccionEntrega}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {pedido.factura ? `RD$ ${Number(pedido.factura.total).toLocaleString('es-DO')}` : '—'}
                  </td>
                  <td className="px-5 py-3">{badgeFactura(pedido.factura)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > 0 && (
        <div className="border-t border-slate-100 p-5 dark:border-slate-800">
          <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
        </div>
      )}
    </Card>
  );
}
