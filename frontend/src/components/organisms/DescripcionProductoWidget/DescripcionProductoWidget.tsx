import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';

interface DescripcionGenerada {
  descripcion: string;
  generadaConIa: boolean;
}

export function DescripcionProductoWidget() {
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');

  const generar = useMutation({
    mutationFn: async () =>
      (await apiClient.post<DescripcionGenerada>('/ia/generar-descripcion-producto', { nombre, categoria: categoria || undefined })).data,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    generar.mutate();
  }

  return (
    <Card titulo="Generar descripción de producto">
      <div className="space-y-3">
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
          <FormField id="ia-producto-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <FormField id="ia-producto-categoria" label="Categoría (opcional)" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          <Button type="submit" disabled={generar.isPending}>
            {generar.isPending ? 'Generando…' : 'Generar'}
          </Button>
        </form>

        {generar.data && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">
            <p className="text-slate-800 dark:text-slate-200">{generar.data.descripcion}</p>
            {!generar.data.generadaConIa && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Modo básico: sin ANTHROPIC_API_KEY configurada, esto no es una descripción redactada.
              </p>
            )}
          </div>
        )}
        {generar.isError && <p className="text-sm text-red-600">No se pudo generar la descripción.</p>}
      </div>
    </Card>
  );
}
