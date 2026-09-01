import { FormEvent, useEffect, useState } from 'react';
import { UseMutationResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApiClient } from '../../../lib/platform-api-client';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';

interface NcfPlataforma {
  id: string;
  tipoNcf: string;
  secuenciaActual: number;
  secuenciaFinal: number;
  vigenciaHasta: string;
  umbralAlerta: number | null;
  activo: boolean;
}

// La plataforma nunca emite Notas de Crédito/Débito ni Gastos Menores —
// solo Crédito Fiscal/Consumo, tradicional o electrónico.
const TIPOS_NCF = ['B01', 'B02', 'E31', 'E32'];

interface NcfPlataformaPanelProps {
  config: { general: { modalidadFacturacion: 'NCF' | 'ECF'; porcentajeItbis: number } };
  guardar: UseMutationResult<unknown, unknown, Record<string, unknown>>;
}

export function NcfPlataformaPanel({ config, guardar }: NcfPlataformaPanelProps) {
  const queryClient = useQueryClient();
  const [porcentajeItbis, setPorcentajeItbis] = useState(String(config.general.porcentajeItbis));
  useEffect(() => setPorcentajeItbis(String(config.general.porcentajeItbis)), [config.general.porcentajeItbis]);
  const [tipoNcf, setTipoNcf] = useState('B01');
  const [secuenciaFinal, setSecuenciaFinal] = useState('');
  const [vigenciaHasta, setVigenciaHasta] = useState('');
  const [umbralAlerta, setUmbralAlerta] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: secuencias } = useQuery({
    queryKey: ['platform-ncf'],
    queryFn: async () => (await platformApiClient.get<NcfPlataforma[]>('/platform/ncf')).data,
  });

  const crear = useMutation({
    mutationFn: async () =>
      platformApiClient.post('/platform/ncf', {
        tipoNcf,
        secuenciaFinal: Number(secuenciaFinal),
        vigenciaHasta,
        umbralAlerta: umbralAlerta ? Number(umbralAlerta) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-ncf'] });
      setSecuenciaFinal('');
      setVigenciaHasta('');
      setUmbralAlerta('');
      setError(null);
    },
    onError: () => setError('No se pudo crear la secuencia (¿ya existe una activa para ese tipo?).'),
  });

  const desactivar = useMutation({
    mutationFn: async (id: string) => platformApiClient.patch(`/platform/ncf/${id}`, { activo: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-ncf'] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  function onSubmitItbis(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({ porcentajeItbis: Number(porcentajeItbis) });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-3" titulo="ITBIS" descripcion="Se aplica sobre cada factura nueva (monto − descuento); la mora nunca lleva ITBIS. 0 = sin ITBIS.">
        <form onSubmit={onSubmitItbis} className="flex max-w-xs items-end gap-2">
          <FormField
            id="porcentajeItbis"
            label="Porcentaje de ITBIS"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={porcentajeItbis}
            onChange={(e) => setPorcentajeItbis(e.target.value)}
          />
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </Card>

      <Card className="lg:col-span-3" titulo="Modalidad de facturación de la plataforma">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          NCF tradicional o e-CF (comprobante electrónico DGII) para las facturas que la plataforma le cobra a cada
          tenant. En modalidad e-CF, las facturas se numeran con secuencias E3x — offline, igual que el NCF
          tradicional: la firma digital y el envío a la DGII todavía no están implementados.
        </p>
        <div className="mt-3 flex gap-2">
          {(['NCF', 'ECF'] as const).map((opcion) => (
            <Button
              key={opcion}
              type="button"
              variante={config.general.modalidadFacturacion === opcion ? 'primario' : 'secundario'}
              disabled={guardar.isPending}
              onClick={() => guardar.mutate({ modalidadFacturacion: opcion })}
            >
              {opcion === 'NCF' ? 'NCF tradicional' : 'e-CF'}
            </Button>
          ))}
        </div>
      </Card>

      <Card titulo="Nueva secuencia">
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label htmlFor="ncf-tipo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tipo de NCF
            </label>
            <select
              id="ncf-tipo"
              value={tipoNcf}
              onChange={(e) => setTipoNcf(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {TIPOS_NCF.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>
          <FormField
            id="ncf-secuencia-final"
            label="Secuencia final autorizada"
            type="number"
            value={secuenciaFinal}
            onChange={(e) => setSecuenciaFinal(e.target.value)}
            required
          />
          <FormField
            id="ncf-vigencia"
            label="Vigente hasta"
            type="date"
            value={vigenciaHasta}
            onChange={(e) => setVigenciaHasta(e.target.value)}
            required
          />
          <FormField
            id="ncf-umbral"
            label="Alertar cuando queden (opcional)"
            type="number"
            value={umbralAlerta}
            onChange={(e) => setUmbralAlerta(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear secuencia'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Secuencias">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Tipo</th>
              <th className="px-5 py-3 font-medium">Actual</th>
              <th className="px-5 py-3 font-medium">Final</th>
              <th className="px-5 py-3 font-medium">Vigente hasta</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {secuencias?.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3 font-mono text-xs">{s.tipoNcf}</td>
                <td className="px-5 py-3">{s.secuenciaActual}</td>
                <td className="px-5 py-3">{s.secuenciaFinal}</td>
                <td className="px-5 py-3">{new Date(s.vigenciaHasta).toLocaleDateString('es-DO')}</td>
                <td className="px-5 py-3">
                  <Badge tono={s.activo ? 'exito' : 'neutro'}>{s.activo ? 'Activa' : 'Inactiva'}</Badge>
                </td>
                <td className="px-5 py-3">
                  {s.activo && (
                    <Button variante="peligro" onClick={() => desactivar.mutate(s.id)}>
                      Desactivar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {secuencias?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                  Sin secuencias configuradas — las facturas de plataforma se generan sin NCF hasta que crees una.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
