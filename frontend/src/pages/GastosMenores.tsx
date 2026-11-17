import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Modal } from '../components/molecules/Modal/Modal';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { ImportarGastosMenoresModal } from '../components/organisms/ImportarGastosMenoresModal/ImportarGastosMenoresModal';
import { useAuth } from '../hooks/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface CuentaBancaria {
  id: string;
  banco: string;
  numeroCuenta: string;
}

interface ProyectoOpcion {
  id: string;
  nombre: string;
}

interface GastoMenor {
  id: string;
  ncf: string | null;
  fecha: string;
  notas: string | null;
  monto: string;
  itbis: string;
  total: string;
  cuentaBancaria: CuentaBancaria;
  proyecto: ProyectoOpcion | null;
}

/**
 * Auditoría UX (post Período Contable, 2026-11) — "Nuevo gasto menor" y
 * "Ver detalle" pasaron de modal a página real
 * (`GastoMenorNuevo`/`GastoMenorVer`), mismo criterio que Asiento
 * Contable.
 */
export function GastosMenores() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data } = useQuery({
    queryKey: ['gastos-menores', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<GastoMenor>>('/gastos-menores', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Gastos menores</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Registrá tus gastos menores para deducir los pagos y compras que realices en el mercado informal.
          </p>
        </div>
        {tienePermiso('gastosmenores.crear') && (
          <div className="flex gap-2">
            <Button variante="secundario" onClick={() => setModalImportarAbierto(true)}>
              Importar Excel
            </Button>
            <Button onClick={() => navigate('/gastos-menores/nuevo')}>Nuevo gasto menor</Button>
          </div>
        )}
      </div>

      <RequierePermiso permiso="gastosmenores.ver">
        {data?.datos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no has registrado gastos menores"
            descripcion="Registrá el primero para llevar el control de tus compras informales."
            etiquetaAccion="Nuevo gasto menor"
            onAccion={() => navigate('/gastos-menores/nuevo')}
          />
        ) : (
          <Card
            sinPadding
            titulo="Gastos menores"
            descripcion={data ? `${data.total} gasto(s)` : undefined}
            acciones={
              <SearchInput
                value={busqueda}
                onChange={(v) => {
                  setBusqueda(v);
                  setPagina(1);
                }}
                placeholder="Buscar por NCF o notas…"
              />
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">NCF/Número</th>
                    <th className="px-5 py-3 font-medium">Notas</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Cuenta</th>
                    <th className="px-5 py-3 font-medium">Proyecto</th>
                    <th className="px-5 py-3 font-medium">Monto</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.datos.map((g) => (
                    <tr key={g.id} onClick={() => navigate(`/gastos-menores/${g.id}`)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono text-xs">{g.ncf ?? '—'}</td>
                      <td className="px-5 py-3">{g.notas ?? '—'}</td>
                      <td className="px-5 py-3">{new Date(g.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3">
                        {g.cuentaBancaria.banco} — {g.cuentaBancaria.numeroCuenta}
                      </td>
                      <td className="px-5 py-3">{g.proyecto?.nombre ?? '—'}</td>
                      <td className="px-5 py-3">RD$ {Number(g.total).toLocaleString('es-DO')}</td>
                      <td className="px-5 py-3 text-right">
                        <Button variante="secundario" onClick={(e) => { e.stopPropagation(); navigate(`/gastos-menores/${g.id}`); }}>
                          Ver detalle
                        </Button>
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

      {modalImportarAbierto && (
        <Modal titulo="Importar gastos menores" ancho="xl" onClose={() => setModalImportarAbierto(false)}>
          <ImportarGastosMenoresModal onImportado={() => queryClient.invalidateQueries({ queryKey: ['gastos-menores'] })} />
        </Modal>
      )}
    </div>
  );
}
