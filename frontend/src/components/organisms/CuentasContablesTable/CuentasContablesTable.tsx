import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../../molecules/FormField/FormField';
import { useAuth } from '../../../hooks/useAuth';

type TipoCuenta = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO';
type NaturalezaCuenta = 'DEUDORA' | 'ACREEDORA';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  naturaleza: NaturalezaCuenta;
  activa: boolean;
}

const TONO_POR_TIPO: Record<TipoCuenta, 'neutro' | 'exito' | 'advertencia' | 'peligro'> = {
  ACTIVO: 'exito',
  PASIVO: 'peligro',
  PATRIMONIO: 'advertencia',
  INGRESO: 'exito',
  GASTO: 'peligro',
};

export function CuentasContablesTable() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoCuenta>('GASTO');
  const [naturaleza, setNaturaleza] = useState<NaturalezaCuenta>('DEUDORA');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['contabilidad-cuentas'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/contabilidad/cuentas', { codigo, nombre, tipo, naturaleza }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-cuentas'] });
      setCodigo('');
      setNombre('');
      setError(null);
    },
    onError: () => setError('No se pudo crear la cuenta — revisá que el código no esté repetido.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <div className="space-y-4">
      {tienePermiso('contabilidad.editar') && (
      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <FormField id="cuenta-codigo" label="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} required className="w-28" />
        <FormField id="cuenta-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-56" />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCuenta)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="ACTIVO">Activo</option>
            <option value="PASIVO">Pasivo</option>
            <option value="PATRIMONIO">Patrimonio</option>
            <option value="INGRESO">Ingreso</option>
            <option value="GASTO">Gasto</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Naturaleza</label>
          <select
            value={naturaleza}
            onChange={(e) => setNaturaleza(e.target.value as NaturalezaCuenta)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="DEUDORA">Deudora</option>
            <option value="ACREEDORA">Acreedora</option>
          </select>
        </div>
        <Button type="submit" disabled={crear.isPending}>
          {crear.isPending ? 'Creando…' : 'Agregar cuenta'}
        </Button>
      </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-slate-500">Cargando catálogo de cuentas…</p>}
      {errorCarga && <p className="text-sm text-red-600">No se pudo cargar el catálogo de cuentas.</p>}

      {data && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Naturaleza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((cuenta) => (
                <tr key={cuenta.id}>
                  <td className="px-4 py-2 font-mono text-xs">{cuenta.codigo}</td>
                  <td className="px-4 py-2">{cuenta.nombre}</td>
                  <td className="px-4 py-2">
                    <Badge tono={TONO_POR_TIPO[cuenta.tipo]}>{cuenta.tipo}</Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{cuenta.naturaleza}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
