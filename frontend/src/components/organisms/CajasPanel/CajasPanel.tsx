import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { SelectorBodega } from '../../molecules/SelectorBodega/SelectorBodega';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';

interface Categoria {
  id: string;
  nombre: string;
}

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
}

interface Caja {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  bodega: { id: string; nombre: string };
  categorias: { categoriaId: string; categoria: Categoria }[];
  productos: { productoId: string; producto: Producto }[];
  favoritos: { productoId: string; producto: Producto }[];
}

interface CajaFormValues {
  bodegaId: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  categoriaIds: string[];
  productoIds: string[];
  favoritoIds: string[];
}

const VACIO: CajaFormValues = { bodegaId: '', codigo: '', nombre: '', activa: true, categoriaIds: [], productoIds: [], favoritoIds: [] };

/**
 * "Caja" como entidad propia (plan de integración Cuadre, ítem E-7) —
 * terminal física de POS, distinta de Bodega y de TurnoCaja. Sin
 * categorías ni productos asignados, la Caja vende el catálogo completo
 * (default permisivo) — la restricción solo se aplica en el checkout del
 * POS (nunca en Facturación directa), ver ARCHITECTURE.md.
 */
export function CajasPanel() {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cajaEditando, setCajaEditando] = useState<Caja | null>(null);

  const { data: cajas } = useQuery({
    queryKey: ['cajas'],
    queryFn: async () => (await apiClient.get<Caja[]>('/cajas')).data,
  });

  function abrirNueva() {
    setCajaEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(caja: Caja) {
    setCajaEditando(caja);
    setModalAbierto(true);
  }

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/cajas/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cajas'] }),
  });

  return (
    <Card
      titulo="Cajas"
      descripcion="Terminales de POS — restringí qué categorías/productos puede vender cada una (opcional)."
      acciones={<Button onClick={abrirNueva}>Nueva caja</Button>}
    >
      {cajas?.length === 0 ? (
        <EstadoVacio titulo="Todavía no hay cajas" descripcion="Sin ninguna Caja, el POS funciona igual que hoy, sin restricción." etiquetaAccion="Nueva caja" onAccion={abrirNueva} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Bodega</th>
                <th className="px-5 py-3 font-medium">Restricción</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {cajas?.map((caja) => (
                <tr key={caja.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 font-mono text-xs">{caja.codigo}</td>
                  <td className="px-5 py-3">{caja.nombre}</td>
                  <td className="px-5 py-3">{caja.bodega.nombre}</td>
                  <td className="px-5 py-3">
                    {caja.categorias.length === 0 && caja.productos.length === 0 ? (
                      <span className="text-slate-400">Vende todo</span>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {caja.categorias.length} categoría(s), {caja.productos.length} producto(s)
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tono={caja.activa ? 'exito' : 'neutro'}>{caja.activa ? 'Activa' : 'Inactiva'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <RowActionsMenu
                      acciones={[
                        { etiqueta: 'Editar', onClick: () => abrirEditar(caja) },
                        { etiqueta: 'Eliminar', onClick: () => eliminar.mutate(caja.id) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAbierto && (
        <Modal titulo={cajaEditando ? 'Editar caja' : 'Nueva caja'} ancho="lg" onClose={() => setModalAbierto(false)}>
          <FormularioCaja caja={cajaEditando} onGuardado={() => setModalAbierto(false)} />
        </Modal>
      )}
    </Card>
  );
}

function FormularioCaja({ caja, onGuardado }: { caja: Caja | null; onGuardado: () => void }) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<CajaFormValues>(
    caja
      ? {
          bodegaId: caja.bodega.id,
          codigo: caja.codigo,
          nombre: caja.nombre,
          activa: caja.activa,
          categoriaIds: caja.categorias.map((c) => c.categoriaId),
          productoIds: caja.productos.map((p) => p.productoId),
          favoritoIds: caja.favoritos.map((f) => f.productoId),
        }
      : VACIO,
  );
  const [error, setError] = useState<string | null>(null);

  const { data: categorias } = useQuery({
    queryKey: ['categorias-select-caja'],
    queryFn: async () => (await apiClient.get<Categoria[]>('/categorias')).data,
  });
  const { data: productos } = useQuery({
    queryKey: ['productos-select-caja'],
    queryFn: async () => (await apiClient.get<{ datos: Producto[] }>('/productos', { params: { tamanoPagina: 200 } })).data.datos,
  });

  function alternar(lista: keyof Pick<CajaFormValues, 'categoriaIds' | 'productoIds' | 'favoritoIds'>, id: string) {
    setValores((v) => ({
      ...v,
      [lista]: v[lista].includes(id) ? v[lista].filter((x) => x !== id) : [...v[lista], id],
    }));
  }

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = {
        bodegaId: valores.bodegaId,
        nombre: valores.nombre,
        activa: valores.activa,
        categoriaIds: valores.categoriaIds,
        productoIds: valores.productoIds,
        favoritoIds: valores.favoritoIds,
      };
      // El código lo asigna el correlativo parametrizado al crear — no se
      // envía en el alta. En edición no se toca (no hay campo editable).
      return caja ? apiClient.patch(`/cajas/${caja.id}`, payload) : apiClient.post('/cajas', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cajas'] });
      onGuardado();
    },
    onError: () => setError('No se pudo guardar la caja.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Bodega</label>
        <SelectorBodega value={valores.bodegaId} onChange={(bodegaId) => setValores((v) => ({ ...v, bodegaId }))} required />
      </div>
      {caja && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Código <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{caja.codigo}</span> (asignado automáticamente, no editable)
        </p>
      )}
      <FormField label="Nombre" value={valores.nombre} onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))} required />
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={valores.activa} onChange={(e) => setValores((v) => ({ ...v, activa: e.target.checked }))} />
        Caja activa
      </label>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          Categorías permitidas (vacío = sin restricción de categoría)
        </p>
        <div className="max-h-32 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
          {categorias?.map((c) => (
            <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={valores.categoriaIds.includes(c.id)} onChange={() => alternar('categoriaIds', c.id)} />
              {c.nombre}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          Productos puntuales permitidos (además de los de las categorías de arriba)
        </p>
        <div className="max-h-32 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
          {productos?.map((p) => (
            <label key={p.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={valores.productoIds.includes(p.id)} onChange={() => alternar('productoIds', p.id)} />
              {p.codigo} — {p.nombre}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          Favoritos (accesos rápidos en la grilla del POS — independiente de la restricción)
        </p>
        <div className="max-h-32 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
          {productos?.map((p) => (
            <label key={p.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={valores.favoritoIds.includes(p.id)} onChange={() => alternar('favoritoIds', p.id)} />
              {p.codigo} — {p.nombre}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={guardar.isPending} className="w-full">
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}
