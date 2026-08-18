import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Empleado {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
  salarioBrutoMensual: string;
  activo: boolean;
  fechaIngreso: string;
}

export function EmpleadosTable() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [modalNuevoEmpleado, setModalNuevoEmpleado] = useState(false);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['nomina-empleados', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Empleado>>('/nomina/empleados', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  const desactivar = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/nomina/empleados/${id}`, { fechaSalida: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nomina-empleados'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-slate-900 dark:text-slate-100">Empleados</h2>
        {tienePermiso('nomina.editar') && <Button onClick={() => setModalNuevoEmpleado(true)}>Nuevo empleado</Button>}
      </div>

      <SearchInput
        value={busqueda}
        onChange={(v) => {
          setBusqueda(v);
          setPagina(1);
        }}
        placeholder="Buscar por nombre, cédula o cargo…"
      />

      {isLoading && <p className="text-sm text-slate-500">Cargando empleados…</p>}
      {errorCarga && <p className="text-sm text-red-600">No se pudieron cargar los empleados.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Cédula</th>
                  <th className="px-4 py-2">Cargo</th>
                  <th className="px-4 py-2">Salario bruto</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.datos.map((empleado) => (
                  <tr key={empleado.id}>
                    <td className="px-4 py-2">{empleado.nombre}</td>
                    <td className="px-4 py-2 font-mono text-xs">{empleado.cedula}</td>
                    <td className="px-4 py-2">{empleado.cargo}</td>
                    <td className="px-4 py-2">RD$ {Number(empleado.salarioBrutoMensual).toLocaleString('es-DO')}</td>
                    <td className="px-4 py-2">
                      <Badge tono={empleado.activo ? 'exito' : 'neutro'}>{empleado.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      {empleado.activo && tienePermiso('nomina.editar') && (
                        <Button variante="peligro" onClick={() => desactivar.mutate(empleado.id)} disabled={desactivar.isPending}>
                          Desactivar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
        </>
      )}

      {modalNuevoEmpleado && <ModalNuevoEmpleado onClose={() => setModalNuevoEmpleado(false)} />}
    </div>
  );
}

function ModalNuevoEmpleado({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [cargo, setCargo] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [salarioBrutoMensual, setSalarioBrutoMensual] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/nomina/empleados', {
        nombre,
        cedula,
        cargo,
        fechaIngreso,
        salarioBrutoMensual: Number(salarioBrutoMensual),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nomina-empleados'] });
      onClose();
    },
    onError: () => setError('No se pudo crear el empleado — revisá que la cédula no esté repetida.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  return (
    <Modal titulo="Nuevo empleado" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="empleado-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <FormField id="empleado-cedula" label="Cédula" value={cedula} onChange={(e) => setCedula(e.target.value)} required />
        <FormField id="empleado-cargo" label="Cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} required />
        <FormField
          id="empleado-fecha-ingreso"
          label="Fecha de ingreso"
          type="date"
          value={fechaIngreso}
          onChange={(e) => setFechaIngreso(e.target.value)}
          required
        />
        <FormField
          id="empleado-salario"
          label="Salario bruto mensual"
          type="number"
          min={0}
          step="any"
          value={salarioBrutoMensual}
          onChange={(e) => setSalarioBrutoMensual(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Agregar empleado'}
        </Button>
      </form>
    </Modal>
  );
}
