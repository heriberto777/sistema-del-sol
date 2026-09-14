import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { Modal } from '../../molecules/Modal/Modal';
import { CategoriaIncentivo } from '../../../types/tareas-personales';

/**
 * Renglones de incentivo (CIGUAS APPS, Backups, ITT, ...) — catálogo por
 * tenant, sin permisos propios (mismo criterio que "Mis Tareas", del que
 * depende). Edición inline en la tabla, mismo patrón que el título de
 * TareaPersonalModal (onBlur guarda si cambió).
 */
export function CategoriasIncentivoModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [pesoNuevo, setPesoNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: categorias, isLoading } = useQuery({
    queryKey: ['categorias-incentivo'],
    queryFn: async () => (await apiClient.get<CategoriaIncentivo[]>('/admin/categorias-incentivo')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['categorias-incentivo'] });
  }

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/admin/categorias-incentivo', { nombre: nombreNuevo.trim(), peso: Number(pesoNuevo) }),
    onSuccess: () => {
      setNombreNuevo('');
      setPesoNuevo('');
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la categoría.')),
  });

  const actualizar = useMutation({
    // `peso` acá es number (lo que espera el PATCH) — distinto del `CategoriaIncentivo.peso: string` que ya llega serializado para lectura.
    mutationFn: async ({ id, ...dto }: { id: string; nombre?: string; peso?: number; activa?: boolean }) =>
      apiClient.patch(`/admin/categorias-incentivo/${id}`, dto),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo actualizar la categoría.')),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/categorias-incentivo/${id}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar la categoría — probá quitarla de las tareas que la usan primero si el error persiste.')),
  });

  function onCrear(e: FormEvent) {
    e.preventDefault();
    if (nombreNuevo.trim() && pesoNuevo) crear.mutate();
  }

  const lista = categorias ?? [];
  const totalActivo = lista.filter((c) => c.activa).reduce((acc, c) => acc + Number(c.peso), 0);

  return (
    <Modal titulo="Categorías de incentivo" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Renglones para medir cumplimiento de incentivo — el peso es el valor en $ de cada uno. "Sin incentivo" no es una fila acá, es simplemente no elegir ninguna al crear/editar una tarea.
        </p>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}

        {!isLoading && (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Renglón</th>
                  <th className="px-3 py-2 text-right">Peso ($)</th>
                  <th className="px-3 py-2 text-center">Activa</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2">
                      <input
                        defaultValue={c.nombre}
                        onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.nombre && actualizar.mutate({ id: c.id, nombre: e.target.value.trim() })}
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-slate-800 hover:border-slate-200 focus:border-sol-400 focus:outline-none dark:text-slate-100 dark:hover:border-slate-700"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={c.peso}
                        onBlur={(e) => Number(e.target.value) !== Number(c.peso) && e.target.value !== '' && actualizar.mutate({ id: c.id, peso: Number(e.target.value) })}
                        className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-slate-800 hover:border-slate-200 focus:border-sol-400 focus:outline-none dark:text-slate-100 dark:hover:border-slate-700"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={c.activa}
                        onChange={(e) => actualizar.mutate({ id: c.id, activa: e.target.checked })}
                        aria-label={`${c.activa ? 'Desactivar' : 'Activar'} ${c.nombre}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => eliminar.mutate(c.id)} className="text-slate-400 hover:text-red-600" aria-label={`Eliminar ${c.nombre}`}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-slate-400">
                      Sin categorías todavía — agregá la primera abajo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
          <span>Total activo</span>
          <span>${totalActivo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
        </div>

        <form onSubmit={onCrear} className="flex gap-2">
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Nombre del renglón nuevo…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={pesoNuevo}
            onChange={(e) => setPesoNuevo(e.target.value)}
            placeholder="Peso $"
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <Button type="submit" disabled={!nombreNuevo.trim() || !pesoNuevo || crear.isPending}>
            + Agregar
          </Button>
        </form>
      </div>
    </Modal>
  );
}
