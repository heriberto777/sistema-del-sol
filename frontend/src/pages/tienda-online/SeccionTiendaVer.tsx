import { FormEvent, useEffect, useState } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { aplanarArbolCategorias, type CategoriaPlana } from '../../lib/categorias-arbol';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Button } from '../../components/atoms/Button/Button';
import { Card } from '../../components/atoms/Card/Card';
import { FormField } from '../../components/molecules/FormField/FormField';
import { Select } from '../../components/atoms/Select/Select';
import { ComboboxBusqueda } from '../../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { CampoImagen } from '../../components/molecules/CampoImagen/CampoImagen';
import { PaginaResultado } from '../../types/pagina-resultado';
import { useHayCambios } from '../../hooks/useHayCambios';
import { ICONOS_FRANJA_CONFIANZA } from '../tienda/SeccionFranjaConfianza';

type TipoSeccion = 'PRODUCTOS' | 'CATEGORIA' | 'BANNER' | 'MINIGRID' | 'HERO' | 'DESTACADOS' | 'OFERTAS' | 'FRANJA_CONFIANZA';

interface ProductoBusqueda {
  id: string;
  codigo: string;
  nombre: string;
}

interface ItemFranjaConfianza {
  icono: string;
  texto: string;
}

interface SeccionTiendaAdmin {
  id: string;
  tipo: TipoSeccion;
  titulo: string;
  subtitulo: string | null;
  ctaTexto: string | null;
  imagen: string | null;
  color: string | null;
  contenido: ItemFranjaConfianza[] | null;
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
  contenido?: ItemFranjaConfianza[];
}

const ETIQUETA_TIPO: Record<TipoSeccion, string> = {
  HERO: 'Portada (bienvenida)',
  DESTACADOS: 'Destacados',
  OFERTAS: 'Ofertas',
  PRODUCTOS: 'Grilla de productos',
  CATEGORIA: 'Categoría destacada',
  BANNER: 'Banner (slideshow de productos)',
  MINIGRID: 'Mini-grid de categorías',
  FRANJA_CONFIANZA: 'Franja de confianza (íconos)',
};

const DESCRIPCION_TIPO: Record<TipoSeccion, string> = {
  HERO: 'El bloque de bienvenida arriba de todo — título, subtítulo y una imagen de fondo opcional.',
  DESTACADOS: 'Los productos marcados como "Destacado" en su ficha — acá solo controlás el título y dónde aparece.',
  OFERTAS: 'Las ofertas vigentes ahora mismo (mismo motor de POS/Facturación) — acá solo controlás el título y dónde aparece.',
  PRODUCTOS: 'Elegís a mano qué productos aparecen, en el orden que quieras — se muestran en una grilla, como "Combinalo con...".',
  CATEGORIA: 'Una tarjeta grande que promociona una categoría — clic lleva al catálogo filtrado por esa categoría.',
  BANNER: 'Los mismos productos que "Grilla", pero se muestran como slideshow: cada slide es un producto, clic va a su detalle.',
  MINIGRID: 'Entre 2 y 4 categorías en mini-tarjetas lado a lado.',
  FRANJA_CONFIANZA: 'Entre 2 y 4 íconos con un texto corto cada uno (ej. "Envío a todo el país").',
};

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza al modal ModalSeccionTienda de SeccionesTiendaPanel.tsx. Sin endpoint individual: usa la lista completa de secciones (siempre corta) para editar. */
export function SeccionTiendaVer() {
  const { id } = useParams<{ id: string }>();
  const esNueva = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: secciones } = useQuery({
    queryKey: ['admin-secciones-tienda'],
    queryFn: async () => (await apiClient.get<SeccionTiendaAdmin[]>('/admin/ecommerce/secciones')).data,
  });
  const seccion = esNueva ? null : secciones?.find((s) => s.id === id);

  const [tipo, setTipo] = useState<TipoSeccion>('PRODUCTOS');
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [ctaTexto, setCtaTexto] = useState('');
  const [imagen, setImagen] = useState<string | null>(null);
  const [color, setColor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [productos, setProductos] = useState<{ id: string; nombre: string }[]>([]);
  const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
  const [contenido, setContenido] = useState<ItemFranjaConfianza[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (seccion && !cargado) {
      setTipo(seccion.tipo);
      setTitulo(seccion.titulo);
      setSubtitulo(seccion.subtitulo ?? '');
      setCtaTexto(seccion.ctaTexto ?? '');
      setImagen(seccion.imagen ?? null);
      setColor(seccion.color ?? '');
      setCategoriaId(seccion.categoria?.id ?? '');
      setProductos(seccion.productos.map((p) => ({ id: p.productoId, nombre: p.producto.nombre })));
      setCategoriaIds(seccion.categorias.map((c) => c.categoriaId));
      setContenido(seccion.contenido ?? []);
      setCargado(true);
    }
  }, [seccion, cargado]);

  const { data: categoriasArbol } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => (await apiClient.get<CategoriaPlana[]>('/categorias')).data,
  });
  const categoriasPlanas = aplanarArbolCategorias(categoriasArbol ?? []);

  const guardar = useMutation({
    mutationFn: async (dto: PayloadSeccion) =>
      esNueva ? apiClient.post('/admin/ecommerce/secciones', dto) : apiClient.patch(`/admin/ecommerce/secciones/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-secciones-tienda'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de guardar bien.
      confirmarGuardado();
      setTimeout(() => navigate('/tienda-online/secciones'), 0);
    },
    onError: (err: unknown) => {
      const mensaje =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(mensaje ?? 'No se pudo guardar la sección.');
    },
  });

  function alternarCategoriaMinigrid(idCat: string) {
    setCategoriaIds((prev) => (prev.includes(idCat) ? prev.filter((c) => c !== idCat) : prev.length >= 4 ? prev : [...prev, idCat]));
  }

  function quitarProducto(idProd: string) {
    setProductos((prev) => prev.filter((p) => p.id !== idProd));
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
    if (tipo === 'FRANJA_CONFIANZA' && (contenido.length < 2 || contenido.some((c) => !c.texto.trim()))) {
      setError('Agregá entre 2 y 4 ítems, todos con texto.');
      return;
    }
    guardar.mutate({
      tipo,
      titulo,
      subtitulo: subtitulo || undefined,
      ctaTexto: ctaTexto || undefined,
      imagen: tipo === 'CATEGORIA' || tipo === 'HERO' ? (imagen ?? undefined) : undefined,
      color: color || undefined,
      categoriaId: tipo === 'CATEGORIA' ? categoriaId : undefined,
      productoIds: tipo === 'PRODUCTOS' || tipo === 'BANNER' ? productos.map((p) => p.id) : undefined,
      categoriaIds: tipo === 'MINIGRID' ? categoriaIds : undefined,
      contenido: tipo === 'FRANJA_CONFIANZA' ? contenido : undefined,
    });
  }

  function agregarItemFranja() {
    if (contenido.length >= 4) return;
    setContenido((prev) => [...prev, { icono: 'Truck', texto: '' }]);
  }

  function quitarItemFranja(indice: number) {
    setContenido((prev) => prev.filter((_, i) => i !== indice));
  }

  function actualizarItemFranja(indice: number, cambios: Partial<ItemFranjaConfianza>) {
    setContenido((prev) => prev.map((item, i) => (i === indice ? { ...item, ...cambios } : item)));
  }

  const [haycambios, confirmarGuardado] = useHayCambios(
    { tipo, titulo, subtitulo, ctaTexto, imagen, color, categoriaId, productos, categoriaIds, contenido },
    esNueva || cargado,
  );

  if (!esNueva && !seccion) {
    return (
      <PaginaDocumento
        titulo="Sección del Home"
        rutaVolver="/tienda-online/secciones"
        etiquetaVolver="Volver a Secciones"
        haycambios={false}
        resumen={null}
        acciones={null}
      >
        <p className="text-sm text-slate-400">Cargando…</p>
      </PaginaDocumento>
    );
  }

  return (
    <PaginaDocumento
      titulo={esNueva ? 'Nueva sección' : `Sección — "${seccion!.titulo}"`}
      rutaVolver="/tienda-online/secciones"
      etiquetaVolver="Volver a Secciones"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ETIQUETA_TIPO[tipo]}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-seccion-tienda" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : esNueva ? 'Crear sección' : 'Guardar cambios'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/tienda-online/secciones')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-seccion-tienda" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Tipo de sección">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        </Card>

        <Card titulo="Contenido">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  (await apiClient.get<PaginaResultado<ProductoBusqueda>>('/productos', { params: { busqueda: texto, tamanoPagina: 10 } })).data
                    .datos
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          {tipo === 'HERO' && <CampoImagen valor={imagen} onChange={setImagen} label="Imagen de fondo (opcional)" />}

          {tipo === 'FRANJA_CONFIANZA' && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ítems (2 a 4)</label>
              {contenido.map((item, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Select value={item.icono} onChange={(e) => actualizarItemFranja(i, { icono: e.target.value })} className="!w-36 shrink-0">
                    {Object.keys(ICONOS_FRANJA_CONFIANZA).map((nombre) => (
                      <option key={nombre} value={nombre}>
                        {nombre}
                      </option>
                    ))}
                  </Select>
                  <input
                    type="text"
                    value={item.texto}
                    onChange={(e) => actualizarItemFranja(i, { texto: e.target.value })}
                    placeholder="Ej. Envío a todo el país"
                    maxLength={60}
                    className="min-w-[140px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button type="button" onClick={() => quitarItemFranja(i)} className="shrink-0 text-slate-400 hover:text-red-600" aria-label="Quitar ítem">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {contenido.length < 4 && (
                <Button type="button" variante="secundario" onClick={agregarItemFranja} className="flex w-fit items-center gap-1.5">
                  <Plus size={14} />
                  Agregar ítem
                </Button>
              )}
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
        </Card>
      </form>
    </PaginaDocumento>
  );
}
