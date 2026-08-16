import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Input } from '../../atoms/Input/Input';
import { Badge } from '../../atoms/Badge/Badge';

interface CuentaSugerida {
  codigo: string;
  nombre: string;
  fuente: 'IA' | 'HEURISTICA';
}

export function SugerirCuentaWidget() {
  const [concepto, setConcepto] = useState('');

  const sugerir = useMutation({
    mutationFn: async () => (await apiClient.post<CuentaSugerida | null>('/ia/sugerir-cuenta-contable', { concepto })).data,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    sugerir.mutate();
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-medium text-slate-900 dark:text-slate-100">Sugerir cuenta contable</h2>
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <Input
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Compra de papel higiénico para el baño"
          required
          className="flex-1"
        />
        <Button type="submit" disabled={sugerir.isPending}>
          {sugerir.isPending ? 'Buscando…' : 'Sugerir'}
        </Button>
      </form>

      {sugerir.isSuccess && (
        <div className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
          {sugerir.data ? (
            <p className="text-slate-800 dark:text-slate-200">
              {sugerir.data.codigo} — {sugerir.data.nombre}{' '}
              <Badge tono={sugerir.data.fuente === 'IA' ? 'exito' : 'neutro'}>{sugerir.data.fuente}</Badge>
            </p>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">No se encontró ninguna cuenta que coincida — asentalo manualmente.</p>
          )}
        </div>
      )}
      {sugerir.isError && <p className="text-sm text-red-600">No se pudo sugerir una cuenta.</p>}
    </div>
  );
}
