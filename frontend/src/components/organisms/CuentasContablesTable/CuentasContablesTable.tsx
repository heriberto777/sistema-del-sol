import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
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
  const { tienePermiso } = useAuth();
  const [modalNuevaCuenta, setModalNuevaCuenta] = useState(false);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['contabilidad-cuentas'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-slate-900 dark:text-slate-100">Catálogo de cuentas</h2>
        {tienePermiso('contabilidad.editar') && <Button onClick={() => setModalNuevaCuenta(true)}>Nueva cuenta</Button>}
      </div>

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

      {modalNuevaCuenta && <ModalNuevaCuenta onClose={() => setModalNuevaCuenta(false)} />}
    </div>
  );
}

function ModalNuevaCuenta({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoCuenta>('GASTO');
  const [naturaleza, setNaturaleza] = useState<NaturalezaCuenta>('DEUDORA');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/contabilidad/cuentas', { codigo, nombre, tipo, naturaleza }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-cuentas'] });
      onClose();
    },
    onError: () => setError('No se pudo crear la cuenta — revisá que el código no esté repetido.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva cuenta contable" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="cuenta-codigo" label="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
        <FormField id="cuenta-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCuenta)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="DEUDORA">Deudora</option>
            <option value="ACREEDORA">Acreedora</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Agregar cuenta'}
        </Button>
      </form>
    </Modal>
  );
}
