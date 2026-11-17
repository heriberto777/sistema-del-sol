import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import type { Cliente } from '../components/molecules/FormularioCliente/FormularioCliente';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

export function Clientes() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Clientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Clientes a los que facturás.</p>
        </div>
        <Button onClick={() => navigate('/clientes/nuevo')}>Nuevo contacto</Button>
      </div>

      <RequierePermiso permiso="clientes.ver">
        <ListaClientes
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          pagina={pagina}
          setPagina={setPagina}
          busquedaDebounced={busquedaDebounced}
          onVer={(c) => navigate(`/clientes/${c.id}`)}
          onEditar={(c) => navigate(`/clientes/${c.id}/editar`)}
          onNuevo={() => navigate('/clientes/nuevo')}
        />
      </RequierePermiso>
    </div>
  );
}

interface ListaProps<T> {
  busqueda: string;
  setBusqueda: (v: string) => void;
  pagina: number;
  setPagina: (v: number) => void;
  busquedaDebounced: string;
  onVer: (item: T) => void;
  onEditar: (item: T) => void;
  onNuevo: () => void;
}

function ListaClientes({ busqueda, setBusqueda, pagina, setPagina, busquedaDebounced, onVer, onEditar, onNuevo }: ListaProps<Cliente>) {
  const { data } = useQuery({
    queryKey: ['clientes', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Cliente>>('/clientes', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      {data?.datos.length === 0 ? (
        <>
          <SearchInput
            value={busqueda}
            onChange={(v) => {
              setBusqueda(v);
              setPagina(1);
            }}
            placeholder="Buscar por nombre, email o RNC/cédula…"
          />
          <EstadoVacio
            titulo="Todavía no hay clientes"
            descripcion="Creá el primero para empezar a facturarle."
            etiquetaAccion="Nuevo contacto"
            onAccion={onNuevo}
          />
        </>
      ) : (
        <Card
          sinPadding
          titulo="Clientes"
          descripcion={data ? `${data.total} cliente(s)` : undefined}
          acciones={
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por nombre, email o RNC/cédula…"
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">RNC/Cédula</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Teléfono</th>
                  <th className="px-5 py-3 font-medium">Puntos</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.datos.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{cliente.nombre}</td>
                    <td className="px-5 py-3">{cliente.rncCedula ?? '—'}</td>
                    <td className="px-5 py-3">{cliente.email ?? '—'}</td>
                    <td className="px-5 py-3">{cliente.telefono ?? '—'}</td>
                    <td className="px-5 py-3">{cliente.puntosLealtad}</td>
                    <td className="px-5 py-3 text-right">
                      <RowActionsMenu
                        acciones={[
                          { etiqueta: 'Ver', onClick: () => onVer(cliente) },
                          { etiqueta: 'Editar', onClick: () => onEditar(cliente) },
                        ]}
                      />
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
    </div>
  );
}
