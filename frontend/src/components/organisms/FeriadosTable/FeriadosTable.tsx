import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { useAuth } from '../../../hooks/useAuth';

interface Feriado {
  id: string;
  nombre: string;
  fecha: string;
  recurrenteAnual: boolean;
  activo: boolean;
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-DO', { timeZone: 'UTC' });
}

/** Calendario de feriados por tenant (plan de integración Cuadre, ítem G-5) — catálogo puro, sin efecto automático en tardanza/horas extra/nómina todavía. */
export function FeriadosTable() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState('');
  const [recurrenteAnual, setRecurrenteAnual] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: feriados } = useQuery({
    queryKey: ['rrhh-feriados'],
    queryFn: async () => (await apiClient.get<Feriado[]>('/nomina/feriados')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['rrhh-feriados'] });
  }

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/nomina/feriados', { nombre, fecha, recurrenteAnual }),
    onSuccess: () => {
      invalidar();
      setNombre('');
      setFecha('');
      setRecurrenteAnual(true);
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el feriado.')),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => apiClient.patch(`/nomina/feriados/${id}`, { activo }),
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/nomina/feriados/${id}`),
    onSuccess: invalidar,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  const puedeEditar = tienePermiso('rrhh.editar');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {puedeEditar && (
        <Card titulo="Nuevo feriado">
          <form onSubmit={onSubmit} className="space-y-3">
            <FormField id="feriado-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            <FormField id="feriado-fecha" label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={recurrenteAnual} onChange={(e) => setRecurrenteAnual(e.target.checked)} />
              Se repite cada año
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={crear.isPending} className="w-full">
              {crear.isPending ? 'Creando…' : 'Crear feriado'}
            </Button>
          </form>
        </Card>
      )}

      <Card sinPadding className={puedeEditar ? 'lg:col-span-2 overflow-x-auto' : 'lg:col-span-3 overflow-x-auto'} titulo="Feriados">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Fecha</th>
              <th className="px-5 py-3 font-medium">Recurrente</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {feriados?.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3">{f.nombre}</td>
                <td className="px-5 py-3">{formatearFecha(f.fecha)}</td>
                <td className="px-5 py-3">{f.recurrenteAnual ? 'Cada año' : 'Fecha puntual'}</td>
                <td className="px-5 py-3">
                  <Badge tono={f.activo ? 'exito' : 'neutro'}>{f.activo ? 'Activo' : 'Inactivo'}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  {puedeEditar && (
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => actualizar.mutate({ id: f.id, activo: !f.activo })}
                        className="text-xs text-sol-600 hover:underline dark:text-sol-400"
                      >
                        {f.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminar.mutate(f.id)}
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {feriados?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                  Sin feriados registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
