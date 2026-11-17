import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { type PlantillaHorario } from '../../../hooks/usePlantillasHorario';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';

/** Plantillas de horario reutilizables (plan de integración Cuadre, ítem G-1) — referencia viva: editar los días (página PlantillaHorarioDias) cambia el horario efectivo de TODOS los empleados que la tengan asignada. */
export function PlantillasHorarioPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [predeterminada, setPredeterminada] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: plantillas } = useQuery({
    queryKey: ['admin-plantillas-horario'],
    queryFn: async () => (await apiClient.get<PlantillaHorario[]>('/nomina/plantillas-horario')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['admin-plantillas-horario'] });
    queryClient.invalidateQueries({ queryKey: ['plantillas-horario-activas'] });
  }

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/nomina/plantillas-horario', { codigo, nombre, descripcion: descripcion || undefined, predeterminada }),
    onSuccess: () => {
      invalidar();
      setCodigo('');
      setNombre('');
      setDescripcion('');
      setPredeterminada(false);
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la plantilla (¿ya existe una con ese código?).')),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => apiClient.patch(`/nomina/plantillas-horario/${id}`, { activa }),
    onSuccess: invalidar,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Nueva plantilla">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField id="plantilla-codigo" label="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
          <FormField id="plantilla-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <FormField
            id="plantilla-descripcion"
            label="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={predeterminada} onChange={(e) => setPredeterminada(e.target.checked)} />
            Predeterminada para nuevos empleados
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Como mucho una plantilla puede ser predeterminada — marcar esta desmarca automáticamente cualquier otra.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear plantilla'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Plantillas de horario">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Código</th>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Predeterminada</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {plantillas?.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{p.codigo}</td>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{p.nombre}</td>
                <td className="px-5 py-3">{p.predeterminada && <Badge tono="exito">Predeterminada</Badge>}</td>
                <td className="px-5 py-3">
                  <Badge tono={p.activa ? 'exito' : 'neutro'}>{p.activa ? 'Activa' : 'Inactiva'}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/plantillas-horario/${p.id}/dias`)}
                      className="text-xs text-sol-600 hover:underline dark:text-sol-400"
                    >
                      Editar días
                    </button>
                    <button
                      type="button"
                      onClick={() => actualizar.mutate({ id: p.id, activa: !p.activa })}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      {p.activa ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {plantillas?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                  Sin plantillas de horario todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

    </div>
  );
}
