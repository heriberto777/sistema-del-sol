import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { ConfirmModal } from '../components/molecules/ConfirmModal/ConfirmModal';
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
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [cuentaADesactivar, setCuentaADesactivar] = useState<CuentaBancaria | null>(null);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Bancos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cuentas bancarias del tenant, usadas para pagos y gastos menores.</p>
        </div>
        {tienePermiso('bancos.editar') && <Button onClick={() => navigate('/bancos/nuevo')}>Nueva cuenta bancaria</Button>}
      </div>

      <RequierePermiso permiso="bancos.ver">
        {data?.datos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no hay cuentas bancarias"
            descripcion="Creá la primera para poder registrar gastos menores desde ahí."
            etiquetaAccion="Nueva cuenta bancaria"
            onAccion={() => navigate('/bancos/nuevo')}
          />
        ) : (
          <Card
            sinPadding
            titulo="Cuentas bancarias"
            descripcion={data ? `${data.total} cuenta(s)` : undefined}
            acciones={
              <SearchInput
                value={busqueda}
                onChange={(v) => {
                  setBusqueda(v);
                  setPagina(1);
                }}
                placeholder="Buscar por banco o número de cuenta…"
              />
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Banco</th>
                    <th className="px-5 py-3 font-medium">Número de cuenta</th>
                    <th className="px-5 py-3 font-medium">Tipo</th>
                    <th className="px-5 py-3 font-medium">Cuenta contable</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.datos.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">{c.banco}</td>
                      <td className="px-5 py-3 font-mono text-xs">{c.numeroCuenta}</td>
                      <td className="px-5 py-3">{c.tipoCuenta === 'CORRIENTE' ? 'Corriente' : 'Ahorros'}</td>
                      <td className="px-5 py-3">
                        {c.cuentaContable.codigo} — {c.cuentaContable.nombre}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {tienePermiso('bancos.editar') && (
                          <RowActionsMenu
                            acciones={[
                              { etiqueta: 'Editar', onClick: () => navigate(`/bancos/${c.id}`) },
                              {
                                etiqueta: 'Desactivar',
                                tono: 'peligro',
                                onClick: () => setCuentaADesactivar(c),
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
            {data && (
              <div className="px-5 py-3">
                <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
              </div>
            )}
          </Card>
        )}
      </RequierePermiso>

      {cuentaADesactivar && (
        <ConfirmModal
          titulo="¿Desactivar esta cuenta?"
          descripcion={
            <>
              Se desactivará la cuenta <b>{cuentaADesactivar.banco} — {cuentaADesactivar.numeroCuenta}</b>.
            </>
          }
          confirmarTexto="Desactivar"
          confirmando={desactivar.isPending}
          onConfirmar={() => {
            desactivar.mutate(cuentaADesactivar.id);
            setCuentaADesactivar(null);
          }}
          onCancelar={() => setCuentaADesactivar(null)}
        />
      )}
    </div>
  );
}

