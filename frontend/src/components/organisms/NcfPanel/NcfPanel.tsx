import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';

interface NcfAsignado {
  tipoNcf: string;
  secuenciaActual: number;
  secuenciaFinal: number;
  vigenciaHasta: string;
  activo: boolean;
}

// e-CF (E3x): mismo ambiente de numeración que B0x, ver docs/ARCHITECTURE.md
// ("e-NCF propio") — la firma/envío a la DGII todavía no está implementada.
const TIPOS_NCF = ['B01', 'B02', 'B03', 'B04', 'B14', 'B15', 'E31', 'E32', 'E33', 'E34'];

export function NcfPanel() {
  const queryClient = useQueryClient();
  const [tipoNcf, setTipoNcf] = useState('B02');
  const [secuenciaFinal, setSecuenciaFinal] = useState('');
  const [vigenciaHasta, setVigenciaHasta] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: secuencias } = useQuery({
    queryKey: ['admin-ncf'],
    queryFn: async () => (await apiClient.get<NcfAsignado[]>('/admin/ncf')).data,
  });

  const { data: modalidad } = useQuery({
    queryKey: ['admin-ncf-modalidad'],
    queryFn: async () => (await apiClient.get<'NCF' | 'ECF'>('/admin/ncf/modalidad')).data,
  });

  const cambiarModalidad = useMutation({
    mutationFn: async (nueva: 'NCF' | 'ECF') => apiClient.patch('/admin/ncf/modalidad', { modalidad: nueva }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ncf-modalidad'] }),
  });

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/admin/ncf', { tipoNcf, secuenciaFinal: Number(secuenciaFinal), vigenciaHasta }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ncf'] });
      setSecuenciaFinal('');
      setVigenciaHasta('');
      setError(null);
    },
    onError: () => setError('No se pudo crear la secuencia (¿ya existe una para ese tipo?).'),
  });

  const desactivar = useMutation({
    mutationFn: async (tipo: string) => apiClient.patch(`/admin/ncf/${tipo}`, { activo: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ncf'] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-medium text-slate-900 dark:text-slate-100">Modalidad de facturación</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          NCF tradicional o e-CF (comprobante electrónico DGII). En modalidad e-CF, las facturas se numeran con
          secuencias E3x — la firma digital y el envío a la DGII todavía no están implementados (ver el panel de
          reportes fiscales para más detalle sobre esta brecha).
        </p>
        <div className="mt-3 flex gap-2">
          {(['NCF', 'ECF'] as const).map((opcion) => (
            <Button
              key={opcion}
              type="button"
              variante={modalidad === opcion ? 'primario' : 'secundario'}
              disabled={cambiarModalidad.isPending}
              onClick={() => cambiarModalidad.mutate(opcion)}
            >
              {opcion === 'NCF' ? 'NCF tradicional' : 'e-CF'}
            </Button>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-medium text-slate-900 dark:text-slate-100">Nueva secuencia de NCF</h2>
        <div>
          <label htmlFor="tipoNcf" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Tipo de NCF
          </label>
          <select
            id="tipoNcf"
            value={tipoNcf}
            onChange={(e) => setTipoNcf(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {TIPOS_NCF.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>
        <FormField
          id="secuenciaFinal"
          label="Secuencia final autorizada"
          type="number"
          value={secuenciaFinal}
          onChange={(e) => setSecuenciaFinal(e.target.value)}
          required
        />
        <FormField
          id="vigenciaHasta"
          label="Vigente hasta"
          type="date"
          value={vigenciaHasta}
          onChange={(e) => setVigenciaHasta(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear secuencia'}
        </Button>
      </form>

      <div className="lg:col-span-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Actual</th>
              <th className="px-4 py-2">Final</th>
              <th className="px-4 py-2">Vigente hasta</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {secuencias?.map((s) => (
              <tr key={s.tipoNcf}>
                <td className="px-4 py-2 font-mono text-xs">{s.tipoNcf}</td>
                <td className="px-4 py-2">{s.secuenciaActual}</td>
                <td className="px-4 py-2">{s.secuenciaFinal}</td>
                <td className="px-4 py-2">{new Date(s.vigenciaHasta).toLocaleDateString('es-DO')}</td>
                <td className="px-4 py-2">
                  <Badge tono={s.activo ? 'exito' : 'neutro'}>{s.activo ? 'Activa' : 'Inactiva'}</Badge>
                </td>
                <td className="px-4 py-2">
                  {s.activo && (
                    <Button variante="peligro" onClick={() => desactivar.mutate(s.tipoNcf)}>
                      Desactivar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
