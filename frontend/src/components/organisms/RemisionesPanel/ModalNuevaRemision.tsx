import { FormEvent, useState } from 'react';
import { Plus, User, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Modal } from '../../molecules/Modal/Modal';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { ComboboxBusqueda } from '../../molecules/ComboboxBusqueda/ComboboxBusqueda';
import { SelectorLineaProducto } from '../../molecules/SelectorLineaProducto/SelectorLineaProducto';
import { Button } from '../../atoms/Button/Button';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { Bodega, Cliente, Producto, LineaForm } from './RemisionesPanel';

export function ModalNuevaRemision({
  productos,
  bodegas,
  onClose,
}: {
  productos: Producto[];
  bodegas: Bodega[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [bodegaId, setBodegaId] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([{ productoId: '', varianteId: '', cantidad: '1' }]);
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/remisiones', {
        clienteId: cliente?.id,
        bodegaId,
        lineas: lineas
          .filter((l) => l.productoId)
          .map((l) => ({ productoId: l.productoId, varianteId: l.varianteId || undefined, cantidad: Number(l.cantidad) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remisiones'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la remisión. Revisa que el número no esté repetido.')),
  });

  function actualizarLinea(index: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cliente) {
      setError('Seleccioná un cliente.');
      return;
    }
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva remisión" onClose={onClose} ancho="2xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <Card
          titulo="Información de la remisión"
          descripcion={'Se crea en borrador (sin tocar inventario) — el descuento real ocurre al marcar "Entregada".'}
          contentClassName="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
            <ComboboxBusqueda<Cliente>
              valor={cliente}
              onSeleccionar={setCliente}
              obtenerId={(c) => c.id}
              obtenerEtiqueta={(c) => c.nombre}
              placeholder="Buscar cliente…"
              icono={<User size={15} />}
              buscar={async (texto) =>
                (await apiClient.get<PaginaResultado<Cliente>>('/clientes', { params: { busqueda: texto, tamanoPagina: 10 } })).data.datos
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Bodega</label>
            <Select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)} required>
              <option value="">Seleccionar…</option>
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card titulo="Líneas">
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Descripción</th>
                    <th className="w-24 px-3 py-2 font-medium">Cant</th>
                    <th className="w-px px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineas.map((linea, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 align-top">
                        <SelectorLineaProducto
                          productos={productos}
                          productoId={linea.productoId}
                          varianteId={linea.varianteId}
                          onChange={(productoId, varianteId) => actualizarLinea(i, { productoId, varianteId })}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={1}
                          step="any"
                          value={linea.cantidad}
                          onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        {lineas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-red-600 hover:text-red-700"
                            aria-label="Quitar línea"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setLineas((prev) => [...prev, { productoId: '', varianteId: '', cantidad: '1' }])}
              className="flex items-center gap-1 text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
            >
              <Plus size={15} /> Agregar línea
            </button>
          </div>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear remisión'}
        </Button>
      </form>
    </Modal>
  );
}
