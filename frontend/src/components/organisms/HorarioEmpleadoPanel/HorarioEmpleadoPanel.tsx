import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { ComboboxBusqueda } from '../../molecules/ComboboxBusqueda/ComboboxBusqueda';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Empleado {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
  plantillaHorario: { id: string; nombre: string; codigo: string } | null;
}

interface FranjaHorario {
  diaSemana: DiaSemana;
  horaEntrada: string;
  horaSalida: string;
}

type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO' | 'DOMINGO';

const DIAS: { clave: DiaSemana; etiqueta: string }[] = [
  { clave: 'LUNES', etiqueta: 'Lunes' },
  { clave: 'MARTES', etiqueta: 'Martes' },
  { clave: 'MIERCOLES', etiqueta: 'Miércoles' },
  { clave: 'JUEVES', etiqueta: 'Jueves' },
  { clave: 'VIERNES', etiqueta: 'Viernes' },
  { clave: 'SABADO', etiqueta: 'Sábado' },
  { clave: 'DOMINGO', etiqueta: 'Domingo' },
];

type FilaDia = { trabaja: boolean; horaEntrada: string; horaSalida: string };
type EstadoForm = Record<DiaSemana, FilaDia>;

function estadoInicial(): EstadoForm {
  return Object.fromEntries(DIAS.map((d) => [d.clave, { trabaja: false, horaEntrada: '08:00', horaSalida: '17:00' }])) as EstadoForm;
}

export function HorarioEmpleadoPanel() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const puedeEditar = tienePermiso('rrhh.editar');
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [form, setForm] = useState<EstadoForm>(estadoInicial());
  const [error, setError] = useState<string | null>(null);

  const { data: horario, isLoading } = useQuery({
    queryKey: ['rrhh-horario', empleado?.id],
    queryFn: async () => (await apiClient.get<FranjaHorario[]>(`/nomina/empleados/${empleado!.id}/horario`)).data,
    enabled: !!empleado,
  });

  useEffect(() => {
    if (!empleado) {
      setForm(estadoInicial());
      return;
    }
    if (!horario) return;
    const base = estadoInicial();
    for (const franja of horario) {
      base[franja.diaSemana] = { trabaja: true, horaEntrada: franja.horaEntrada, horaSalida: franja.horaSalida };
    }
    setForm(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horario, empleado?.id]);

  const guardar = useMutation({
    mutationFn: async () => {
      const dias = DIAS.filter((d) => form[d.clave].trabaja).map((d) => ({
        diaSemana: d.clave,
        horaEntrada: form[d.clave].horaEntrada,
        horaSalida: form[d.clave].horaSalida,
      }));
      return apiClient.put(`/nomina/empleados/${empleado!.id}/horario`, { dias });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rrhh-horario', empleado?.id] }),
    onError: (e: unknown) => {
      const mensaje = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(mensaje ?? 'No se pudo guardar el horario.');
    },
  });

  function onSubmit() {
    setError(null);
    guardar.mutate();
  }

  // Plan de integración Cuadre, ítem G-1 — si el empleado usa una
  // plantilla (referencia viva), no tiene sentido editar HorarioEmpleado
  // individual acá: se editaría un horario que la plantilla ignora por
  // completo mientras siga asignada.
  const usaPlantilla = empleado?.plantillaHorario ?? null;

  const desvincularPlantilla = useMutation({
    mutationFn: async () => apiClient.patch(`/nomina/empleados/${empleado!.id}`, { plantillaHorarioId: null }),
    onSuccess: () => {
      setEmpleado((e) => (e ? { ...e, plantillaHorario: null } : e));
      queryClient.invalidateQueries({ queryKey: ['nomina-empleados'] });
    },
  });

  return (
    <Card titulo="Horario semanal" descripcion="Días y horas en que trabaja cada empleado — usado para calcular tardanzas en Asistencia.">
      <div className="space-y-4">
        <div className="max-w-sm">
          <ComboboxBusqueda<Empleado>
            valor={empleado}
            onSeleccionar={setEmpleado}
            buscar={async (texto) =>
              (await apiClient.get<PaginaResultado<Empleado>>('/nomina/empleados', { params: { busqueda: texto, tamanoPagina: 20 } })).data
                .datos
            }
            obtenerId={(e) => e.id}
            obtenerEtiqueta={(e) => `${e.nombre} — ${e.cedula}`}
            placeholder="Buscar empleado por nombre o cédula…"
            icono={<User size={15} />}
          />
        </div>

        {empleado && usaPlantilla && (
          <div className="rounded-md border border-sol-200 bg-sol-50 p-4 text-sm dark:border-sol-900 dark:bg-sol-900/20">
            <p className="text-slate-700 dark:text-slate-300">
              Este empleado usa la plantilla <strong>{usaPlantilla.nombre}</strong> ({usaPlantilla.codigo}) — para cambiar sus horarios,
              editá la plantilla en la pestaña "Plantillas de horario". Un cambio ahí se aplica automáticamente a todos los empleados
              que usan esa plantilla.
            </p>
            {puedeEditar && (
              <Button
                variante="secundario"
                className="mt-3"
                onClick={() => desvincularPlantilla.mutate()}
                disabled={desvincularPlantilla.isPending}
              >
                {desvincularPlantilla.isPending ? 'Desvinculando…' : 'Usar horario individual en su lugar'}
              </Button>
            )}
          </div>
        )}

        {empleado && !usaPlantilla && isLoading && <p className="text-sm text-slate-500">Cargando horario…</p>}

        {empleado && !usaPlantilla && !isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-4 font-medium">Día</th>
                  <th className="py-2 pr-4 font-medium">Trabaja</th>
                  <th className="py-2 pr-4 font-medium">Entrada</th>
                  <th className="py-2 pr-4 font-medium">Salida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {DIAS.map((d) => (
                  <tr key={d.clave}>
                    <td className="py-2 pr-4">{d.etiqueta}</td>
                    <td className="py-2 pr-4">
                      <input
                        type="checkbox"
                        disabled={!puedeEditar}
                        checked={form[d.clave].trabaja}
                        onChange={(e) => setForm((f) => ({ ...f, [d.clave]: { ...f[d.clave], trabaja: e.target.checked } }))}
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="time"
                        disabled={!puedeEditar || !form[d.clave].trabaja}
                        value={form[d.clave].horaEntrada}
                        onChange={(e) => setForm((f) => ({ ...f, [d.clave]: { ...f[d.clave], horaEntrada: e.target.value } }))}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="time"
                        disabled={!puedeEditar || !form[d.clave].trabaja}
                        value={form[d.clave].horaSalida}
                        onChange={(e) => setForm((f) => ({ ...f, [d.clave]: { ...f[d.clave], horaSalida: e.target.value } }))}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            {puedeEditar && (
              <div className="mt-4 flex justify-end">
                <Button onClick={onSubmit} disabled={guardar.isPending}>
                  {guardar.isPending ? 'Guardando…' : 'Guardar horario'}
                </Button>
              </div>
            )}
          </div>
        )}

        {!empleado && <p className="text-sm text-slate-500">Seleccioná un empleado para ver o editar su horario.</p>}
      </div>
    </Card>
  );
}
