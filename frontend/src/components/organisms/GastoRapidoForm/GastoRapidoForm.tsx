import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO';
}

export function GastoRapidoForm() {
  const queryClient = useQueryClient();
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [cuentaGastoId, setCuentaGastoId] = useState('');
  const [cuentaOrigenId, setCuentaOrigenId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad-cuentas'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });

  const cuentasGasto = cuentas?.filter((c) => c.tipo === 'GASTO') ?? [];
  const cuentasOrigen = cuentas?.filter((c) => c.tipo === 'ACTIVO' || c.tipo === 'PASIVO') ?? [];

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/contabilidad/asientos/gastos', {
        concepto,
        monto: Number(monto),
        fecha: fecha || undefined,
        cuentaGastoId,
        cuentaOrigenId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-asientos'] });
      setConcepto('');
      setMonto('');
      setFecha('');
      setCuentaGastoId('');
      setCuentaOrigenId('');
      setError(null);
    },
    onError: () => setError('No se pudo registrar el gasto. Revisa los datos.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <FormField
        id="gasto-concepto"
        label="Concepto"
        value={concepto}
        onChange={(e) => setConcepto(e.target.value)}
        required
        className="w-56"
      />
      <FormField
        id="gasto-monto"
        label="Monto"
        type="number"
        min={0}
        step="0.01"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        required
        className="w-32"
      />
      <FormField id="gasto-fecha" label="Fecha (opcional)" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta de gasto</label>
        <Select value={cuentaGastoId} onChange={(e) => setCuentaGastoId(e.target.value)} required>
          <option value="">Seleccionar…</option>
          {cuentasGasto.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo} — {c.nombre}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">¿De dónde sale el dinero?</label>
        <Select value={cuentaOrigenId} onChange={(e) => setCuentaOrigenId(e.target.value)} required>
          <option value="">Seleccionar…</option>
          {cuentasOrigen.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo} — {c.nombre}
            </option>
          ))}
        </Select>
      </div>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={crear.isPending}>
        {crear.isPending ? 'Registrando…' : 'Registrar gasto'}
      </Button>
    </form>
  );
}
