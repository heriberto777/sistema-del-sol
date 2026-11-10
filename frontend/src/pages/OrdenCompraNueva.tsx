import { FormEvent, useState } from 'react';
import { Plus, Truck, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { SelectorLineaProducto } from '../components/molecules/SelectorLineaProducto/SelectorLineaProducto';
import { SelectorUnidadLinea } from '../components/molecules/SelectorUnidadLinea/SelectorUnidadLinea';
import { NuevoProveedorInline, type ProveedorBasico } from '../components/molecules/NuevoProveedorInline/NuevoProveedorInline';
import { PaginaResultado } from '../types/pagina-resultado';
import { useHayCambios } from '../hooks/useHayCambios';

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  controlaVencimiento: boolean;
}

interface LineaForm {
  productoId: string;
  varianteId: string;
  unidadMedidaId: string;
  cantidad: string;
  costoUnitario: string;
}

const LINEA_VACIA: LineaForm = { productoId: '', varianteId: '', unidadMedidaId: '', cantidad: '1', costoUnitario: '' };

/**
 * Auditoría UX Fase 3 — reemplaza a `ModalNuevaOrdenCompra` (modal ancho xl)
 * con una página real, mismo criterio que InventarioAjusteNuevo/
 * InventarioTransferenciaNueva: ya era un documento complejo (proveedor con
 * alta inline + líneas dinámicas), demasiado para un modal. Ver/Editar/
 * Recibir/Devolver/Pagar siguen siendo modal en `Compras.tsx` — son
 * acciones puntuales sobre una orden ya existente, no la creación.
 */
export function OrdenCompraNueva() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [proveedor, setProveedor] = useState<ProveedorBasico | null>(null);
  const [mostrarNuevoProveedor, setMostrarNuevoProveedor] = useState(false);
  const [lineas, setLineas] = useState<LineaForm[]>([LINEA_VACIA]);
  const [error, setError] = useState<string | null>(null);

  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  function actualizarLinea(i: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const lineasValidas = lineas.filter((l) => l.productoId);
  const total = lineasValidas.reduce((acc, l) => acc + Number(l.cantidad || 0) * Number(l.costoUnitario || 0), 0);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/compras', {
        proveedorId: proveedor?.id,
        lineas: lineasValidas.map((l) => ({
          productoId: l.productoId,
          varianteId: l.varianteId || undefined,
          unidadMedidaId: l.unidadMedidaId || undefined,
          cantidad: Number(l.cantidad),
          costoUnitario: Number(l.costoUnitario),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      confirmarGuardado();
      setTimeout(() => navigate('/compras'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la orden de compra. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!proveedor) {
      setError('Seleccioná un proveedor.');
      return;
    }
    if (lineasValidas.length === 0) {
      setError('Agregá al menos una línea con producto.');
      return;
    }
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ proveedor, lineas });

  return (
    <PaginaDocumento
      titulo="Nueva orden de compra"
      rutaVolver="/compras"
      etiquetaVolver="Volver a Compras"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Proveedor</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{proveedor?.nombre ?? 'Sin seleccionar'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Líneas</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lineasValidas.length} {lineasValidas.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {total.toLocaleString('es-DO')}</span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nueva-oc" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear orden de compra'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/compras')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-oc" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Proveedor">
          <ComboboxBusqueda<ProveedorBasico>
            valor={proveedor}
            onSeleccionar={setProveedor}
            obtenerId={(p) => p.id}
            obtenerEtiqueta={(p) => p.nombre}
            placeholder="Buscar proveedor…"
            icono={<Truck size={15} />}
            buscar={async (texto) =>
              (await apiClient.get<PaginaResultado<ProveedorBasico>>('/proveedores', { params: { busqueda: texto, tamanoPagina: 10 } })).data
                .datos
            }
          />
          <button
            type="button"
            onClick={() => setMostrarNuevoProveedor((v) => !v)}
            className="mt-2 text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
          >
            + Nuevo proveedor
          </button>
          {mostrarNuevoProveedor && (
            <NuevoProveedorInline
              onCreado={(p) => {
                setProveedor(p);
                setMostrarNuevoProveedor(false);
              }}
            />
          )}
        </Card>

        <Card titulo="Líneas">
          <div className="space-y-2">
            {lineas.map((linea, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <SelectorLineaProducto
                  productos={productos ?? []}
                  productoId={linea.productoId}
                  varianteId={linea.varianteId}
                  onChange={(productoId, varianteId) => actualizarLinea(i, { productoId, varianteId, unidadMedidaId: '' })}
                  className="flex-1"
                />
                <SelectorUnidadLinea
                  productoId={linea.productoId}
                  value={linea.unidadMedidaId}
                  onChange={(unidadMedidaId) => actualizarLinea(i, { unidadMedidaId })}
                  className="w-32"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Cant."
                  value={linea.cantidad}
                  onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                  className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Costo"
                  value={linea.costoUnitario}
                  onChange={(e) => actualizarLinea(i, { costoUnitario: e.target.value })}
                  className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {lineas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    aria-label="Quitar línea"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLineas((prev) => [...prev, { ...LINEA_VACIA }])}
              className="flex items-center gap-1 text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
            >
              <Plus size={15} /> Agregar línea
            </button>
          </div>
        </Card>
      </form>
    </PaginaDocumento>
  );
}
