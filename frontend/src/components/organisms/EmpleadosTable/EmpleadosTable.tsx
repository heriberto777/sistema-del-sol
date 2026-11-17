import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { SelectPuesto } from '../../molecules/SelectPuesto/SelectPuesto';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
}

interface Empleado {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
  puesto: { id: string; nombre: string } | null;
  plantillaHorario: { id: string; nombre: string } | null;
  salarioBrutoMensual: string;
  activo: boolean;
  fechaIngreso: string;
  user: Usuario | null;
}

export function EmpleadosTable() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [puestoFiltro, setPuestoFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['nomina-empleados', pagina, busquedaDebounced, puestoFiltro],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Empleado>>('/nomina/empleados', {
          params: { pagina, busqueda: busquedaDebounced || undefined, puestoId: puestoFiltro || undefined },
        })
      ).data,
  });

  const desactivar = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/nomina/empleados/${id}`, { fechaSalida: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nomina-empleados'] }),
  });

  return (
    <div className="space-y-4">
      {tienePermiso('nomina.editar') && (
        <div className="flex justify-end">
          <Button onClick={() => navigate('/nomina/empleados/nuevo')}>Nuevo empleado</Button>
        </div>
      )}

      <Card
        sinPadding
        titulo="Empleados"
        descripcion={data ? `${data.total} empleado(s)` : undefined}
        acciones={
          <div className="flex gap-2">
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por nombre, cédula o cargo…"
            />
            <div className="w-48">
              <SelectPuesto
                value={puestoFiltro}
                onChange={(id) => {
                  setPuestoFiltro(id);
                  setPagina(1);
                }}
                etiquetaVacio="Todos los puestos"
              />
            </div>
          </div>
        }
      >
        {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando empleados…</p>}
        {errorCarga && <p className="p-5 text-sm text-red-600">No se pudieron cargar los empleados.</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Cédula</th>
                  <th className="px-5 py-3 font-medium">Cargo</th>
                  <th className="px-5 py-3 font-medium">Puesto</th>
                  <th className="px-5 py-3 font-medium">Salario bruto</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.datos.map((empleado) => (
                  <tr key={empleado.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{empleado.nombre}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{empleado.cedula}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{empleado.cargo}</td>
                    <td className="px-5 py-3">{empleado.puesto?.nombre ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">RD$ {Number(empleado.salarioBrutoMensual).toLocaleString('es-DO')}</td>
                    <td className="px-5 py-3">
                      <Badge tono={empleado.activo ? 'exito' : 'neutro'}>{empleado.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      {tienePermiso('nomina.editar') && (
                        <div className="flex justify-end gap-2">
                          <Button variante="secundario" onClick={() => navigate(`/nomina/empleados/${empleado.id}`)}>
                            Editar
                          </Button>
                          {empleado.activo && (
                            <Button variante="peligro" onClick={() => desactivar.mutate(empleado.id)} disabled={desactivar.isPending}>
                              Desactivar
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>
    </div>
  );
}
