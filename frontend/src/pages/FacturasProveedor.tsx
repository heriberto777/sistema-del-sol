import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { ConfirmModal } from '../components/molecules/ConfirmModal/ConfirmModal';
import { ModalNotaCreditoProveedor } from '../components/molecules/ModalNotaCreditoProveedor/ModalNotaCreditoProveedor';
import { ModalRegistrarPagoFacturaProveedor } from '../components/molecules/ModalRegistrarPagoFacturaProveedor/ModalRegistrarPagoFacturaProveedor';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface FacturaProveedor {
  id: string;
  proveedorId: string;
  tipo: 'FACTURA' | 'NOTA_CREDITO';
  ncfProveedor: string;
  concepto: string | null;
  fecha: string;
  total: string;
  estado: 'EMITIDA' | 'ANULADA';
  pagada: boolean;
  proveedor: { nombre: string };
  cuentaPorPagar: { saldo: string; estado: string } | null;
}

/**
 * Factura de un proveedor a crédito SIN orden de compra (luz, alquiler,
 * servicios profesionales) — ver docs/ARCHITECTURE.md (Fase 5, CxP). Vive
 * junto a Cuentas por pagar: alimenta el mismo aging/resumen, con su propia
 * página porque no hay una "orden" que agrupe el pago.
 */
export function FacturasProveedor() {
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [facturaPagando, setFacturaPagando] = useState<FacturaProveedor | null>(null);
  const [facturaNotaCredito, setFacturaNotaCredito] = useState<FacturaProveedor | null>(null);
  const [facturaAnulando, setFacturaAnulando] = useState<FacturaProveedor | null>(null);
  const [errorAnular, setErrorAnular] = useState<string | null>(null);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data } = useQuery({
    queryKey: ['facturas-proveedor', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<FacturaProveedor>>('/facturas-proveedor', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  const anular = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/facturas-proveedor/${id}/anular`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas-proveedor'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-por-pagar-resumen'] });
      setFacturaAnulando(null);
      setErrorAnular(null);
    },
    onError: (err) => setErrorAnular(mensajeErrorApi(err, 'No se pudo anular. Puede que ya tenga pagos aplicados.')),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Facturas de proveedor</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gastos a crédito de un proveedor sin orden de compra (luz, alquiler, servicios) — entran al mismo aging de Cuentas por pagar.
          </p>
        </div>
        {tienePermiso('facturasproveedor.crear') && <Button onClick={() => navigate('/facturas-proveedor/nueva')}>Nueva factura</Button>}
      </div>

      <RequierePermiso permiso="facturasproveedor.ver">
        {data?.datos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no has registrado facturas de proveedor"
            descripcion="Registrá la primera factura de un proveedor sin orden de compra."
            etiquetaAccion="Nueva factura"
            onAccion={() => navigate('/facturas-proveedor/nueva')}
          />
        ) : (
          <Card
            sinPadding
            titulo="Facturas"
            descripcion={data ? `${data.total} factura(s)` : undefined}
            acciones={
              <SearchInput
                value={busqueda}
                onChange={(v) => {
                  setBusqueda(v);
                  setPagina(1);
                }}
                placeholder="Buscar por NCF o proveedor…"
              />
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">NCF</th>
                    <th className="px-5 py-3 font-medium">Proveedor</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.datos.map((f) => {
                    const esNotaCredito = f.tipo === 'NOTA_CREDITO';
                    const sinPagos = f.cuentaPorPagar ? Number(f.cuentaPorPagar.saldo) === Number(f.total) : false;
                    return (
                      <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3 font-mono text-xs">{f.ncfProveedor}</td>
                        <td className="px-5 py-3">{f.proveedor.nombre}</td>
                        <td className="px-5 py-3">{new Date(f.fecha).toLocaleDateString('es-DO')}</td>
                        <td className="px-5 py-3">
                          {esNotaCredito ? '-' : ''}RD$ {Number(f.total).toLocaleString('es-DO')}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {esNotaCredito && <Badge tono="neutro">Nota de crédito</Badge>}
                            {f.estado === 'ANULADA' && <Badge tono="peligro">Anulada</Badge>}
                            {f.estado === 'EMITIDA' && !esNotaCredito && (
                              <Badge tono={f.pagada ? 'exito' : 'advertencia'}>{f.pagada ? 'Pagada' : 'Pendiente'}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {f.estado === 'EMITIDA' && !esNotaCredito && (
                            <div className="flex justify-end gap-2">
                              {!f.pagada && tienePermiso('facturasproveedor.pagar') && (
                                <Button variante="secundario" onClick={() => setFacturaPagando(f)}>
                                  Registrar pago
                                </Button>
                              )}
                              {tienePermiso('facturasproveedor.crear') && (
                                <Button variante="secundario" onClick={() => setFacturaNotaCredito(f)}>
                                  Nota de crédito
                                </Button>
                              )}
                              {sinPagos && tienePermiso('facturasproveedor.anular') && (
                                <Button variante="peligro" onClick={() => setFacturaAnulando(f)}>
                                  Anular
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data && (
              <div className="px-5 py-3">
                <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
              </div>
            )}
          </Card>
        )}
      </RequierePermiso>

      {facturaPagando && (
        <ModalRegistrarPagoFacturaProveedor
          factura={{ id: facturaPagando.id, ncfProveedor: facturaPagando.ncfProveedor, total: facturaPagando.total }}
          onClose={() => setFacturaPagando(null)}
        />
      )}
      {facturaNotaCredito && (
        <ModalNotaCreditoProveedor
          factura={{ id: facturaNotaCredito.id, ncfProveedor: facturaNotaCredito.ncfProveedor, proveedorId: facturaNotaCredito.proveedorId }}
          onClose={() => setFacturaNotaCredito(null)}
        />
      )}
      {facturaAnulando && (
        <ConfirmModal
          titulo="Anular factura de proveedor"
          descripcion={
            <div className="space-y-2">
              <p>
                ¿Anular la factura <span className="font-mono">{facturaAnulando.ncfProveedor}</span> de {facturaAnulando.proveedor.nombre}?
              </p>
              {errorAnular && <p className="text-red-600 dark:text-red-400">{errorAnular}</p>}
            </div>
          }
          confirmarTexto="Anular"
          confirmando={anular.isPending}
          onConfirmar={() => anular.mutate(facturaAnulando.id)}
          onCancelar={() => {
            setFacturaAnulando(null);
            setErrorAnular(null);
          }}
        />
      )}
    </div>
  );
}
