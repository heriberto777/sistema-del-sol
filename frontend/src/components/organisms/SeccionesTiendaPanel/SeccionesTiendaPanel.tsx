import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { aplanarArbolCategorias, type CategoriaPlana } from '../../../lib/categorias-arbol';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { Select } from '../../atoms/Select/Select';
import { Modal } from '../../molecules/Modal/Modal';
import { ComboboxBusqueda } from '../../molecules/ComboboxBusqueda/ComboboxBusqueda';
import { CampoImagen } from '../../molecules/CampoImagen/CampoImagen';
import { PaginaResultado } from '../../../types/pagina-resultado';

type TipoSeccion = 'PRODUCTOS' | 'CATEGORIA' | 'BANNER' | 'MINIGRID';

interface ProductoBusqueda {
  id: string;
  codigo: string;
  nombre: string;
}

interface SeccionTiendaAdmin {
  id: string;
  tipo: TipoSeccion;
  titulo: string;
  subtitulo: string | null;
  ctaTexto: string | null;
  imagen: string | null;
  color: string | null;
  orden: number;
  activa: boolean;
  categoria: { id: string; nombre: string } | null;
  productos: { productoId: string; producto: { id: string; nombre: string; imagen: string | null } }[];
  categorias: { categoriaId: string; categoria: { id: string; nombre: string } }[];
}

interface PayloadSeccion {
  tipo: TipoSeccion;
  titulo: string;
  subtitulo?: string;
  ctaTexto?: string;
  imagen?: string;
  color?: string;
  activa?: boolean;
  categoriaId?: string;
  productoIds?: string[];
  categoriaIds?: string[];
}

const ETIQUETA_TIPO: Record<TipoSeccion, string> = {
  PRODUCTOS: 'Grilla de productos',
  CATEGORIA: 'Categoría destacada',
  BANNER: 'Banner (slideshow de productos)',
  MINIGRID: 'Mini-grid de categorías',
};

const DESCRIPCION_TIPO: Record<TipoSeccion, string> = {
  PRODUCTOS: 'Elegís a mano qué productos aparecen, en el orden que quieras — se muestran en una grilla, como "Combinalo con...".',
  CATEGORIA: 'Una tarjeta grande que promociona una categoría — clic lleva al catálogo filtrado por esa categoría.',
  BANNER: 'Los mismos productos que "Grilla", pero se muestran como slideshow: cada slide es un producto, clic va a su detalle.',
  MINIGRID: 'Entre 2 y 4 categorías en mini-tarjetas lado a lado.',
};

/**
 * Constructor de secciones del Home de la Tienda Online (Fase 17,
 * "Secciones Dinámicas") — a diferencia de Destacados/Ofertas/Banner de
 * texto (builtin, togglés en la pestaña Personalización de
 * TiendaOnlineConfigPanel), estas las crea/ordena/edita el admin
 * libremente. Vive como pestaña propia de nivel de página (ver
 * TiendaOnline.tsx), no anidada dentro de TiendaOnlineConfigPanel, porque
 * es un CRUD de entidades reales, no un formulario de configuración
 * clave-valor.
 */
export function SeccionesTiendaPanel() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<SeccionTiendaAdmin | 'nueva' | null>(null);

  const { data: secciones, isLoading } = useQuery({
    queryKey: ['admin-secciones-tienda'],
    queryFn: async () => (await apiClient.get<SeccionTiendaAdmin[]>('/admin/ecommerce/secciones')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['admin-secciones-tienda'] });
  }

  const actualizar = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<PayloadSeccion> }) => apiClient.patch(`/admin/ecommerce/secciones/${id}`, dto),
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/ecommerce/secciones/${id}`),
    onSuccess: invalidar,
  });

  const reordenar = useMutation({
    mutationFn: async (ids: string[]) => apiClient.put('/admin/ecommerce/secciones/orden', { ids }),
    onSuccess: invalidar,
  });

  function mover(indice: number, direccion: -1 | 1) {
    if (!secciones) return;
    const destino = indice + direccion;
    if (destino < 0 || destino >= secciones.length) return;
    const ids = secciones.map((s) => s.id);
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    reordenar.mutate(ids);
  }

  return (
    <Card
      titulo="Secciones del Home"
      descripcion="Bloques que arman la página principal de tu tienda, en el orden que definas acá — cada uno con sus propios productos o categorías."
      acciones={
        <Button onClick={() => setEditando('nueva')} className="flex items-center gap-1.5">
          <Plus size={15} />
          Nueva sección
        </Button>
      }
    >
      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}

      {!isLoading && secciones?.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          Todavía no creaste ninguna sección — el Home usa solo Destacados/Ofertas builtin (pestaña Personalización).
        </p>
      )}

      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {secciones?.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => mover(i, -1)}
                disabled={i === 0}
                className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => mover(i, 1)}
                disabled={i === secciones.length - 1}
                className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge tono="neutro">{ETIQUETA_TIPO[s.tipo]}</Badge>
                {!s.activa && <Badge tono="advertencia">Oculta</Badge>}
              </div>
              <p className="mt-1 truncate font-medium text-slate-800 dark:text-slate-200">{s.titulo}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {s.tipo === 'PRODUCTOS' || s.tipo === 'BANNER'
                  ? `${s.productos.length} producto${s.productos.length === 1 ? '' : 's'} elegido${s.productos.length === 1 ? '' : 's'} a mano`
                  : s.tipo === 'CATEGORIA'
                    ? `Vincula a categoría: ${s.categoria?.nombre ?? '—'}`
                    : `${s.categorias.length} categorías`}
              </p>
            </div>

            <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={s.activa}
                onChange={(e) => actualizar.mutate({ id: s.id, dto: { activa: e.target.checked } })}
                className="h-3.5 w-3.5 rounded"
              />
              Visible
            </label>

            <button type="button" onClick={() => setEditando(s)} className="shrink-0 text-slate-400 hover:text-sol-600 dark:hover:text-sol-400" aria-label="Editar">
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => confirm(`¿Eliminar la sección "${s.titulo}"?`) && eliminar.mutate(s.id)}
              className="shrink-0 text-slate-400 hover:text-red-600"
              aria-label="Eliminar"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      {editando && <ModalSeccionTienda seccion={editando === 'nueva' ? null : editando} onClose={() => setEditando(null)} onGuardado={invalidar} />}
    </Card>
  );
}

function ModalSeccionTienda({
  seccion,
  onClose,
  onGuardado,
}: {
  seccion: SeccionTiendaAdmin | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [tipo, setTipo] = useState<TipoSeccion>(seccion?.tipo ?? 'PRODUCTOS');
  const [titulo, setTitulo] = useState(seccion?.titulo ?? '');
  const [subtitulo, setSubtitulo] = useState(seccion?.subtitulo ?? '');
  const [ctaTexto, setCtaTexto] = useState(seccion?.ctaTexto ?? '');
  const [imagen, setImagen] = useState<string | null>(seccion?.imagen ?? null);
  const [color, setColor] = useState(seccion?.color ?? '');
  const [categoriaId, setCategoriaId] = useState(seccion?.categoria?.id ?? '');
  const [productos, setProductos] = useState<{ id: string; nombre: string }[]>(
    seccion?.productos.map((p) => ({ id: p.productoId, nombre: p.producto.nombre })) ?? [],
  );
  const [categoriaIds, setCategoriaIds] = useState<string[]>(seccion?.categorias.map((c) => c.categoriaId) ?? []);
  const [error, setError] = useState<string | null>(null);

  const { data: categoriasArbol } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => (await apiClient.get<CategoriaPlana[]>('/categorias')).data,
  });
  const categoriasPlanas = aplanarArbolCategorias(categoriasArbol ?? []);

  const guardar = useMutation({
    mutationFn: async (dto: PayloadSeccion) =>
      seccion ? apiClient.patch(`/admin/ecommerce/secciones/${seccion.id}`, dto) : apiClient.post('/admin/ecommerce/secciones', dto),
    onSuccess: () => {
      onGuardado();
      onClose();
    },
    onError: (err: unknown) => {
      const mensaje =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(mensaje ?? 'No se pudo guardar la sección.');
    },
  });

  function alternarCategoriaMinigrid(id: string) {
    setCategoriaIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : prev.length >= 4 ? prev : [...prev, id]));
  }

  function quitarProducto(id: string) {
    setProductos((prev) => prev.filter((p) => p.id !== id));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if ((tipo === 'PRODUCTOS' || tipo === 'BANNER') && productos.length === 0) {
      setError('Elegí al menos un producto.');
      return;
    }
    if (tipo === 'CATEGORIA' && !categoriaId) {
      setError('Elegí una categoría.');
      return;
    }
    if (tipo === 'MINIGRID' && categoriaIds.length < 2) {
      setError('Elegí al menos 2 categorías.');
      return;
    }
    guardar.mutate({
      tipo,
      titulo,
      subtitulo: subtitulo || undefined,
      ctaTexto: ctaTexto || undefined,
      imagen: tipo === 'CATEGORIA' ? imagen ?? undefined : undefined,
      color: color || undefined,
      categoriaId: tipo === 'CATEGORIA' ? categoriaId : undefined,
      productoIds: tipo === 'PRODUCTOS' || tipo === 'BANNER' ? productos.map((p) => p.id) : undefined,
      categoriaIds: tipo === 'MINIGRID' ? categoriaIds : undefined,
    });
  }

  return (
    <Modal titulo={seccion ? `Editar sección — "${seccion.titulo}"` : 'Nueva sección'} onClose={onClose} ancho="xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de sección</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(ETIQUETA_TIPO) as TipoSeccion[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  tipo === t
                    ? 'border-sol-500 bg-sol-50 text-sol-700 dark:bg-sol-500/10 dark:text-sol-300'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {ETIQUETA_TIPO[t]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{DESCRIPCION_TIPO[tipo]}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField id="seccion-titulo" label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          <FormField id="seccion-subtitulo" label="Subtítulo (opcional)" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
        </div>
        <FormField
          id="seccion-cta"
          label="Texto del botón (opcional)"
          value={ctaTexto}
          onChange={(e) => setCtaTexto(e.target.value)}
          placeholder='Ej. "Ver la selección"'
        />

        {(tipo === 'PRODUCTOS' || tipo === 'BANNER') && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Productos</label>
            <ComboboxBusqueda<ProductoBusqueda>
              valor={null}
              onSeleccionar={(p) => {
                if (!p || productos.some((x) => x.id === p.id)) return;
                setProductos((prev) => [...prev, { id: p.id, nombre: p.nombre }]);
              }}
              obtenerId={(p) => p.id}
              obtenerEtiqueta={(p) => `${p.codigo} — ${p.nombre}`}
              placeholder="Buscar producto para agregar…"
              icono={<Package size={15} />}
              buscar={async (texto) =>
                (await apiClient.get<PaginaResultado<ProductoBusqueda>>('/productos', { params: { busqueda: texto, tamanoPagina: 10 } })).data.datos
              }
            />
            <div className="flex flex-wrap gap-1.5">
              {productos.map((p) => (
                <span
                  key={p.id}
                  className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {p.nombre}
                  <button type="button" onClick={() => quitarProducto(p.id)} className="text-slate-400 hover:text-red-600" aria-label={`Quitar ${p.nombre}`}>
                    ×
                  </button>
                </span>
              ))}
              {productos.length === 0 && <span className="text-xs text-slate-400">Ningún producto elegido todavía.</span>}
            </div>
          </div>
        )}

        {tipo === 'CATEGORIA' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="seccion-categoria" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Categoría
              </label>
              <Select id="seccion-categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">Elegí una categoría…</option>
                {categoriasPlanas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {'— '.repeat(c.profundidad)}
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <CampoImagen valor={imagen} onChange={setImagen} label="Imagen (opcional)" />
          </div>
        )}

        {tipo === 'MINIGRID' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Categorías (2 a 4)</label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
              {categoriasPlanas.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={categoriaIds.includes(c.id)}
                    onChange={() => alternarCategoriaMinigrid(c.id)}
                    disabled={!categoriaIds.includes(c.id) && categoriaIds.length >= 4}
                    className="h-3.5 w-3.5 rounded"
                  />
                  {'— '.repeat(c.profundidad)}
                  {c.nombre}
                </label>
              ))}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{categoriaIds.length} de 4 elegidas.</span>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="seccion-color" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Color de acento (opcional)
          </label>
          <input
            id="seccion-color"
            type="color"
            value={color || '#c4472b'}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-16 rounded border border-slate-300 dark:border-slate-700"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : seccion ? 'Guardar cambios' : 'Crear sección'}
        </Button>
      </form>
    </Modal>
  );
}
