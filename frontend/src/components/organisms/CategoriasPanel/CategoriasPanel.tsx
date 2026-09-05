import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { aplanarArbolCategorias, type CategoriaPlana } from '../../../lib/categorias-arbol';
import { COLORES_CATEGORIA, ETIQUETA_COLOR_CATEGORIA, CLASE_PUNTO_COLOR_CATEGORIA, type ColorCategoria } from '../../../lib/color-categoria';
import { FormField } from '../../molecules/FormField/FormField';
import { SelectCategoria } from '../../molecules/SelectCategoria/SelectCategoria';
import { Select } from '../../atoms/Select/Select';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';

export function CategoriasPanel() {
  const queryClient = useQueryClient();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [categoriaPadreId, setCategoriaPadreId] = useState('');
  const [color, setColor] = useState<ColorCategoria | ''>('');
  const [error, setError] = useState<string | null>(null);

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => (await apiClient.get<CategoriaPlana[]>('/categorias')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['categorias'] });
  }

  function limpiar() {
    setEditandoId(null);
    setNombre('');
    setCategoriaPadreId('');
    setColor('');
    setError(null);
  }

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = { nombre, categoriaPadreId: categoriaPadreId || null, color: color || null };
      return editandoId ? apiClient.patch(`/categorias/${editandoId}`, payload) : apiClient.post('/categorias', payload);
    },
    onSuccess: () => {
      invalidar();
      limpiar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar (¿ya existe una categoría con ese nombre, o se creó un ciclo?).')),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/categorias/${id}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar — revisá que no tenga productos ni subcategorías asignadas.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  function editar(c: CategoriaPlana) {
    setEditandoId(c.id);
    setNombre(c.nombre);
    setCategoriaPadreId(c.categoriaPadreId ?? '');
    setColor(c.color ?? '');
  }

  const plano = aplanarArbolCategorias(categorias ?? []);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo={editandoId ? 'Editar categoría' : 'Nueva categoría'}>
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField id="categoria-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Categoría padre (opcional)</label>
            <SelectCategoria value={categoriaPadreId} onChange={setCategoriaPadreId} excluirId={editandoId ?? undefined} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Color (opcional, para el POS)</label>
            <Select value={color} onChange={(e) => setColor(e.target.value as ColorCategoria | '')}>
              <option value="">Sin color</option>
              {COLORES_CATEGORIA.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_COLOR_CATEGORIA[c]}
                </option>
              ))}
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={guardar.isPending} className="flex-1">
              {guardar.isPending ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
            {editandoId && (
              <Button type="button" variante="secundario" onClick={limpiar}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Categorías">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {plano.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    {c.color && <span className={`h-2.5 w-2.5 rounded-full ${CLASE_PUNTO_COLOR_CATEGORIA[c.color]}`} />}
                    {'— '.repeat(c.profundidad)}
                    {c.nombre}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <Badge tono={c.activa ? 'exito' : 'neutro'}>{c.activa ? 'Activa' : 'Inactiva'}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => editar(c)} className="text-xs text-sol-600 hover:underline dark:text-sol-400">
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar.mutate(c.id)}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {plano.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-slate-400">
                  Sin categorías todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
