import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, MessageCircle } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Modal } from '../../molecules/Modal/Modal';
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

interface LineaPedido {
  nombre: string;
  cantidad: string;
  precioUnitario: string;
  montoTotal: string;
}

interface DetallePedido {
  factura: FacturaResumen;
  pedido: PedidoTienda | null;
  lineas: LineaPedido[];
}

function badgeFactura(factura: FacturaResumen | null) {
  if (!factura) return <Badge tono="peligro">Sin factura</Badge>;
  if (factura.estado === 'ANULADA') return <Badge tono="peligro">Anulada</Badge>;
  if (factura.pagada) return <Badge tono="exito">Pagada</Badge>;
  return <Badge tono="advertencia">Pendiente de pago</Badge>;
}

function formatearPrecio(monto: string | number) {
  return `RD$ ${Number(monto).toLocaleString('es-DO')}`;
}

/** Solo dígitos, con el 1 de RD si hace falta — mismo criterio simple que ya usan enlaces `wa.me` en el resto del ecosistema (sin librería de formato de teléfono en el repo). */
function telefonoWhatsapp(telefono: string) {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.length === 10 ? `1${digitos}` : digitos;
}

function DetallePedidoModal({ pedido, onClose }: { pedido: PedidoTienda; onClose: () => void }) {
  const { data: detalle, isLoading } = useQuery({
    queryKey: ['admin-ecommerce-pedido-detalle', pedido.facturaId],
    queryFn: async () => (await apiClient.get<DetallePedido>(`/admin/ecommerce/pedidos/${pedido.facturaId}`)).data,
  });

  return (
    <Modal titulo={`Pedido de ${pedido.clienteNombre}`} onClose={onClose} ancho="2xl">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Datos del cliente</h3>
          <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 p-3.5 text-sm dark:border-slate-800">
            <p className="font-medium text-slate-900 dark:text-slate-100">{pedido.clienteNombre}</p>
            <p className="text-slate-600 dark:text-slate-400">{pedido.direccionEntrega}</p>
            {pedido.notas && <p className="italic text-slate-500 dark:text-slate-400">"{pedido.notas}"</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${telefonoWhatsapp(pedido.clienteTelefono)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <MessageCircle size={13} /> {pedido.clienteTelefono}
              </a>
              {pedido.clienteEmail && (
                <a
                  href={`mailto:${pedido.clienteEmail}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Mail size={13} /> {pedido.clienteEmail}
                </a>
              )}
            </div>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Factura</h3>
          <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 p-3.5 text-sm dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Número</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{pedido.factura?.numero ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Fecha</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{pedido.factura ? new Date(pedido.factura.fecha).toLocaleDateString('es-DO') : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Estado</span>
              {badgeFactura(pedido.factura)}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Total</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{pedido.factura ? formatearPrecio(pedido.factura.total) : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Qué pidió</h3>
      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
      {detalle && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5">Producto</th>
                <th className="px-4 py-2.5">Cantidad</th>
                <th className="px-4 py-2.5">Precio</th>
                <th className="px-4 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {detalle.lineas.map((linea, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{linea.nombre}</td>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{linea.cantidad}</td>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{formatearPrecio(linea.precioUnitario)}</td>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{formatearPrecio(linea.montoTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/** Lista los pedidos creados desde el storefront público (Fase 3) — solo lectura, el cobro se resuelve en el checkout público ya existente. "Ver detalle" (Fase 14) trae las líneas + centraliza los datos de contacto para hacer seguimiento. */
export function PedidosTiendaPanel() {
  const [pagina, setPagina] = useState(1);
  const [pedidoDetalle, setPedidoDetalle] = useState<PedidoTienda | null>(null);

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
                <th className="px-5 py-3">Contacto</th>
                <th className="px-5 py-3">Dirección</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Factura</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data?.datos ?? []).map((pedido) => (
                <tr key={pedido.id}>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{new Date(pedido.createdAt).toLocaleDateString('es-DO')}</td>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{pedido.clienteNombre}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    <div>{pedido.clienteTelefono}</div>
                    {pedido.clienteEmail && <div className="text-xs">{pedido.clienteEmail}</div>}
                  </td>
                  <td className="max-w-xs truncate px-5 py-3 text-slate-500 dark:text-slate-400" title={pedido.direccionEntrega}>
                    {pedido.direccionEntrega}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {pedido.factura ? formatearPrecio(pedido.factura.total) : '—'}
                  </td>
                  <td className="px-5 py-3">{badgeFactura(pedido.factura)}</td>
                  <td className="px-5 py-3">
                    <Button variante="secundario" onClick={() => setPedidoDetalle(pedido)}>
                      Ver detalle
                    </Button>
                  </td>
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
      {pedidoDetalle && <DetallePedidoModal pedido={pedidoDetalle} onClose={() => setPedidoDetalle(null)} />}
    </Card>
  );
}
