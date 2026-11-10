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
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';
import type { Proveedor } from './ProveedorFormulario';

export type { Proveedor };

export function Proveedores() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Proveedores</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Proveedores a los que les comprás.</p>
        </div>
        <Button onClick={() => navigate('/proveedores/nuevo')}>Nuevo contacto</Button>
      </div>

      <RequierePermiso permiso="compras.ver">
        <ListaProveedores
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          pagina={pagina}
          setPagina={setPagina}
          busquedaDebounced={busquedaDebounced}
          onVer={(p) => navigate(`/proveedores/${p.id}`)}
          onEditar={(p) => navigate(`/proveedores/${p.id}/editar`)}
          onNuevo={() => navigate('/proveedores/nuevo')}
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

function ListaProveedores({ busqueda, setBusqueda, pagina, setPagina, busquedaDebounced, onVer, onEditar, onNuevo }: ListaProps<Proveedor>) {
  const { data } = useQuery({
    queryKey: ['proveedores', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Proveedor>>('/proveedores', {
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
            placeholder="Buscar por nombre o RNC…"
          />
          <EstadoVacio
            titulo="Todavía no hay proveedores"
            descripcion="Creá el primero para poder registrar órdenes de compra."
            etiquetaAccion="Nuevo contacto"
            onAccion={onNuevo}
          />
        </>
      ) : (
        <Card
          sinPadding
          titulo="Proveedores"
          descripcion={data ? `${data.total} proveedor(es)` : undefined}
          acciones={
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por nombre o RNC…"
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">RNC</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Teléfono</th>
                  <th className="px-5 py-3 font-medium">Categoría</th>
                  <th className="px-5 py-3 font-medium">Plazo de pago</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.datos.map((proveedor) => (
                  <tr key={proveedor.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{proveedor.nombre}</td>
                    <td className="px-5 py-3">{proveedor.rnc ?? '—'}</td>
                    <td className="px-5 py-3">{proveedor.email ?? '—'}</td>
                    <td className="px-5 py-3">{proveedor.telefono ?? '—'}</td>
                    <td className="px-5 py-3">{proveedor.categoria?.nombre ?? '—'}</td>
                    <td className="px-5 py-3">{proveedor.plazoPagoDias} días</td>
                    <td className="px-5 py-3 text-right">
                      <RowActionsMenu
                        acciones={[
                          { etiqueta: 'Ver', onClick: () => onVer(proveedor) },
                          { etiqueta: 'Editar', onClick: () => onEditar(proveedor) },
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

