import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';

interface RespuestaAsistente {
  respuesta: string;
  generadaConIa: boolean;
}

export function AsistenteWidget() {
  const [pregunta, setPregunta] = useState('');

  const preguntar = useMutation({
    mutationFn: async () => (await apiClient.post<RespuestaAsistente>('/ia/asistente', { pregunta })).data,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    preguntar.mutate();
  }

  return (
    <Card titulo="Asistente de negocio">
      <div className="space-y-3">
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <textarea
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="¿Cómo van las ventas de hoy?"
            required
            rows={2}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <Button type="submit" disabled={preguntar.isPending}>
            {preguntar.isPending ? 'Pensando…' : 'Preguntar'}
          </Button>
        </form>

        {preguntar.data && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">
            <p className="text-slate-800 dark:text-slate-200">{preguntar.data.respuesta}</p>
            {!preguntar.data.generadaConIa && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Modo básico: sin ANTHROPIC_API_KEY configurada, esto es el resumen numérico crudo, no una respuesta redactada.
              </p>
            )}
          </div>
        )}
        {preguntar.isError && <p className="text-sm text-red-600">No se pudo consultar al asistente.</p>}
      </div>
    </Card>
  );
}
