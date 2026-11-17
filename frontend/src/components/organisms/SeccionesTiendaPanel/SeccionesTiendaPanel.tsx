import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';
import { ConfirmModal } from '../../molecules/ConfirmModal/ConfirmModal';

type TipoSeccion = 'PRODUCTOS' | 'CATEGORIA' | 'BANNER' | 'MINIGRID' | 'HERO' | 'DESTACADOS' | 'OFERTAS' | 'FRANJA_CONFIANZA';

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
  activa?: boolean;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [seccionAEliminar, setSeccionAEliminar] = useState<SeccionTiendaAdmin | null>(null);

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
        <Button onClick={() => navigate('/tienda-online/secciones/nueva')} className="flex items-center gap-1.5">
          <Plus size={15} />
          Nueva sección
        </Button>
      }
    >
      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}

      {!isLoading && secciones?.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          Todavía no creaste ninguna sección — tu Home no va a mostrar nada entre el menú y el pie de página.
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
                    : s.tipo === 'MINIGRID'
                      ? `${s.categorias.length} categorías`
                      : s.tipo === 'HERO'
                        ? (s.subtitulo ?? 'Bloque de bienvenida')
                        : s.tipo === 'DESTACADOS'
                          ? 'Productos marcados como destacados'
                          : s.tipo === 'OFERTAS'
                            ? 'Ofertas vigentes ahora mismo'
                            : `${s.contenido?.length ?? 0} ítems`}
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

            <button
              type="button"
              onClick={() => navigate(`/tienda-online/secciones/${s.id}`)}
              className="shrink-0 text-slate-400 hover:text-sol-600 dark:hover:text-sol-400"
              aria-label="Editar"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => setSeccionAEliminar(s)}
              className="shrink-0 text-slate-400 hover:text-red-600"
              aria-label="Eliminar"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      {seccionAEliminar && (
        <ConfirmModal
          titulo="¿Eliminar esta sección?"
          descripcion={
            <>
              Se eliminará la sección <b>"{seccionAEliminar.titulo}"</b> del Home de la tienda.
            </>
          }
          confirmando={eliminar.isPending}
          onConfirmar={() => {
            eliminar.mutate(seccionAEliminar.id);
            setSeccionAEliminar(null);
          }}
          onCancelar={() => setSeccionAEliminar(null)}
        />
      )}
    </Card>
  );
}
