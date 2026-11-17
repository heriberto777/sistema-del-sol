import { useQuery } from '@tanstack/react-query';
import { Mail, MessageCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Badge } from '../../components/atoms/Badge/Badge';
import { Button } from '../../components/atoms/Button/Button';

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

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal DetallePedidoModal de PedidosTiendaPanel.tsx. */
export function PedidoTiendaVer() {
  const { facturaId } = useParams<{ facturaId: string }>();
  const navigate = useNavigate();

  const { data: detalle, isLoading } = useQuery({
    queryKey: ['admin-ecommerce-pedido-detalle', facturaId],
    queryFn: async () => (await apiClient.get<DetallePedido>(`/admin/ecommerce/pedidos/${facturaId}`)).data,
  });
  const pedido = detalle?.pedido;

  return (
    <PaginaDocumento
      titulo={pedido ? `Pedido de ${pedido.clienteNombre}` : 'Pedido de la tienda'}
      rutaVolver="/tienda-online/pedidos"
      etiquetaVolver="Volver a Pedidos"
      haycambios={false}
      resumen={
        detalle?.factura ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatearPrecio(detalle.factura.total)}</span>
          </div>
        ) : null
      }
      acciones={
        <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/tienda-online/pedidos')}>
          Volver
        </Button>
      }
    >
      {!detalle ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card titulo="Datos del cliente">
              {pedido ? (
                <div className="flex flex-col gap-1.5 text-sm">
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
              ) : (
                <p className="text-sm text-slate-400">Sin datos de contacto para este pedido.</p>
              )}
            </Card>

            <Card titulo="Factura">
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Número</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{detalle.factura.numero ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Fecha</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(detalle.factura.fecha).toLocaleDateString('es-DO')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Estado</span>
                  {badgeFactura(detalle.factura)}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Total</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{formatearPrecio(detalle.factura.total)}</span>
                </div>
              </div>
            </Card>
          </div>

          <Card titulo="Qué pidió">
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
          </Card>
        </div>
      )}
      {isLoading && null}
    </PaginaDocumento>
  );
}
