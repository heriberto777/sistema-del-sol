import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../FormField/FormField';
import { Modal } from '../Modal/Modal';
import { SelectField } from '../FormField/SelectField';
import { SelectCategoria } from '../SelectCategoria/SelectCategoria';
import type { Producto, TipoProducto } from '../../../pages/ProductoFormulario';

/**
 * Benchmark 2026-11-09 (Fase 7.4) — alta rápida de producto desde dentro de
 * otro documento (línea de Factura/Cotización/Remisión/Compra, vía el
 * "+ Crear nuevo…" de `ComboboxBusqueda`), mismo criterio que
 * `ModalCrearClienteRapido`. Sin Combo acá (necesita elegir componentes,
 * contradice el "rápido") — para eso, el link a la página completa.
 */
export function ModalCrearProductoRapido({ onClose, onCreado }: { onClose: () => void; onCreado: (producto: Producto) => void }) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<Extract<TipoProducto, 'PRODUCTO' | 'SERVICIO'>>('PRODUCTO');
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () => {
      const { data: correlativo } = await apiClient.post<{ valor: string }>('/admin/correlativos/PRODUCTO/siguiente');
      const { data: producto } = await apiClient.post<Producto>('/productos', {
        codigo: correlativo.valor,
        nombre,
        tipo,
        categoriaId: categoriaId || null,
        unidadMedida: 'UND',
        porcentajeItbis: 18,
      });
      return producto;
    },
    onSuccess: (producto) => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['productos-select'] });
      queryClient.invalidateQueries({ queryKey: ['productos-select-combo'] });
      onCreado(producto);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el producto.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Este modal puede abrirse desde dentro de OTRO <form> (ej. Nueva
    // Factura, vía el "+ Crear nuevo…" de ComboboxBusqueda) — `Modal` lo
    // porta a `document.body` para que el HTML sea válido, pero React
    // sigue burbujeando el evento sintético por el árbol de COMPONENTES,
    // no el de DOM. Sin este stopPropagation, el submit de este form
    // disparaba TAMBIÉN el onSubmit del form exterior (bug real,
    // encontrado en vivo: "Agregá al menos una línea con producto"
    // aparecía al crear un producto nuevo, antes de que la línea
    // terminara de actualizarse).
    e.stopPropagation();
    setError(null);
    crear.mutate();
  }

  return (
    <Modal titulo="Nuevo producto o servicio" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <SelectField
          id="producto-rapido-tipo"
          label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as 'PRODUCTO' | 'SERVICIO')}
        >
          <option value="PRODUCTO">Producto (mueve inventario)</option>
          <option value="SERVICIO">Servicio (no mueve inventario)</option>
        </SelectField>
        <FormField id="producto-rapido-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
        <div className="flex flex-col gap-1">
          <label htmlFor="producto-rapido-categoria" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Categoría (opcional)
          </label>
          <SelectCategoria id="producto-rapido-categoria" value={categoriaId} onChange={setCategoriaId} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Código asignado automáticamente, unidad "Unidad" e ITBIS 18% — ajustalo después desde el producto si hace falta.
        </p>

        <a
          href="/productos/nuevo"
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
        >
          Ir a la página completa →
        </a>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={!nombre || crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear producto'}
        </Button>
      </form>
    </Modal>
  );
}
