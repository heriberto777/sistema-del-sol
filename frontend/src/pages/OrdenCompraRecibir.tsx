import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { SelectorBodega } from '../components/molecules/SelectorBodega/SelectorBodega';
import { useHayCambios } from '../hooks/useHayCambios';

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  controlaVencimiento: boolean;
}

interface LineaOcDetalle {
  productoId: string;
  cantidad: string;
  cantidadRecibida: string;
  costoUnitario: string;
  unidadMedida: { id: string; nombre: string } | null;
  producto: Producto;
}

interface OrdenCompraDetalle {
  id: string;
  numero: string;
  proveedor: { nombre: string };
  lineas: LineaOcDetalle[];
}

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * ModalRecibirOrden de Compras.tsx. Página propia (no un toggle dentro de
 * OrdenCompraVer) porque es un formulario grande por sí mismo: cantidades
 * por línea + lote/vencimiento condicional.
 */
export function OrdenCompraRecibir() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bodegaId, setBodegaId] = useState('');
  const [facturaProveedorNumero, setFacturaProveedorNumero] = useState('');
  const [montoFacturaProveedor, setMontoFacturaProveedor] = useState('');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [numerosLote, setNumerosLote] = useState<Record<string, string>>({});
  const [fechasVencimiento, setFechasVencimiento] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ diferenciaVsFactura: number | null } | null>(null);

  const { data: orden } = useQuery({
    queryKey: ['orden-compra', id],
    queryFn: async () => (await apiClient.get<OrdenCompraDetalle>(`/compras/${id}`)).data,
  });

  const lineasPendientes = (orden?.lineas ?? []).filter((l) => Number(l.cantidad) > Number(l.cantidadRecibida));

  const recibir = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{ diferenciaVsFactura: number | null }>(`/compras/${id}/recibir`, {
          bodegaId,
          facturaProveedorNumero: facturaProveedorNumero || undefined,
          montoFacturaProveedor: montoFacturaProveedor ? Number(montoFacturaProveedor) : undefined,
          lineas: lineasPendientes
            .filter((l) => Number(cantidades[l.productoId] ?? 0) > 0)
            .map((l) => ({
              productoId: l.productoId,
              cantidadRecibida: Number(cantidades[l.productoId]),
              costoUnitario: Number(l.costoUnitario),
              ...(l.producto.controlaVencimiento
                ? { numeroLote: numerosLote[l.productoId], fechaVencimiento: fechasVencimiento[l.productoId] || undefined }
                : {}),
            })),
        })
      ).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['orden-compra', id] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      confirmarGuardado();
      setResultado(data);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo recibir la orden. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    recibir.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ bodegaId, cantidades }, !!orden);

  return (
    <PaginaDocumento
      titulo={orden ? `Recibir orden — ${orden.numero}` : 'Recibir orden'}
      rutaVolver={`/compras/${id}`}
      etiquetaVolver="Volver a la orden"
      haycambios={haycambios}
      resumen={
        orden ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Proveedor</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{orden.proveedor?.nombre}</span>
          </div>
        ) : null
      }
      acciones={
        resultado ? null : (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" form="form-recibir-oc" disabled={recibir.isPending || lineasPendientes.length === 0} className="w-full">
              {recibir.isPending ? 'Recibiendo…' : 'Recibir'}
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/compras/${id}`)}>
              Cancelar
            </Button>
          </>
        )
      }
    >
      {resultado ? (
        <Card titulo="Recepción registrada">
          <div className="sm:col-span-2 space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">La recepción se registró correctamente.</p>
            {resultado.diferenciaVsFactura !== null && (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Diferencia vs. factura del proveedor: RD$ {resultado.diferenciaVsFactura.toLocaleString('es-DO')}
              </p>
            )}
            <Button onClick={() => navigate(`/compras/${id}`)} className="w-full">
              Volver a la orden
            </Button>
          </div>
        </Card>
      ) : !orden ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form id="form-recibir-oc" onSubmit={onSubmit} className="space-y-4">
          <Card titulo="Bodega destino">
            <div className="sm:col-span-2">
              <SelectorBodega value={bodegaId} onChange={setBodegaId} required />
            </div>
          </Card>

          <Card titulo="Líneas pendientes">
            <div className="sm:col-span-2 space-y-2">
              {lineasPendientes.length === 0 && <p className="text-sm text-slate-400">No hay líneas pendientes por recibir.</p>}
              {lineasPendientes.map((linea) => {
                const pendiente = Number(linea.cantidad) - Number(linea.cantidadRecibida);
                return (
                  <div key={linea.productoId} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex-1">
                        {linea.producto.codigo} — {linea.producto.nombre}
                      </span>
                      <span className="text-slate-400">
                        pendiente {pendiente} {linea.unidadMedida?.nombre ?? ''}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={pendiente}
                        placeholder="Recibir"
                        value={cantidades[linea.productoId] ?? ''}
                        onChange={(e) => setCantidades((prev) => ({ ...prev, [linea.productoId]: e.target.value }))}
                        className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      {linea.unidadMedida && <span className="text-slate-400">{linea.unidadMedida.nombre}</span>}
                    </div>
                    {linea.producto.controlaVencimiento && Number(cantidades[linea.productoId] ?? 0) > 0 && (
                      <div className="flex items-center gap-2 pl-2 text-xs">
                        <input
                          type="text"
                          placeholder="Número de lote"
                          value={numerosLote[linea.productoId] ?? ''}
                          onChange={(e) => setNumerosLote((prev) => ({ ...prev, [linea.productoId]: e.target.value }))}
                          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          required
                        />
                        <input
                          type="date"
                          value={fechasVencimiento[linea.productoId] ?? ''}
                          onChange={(e) => setFechasVencimiento((prev) => ({ ...prev, [linea.productoId]: e.target.value }))}
                          className="rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          required
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card titulo="Factura del proveedor (opcional)">
            <FormField
              id="recibir-factura-numero"
              label="Número de factura"
              value={facturaProveedorNumero}
              onChange={(e) => setFacturaProveedorNumero(e.target.value)}
            />
            <FormField
              id="recibir-factura-monto"
              label="Monto de la factura"
              type="number"
              min={0}
              step="0.01"
              value={montoFacturaProveedor}
              onChange={(e) => setMontoFacturaProveedor(e.target.value)}
            />
          </Card>
        </form>
      )}
    </PaginaDocumento>
  );
}
