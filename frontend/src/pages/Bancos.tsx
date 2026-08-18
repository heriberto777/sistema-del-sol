import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

interface CuentaBancaria {
  id: string;
  banco: string;
  numeroCuenta: string;
  tipoCuenta: 'CORRIENTE' | 'AHORROS';
  cuentaContable: CuentaContable;
}

export function Bancos() {
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cuentaEditando, setCuentaEditando] = useState<CuentaBancaria | null>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['bancos', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<CuentaBancaria>>('/bancos', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  const desactivar = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/bancos/${id}`, { activa: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bancos'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Bancos</h1>
        {tienePermiso('bancos.editar') && <Button onClick={() => setModalAbierto(true)}>Nueva cuenta bancaria</Button>}
      </div>

      <RequierePermiso permiso="bancos.ver">
        <SearchInput
          value={busqueda}
          onChange={(v) => {
            setBusqueda(v);
            setPagina(1);
          }}
          placeholder="Buscar por banco o número de cuenta…"
        />
        {data?.datos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no hay cuentas bancarias"
            descripcion="Creá la primera para poder registrar gastos menores desde ahí."
            etiquetaAccion="Nueva cuenta bancaria"
            onAccion={() => setModalAbierto(true)}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Banco</th>
                  <th className="px-4 py-2">Número de cuenta</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Cuenta contable</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.datos.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2">{c.banco}</td>
                    <td className="px-4 py-2 font-mono text-xs">{c.numeroCuenta}</td>
                    <td className="px-4 py-2">{c.tipoCuenta === 'CORRIENTE' ? 'Corriente' : 'Ahorros'}</td>
                    <td className="px-4 py-2">
                      {c.cuentaContable.codigo} — {c.cuentaContable.nombre}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {tienePermiso('bancos.editar') && (
                        <RowActionsMenu
                          acciones={[
                            { etiqueta: 'Editar', onClick: () => setCuentaEditando(c) },
                            {
                              etiqueta: 'Desactivar',
                              tono: 'peligro',
                              onClick: () => {
                                if (window.confirm(`¿Desactivar la cuenta ${c.banco} — ${c.numeroCuenta}?`)) {
                                  desactivar.mutate(c.id);
                                }
                              },
                            },
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
        )}
      </RequierePermiso>

      {modalAbierto && (
        <Modal titulo="Nueva cuenta bancaria" onClose={() => setModalAbierto(false)}>
          <FormularioCuentaBancaria onGuardado={() => setModalAbierto(false)} />
        </Modal>
      )}
      {cuentaEditando && (
        <Modal titulo={`Editar cuenta — ${cuentaEditando.banco}`} onClose={() => setCuentaEditando(null)}>
          <FormularioCuentaBancaria cuenta={cuentaEditando} onGuardado={() => setCuentaEditando(null)} />
        </Modal>
      )}
    </div>
  );
}

function FormularioCuentaBancaria({ cuenta, onGuardado }: { cuenta?: CuentaBancaria; onGuardado: () => void }) {
  const queryClient = useQueryClient();
  const [banco, setBanco] = useState(cuenta?.banco ?? '');
  const [numeroCuenta, setNumeroCuenta] = useState(cuenta?.numeroCuenta ?? '');
  const [tipoCuenta, setTipoCuenta] = useState<'CORRIENTE' | 'AHORROS'>(cuenta?.tipoCuenta ?? 'CORRIENTE');
  const [cuentaContableId, setCuentaContableId] = useState(cuenta?.cuentaContable.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad-cuentas-activo'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });
  const cuentasActivo = (cuentas ?? []).filter((c) => c.tipo === 'ACTIVO');

  const guardar = useMutation({
    mutationFn: async () => {
      const datos = { banco, numeroCuenta, tipoCuenta, cuentaContableId };
      return cuenta ? apiClient.patch(`/bancos/${cuenta.id}`, datos) : apiClient.post('/bancos', datos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      onGuardado();
    },
    onError: () => setError('No se pudo guardar la cuenta bancaria. Revisa los datos.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormField id="banco-nombre" label="Banco" value={banco} onChange={(e) => setBanco(e.target.value)} required />
      <FormField
        id="banco-numero"
        label="Número de cuenta"
        value={numeroCuenta}
        onChange={(e) => setNumeroCuenta(e.target.value)}
        required
      />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de cuenta</label>
        <Select value={tipoCuenta} onChange={(e) => setTipoCuenta(e.target.value as 'CORRIENTE' | 'AHORROS')}>
          <option value="CORRIENTE">Corriente</option>
          <option value="AHORROS">Ahorros</option>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta contable</label>
        <Select value={cuentaContableId} onChange={(e) => setCuentaContableId(e.target.value)} required>
          <option value="">Seleccionar…</option>
          {cuentasActivo.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo} — {c.nombre}
            </option>
          ))}
        </Select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={guardar.isPending} className="w-full">
        {guardar.isPending ? 'Guardando…' : cuenta ? 'Guardar cambios' : 'Guardar'}
      </Button>
    </form>
  );
}
