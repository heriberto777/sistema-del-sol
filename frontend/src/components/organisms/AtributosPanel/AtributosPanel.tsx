import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

interface ValorAtributo {
  id: string;
  valor: string;
}

interface Atributo {
  id: string;
  nombre: string;
  valores: ValorAtributo[];
}

/** Catálogo de atributos ("Talla", "Color") y sus valores ("M", "Azul") — Fase 3c de adopción de Cuadre. Alimenta el armado de variantes en Productos.tsx. */
export function AtributosPanel() {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [valoresNuevos, setValoresNuevos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: atributos } = useQuery({
    queryKey: ['atributos'],
    queryFn: async () => (await apiClient.get<Atributo[]>('/atributos')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['atributos'] });
  }

  const crearAtributo = useMutation({
    mutationFn: async () => apiClient.post('/atributos', { nombre }),
    onSuccess: () => {
      invalidar();
      setNombre('');
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el atributo (¿ya existe uno con ese nombre?).')),
  });

  const crearValor = useMutation({
    mutationFn: async ({ atributoId, valor }: { atributoId: string; valor: string }) =>
      apiClient.post(`/atributos/${atributoId}/valores`, { valor }),
    onSuccess: (_res, { atributoId }) => {
      invalidar();
      setValoresNuevos((prev) => ({ ...prev, [atributoId]: '' }));
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo agregar el valor (¿ya existe en este atributo?).')),
  });

  const eliminarValor = useMutation({
    mutationFn: async ({ atributoId, valorId }: { atributoId: string; valorId: string }) =>
      apiClient.delete(`/atributos/${atributoId}/valores/${valorId}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar — revisá que no haya variantes usando este valor.')),
  });

  const eliminarAtributo = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/atributos/${id}`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar — revisá que ninguno de sus valores esté en uso.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crearAtributo.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Nuevo atributo">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField
            id="atributo-nombre"
            label="Nombre"
            placeholder="Talla, Color…"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crearAtributo.isPending} className="w-full">
            {crearAtributo.isPending ? 'Creando…' : 'Crear atributo'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2" titulo="Atributos">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {atributos?.map((atributo) => (
            <div key={atributo.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-slate-900 dark:text-slate-100">{atributo.nombre}</p>
                <button
                  type="button"
                  onClick={() => eliminarAtributo.mutate(atributo.id)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Eliminar atributo
                </button>
              </div>
              <div className="mb-2 flex flex-wrap gap-2">
                {atributo.valores.map((valor) => (
                  <span
                    key={valor.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-300"
                  >
                    {valor.valor}
                    <button
                      type="button"
                      onClick={() => eliminarValor.mutate({ atributoId: atributo.id, valorId: valor.id })}
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`Quitar ${valor.valor}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {atributo.valores.length === 0 && <span className="text-xs text-slate-400">Sin valores todavía.</span>}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  const valor = valoresNuevos[atributo.id]?.trim();
                  if (valor) crearValor.mutate({ atributoId: atributo.id, valor });
                }}
                className="flex gap-2"
              >
                <input
                  value={valoresNuevos[atributo.id] ?? ''}
                  onChange={(e) => setValoresNuevos((prev) => ({ ...prev, [atributo.id]: e.target.value }))}
                  placeholder="Nuevo valor (ej. M, Azul)"
                  className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <Button type="submit" variante="secundario" disabled={crearValor.isPending}>
                  Agregar
                </Button>
              </form>
            </div>
          ))}
          {atributos?.length === 0 && <p className="p-5 text-center text-sm text-slate-400">Sin atributos todavía.</p>}
        </div>
      </Card>
    </div>
  );
}
