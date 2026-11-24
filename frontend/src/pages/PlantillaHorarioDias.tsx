import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { useHayCambios } from '../hooks/useHayCambios';
import { type PlantillaHorario } from '../hooks/usePlantillasHorario';

type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO' | 'DOMINGO';

interface FranjaHorario {
  diaSemana: DiaSemana;
  horaEntrada: string;
  horaSalida: string;
}

interface PlantillaHorarioDetalle extends PlantillaHorario {
  dias: FranjaHorario[];
}

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
type EstadoDias = Record<DiaSemana, FilaDia>;

function estadoInicial(): EstadoDias {
  return Object.fromEntries(DIAS.map((d) => [d.clave, { trabaja: false, horaEntrada: '08:00', horaSalida: '17:00' }])) as EstadoDias;
}

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza al modal "Editar días" de PlantillasHorarioPanel.tsx. */
export function PlantillaHorarioDias() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EstadoDias>(estadoInicial());
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  const { data: detalle } = useQuery({
    queryKey: ['plantilla-horario-dias', id],
    queryFn: async () => (await apiClient.get<PlantillaHorarioDetalle>(`/nomina/plantillas-horario/${id}`)).data,
  });

  useEffect(() => {
    if (!detalle || cargado) return;
    const base = estadoInicial();
    for (const franja of detalle.dias) {
      base[franja.diaSemana] = { trabaja: true, horaEntrada: franja.horaEntrada, horaSalida: franja.horaSalida };
    }
    setForm(base);
    setCargado(true);
  }, [detalle, cargado]);

  const guardar = useMutation({
    mutationFn: async () => {
      const dias = DIAS.filter((d) => form[d.clave].trabaja).map((d) => ({
        diaSemana: d.clave,
        horaEntrada: form[d.clave].horaEntrada,
        horaSalida: form[d.clave].horaSalida,
      }));
      return apiClient.put(`/nomina/plantillas-horario/${id}/dias`, { dias });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantilla-horario-dias', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-plantillas-horario'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de guardar bien.
      confirmarGuardado();
      setTimeout(() => navigate('/plantillas-horario'), 0);
    },
    onError: (e: unknown) => {
      const mensaje = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(mensaje ?? 'No se pudo guardar la plantilla.');
    },
  });

  const [haycambios, confirmarGuardado] = useHayCambios(form, cargado);

  return (
    <PaginaDocumento
      titulo={detalle ? `Días de "${detalle.nombre}"` : 'Días de la plantilla'}
      rutaVolver="/plantillas-horario"
      etiquetaVolver="Volver a Plantillas de horario"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Días activos</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{DIAS.filter((d) => form[d.clave].trabaja).length} de 7</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={() => guardar.mutate()} disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar días'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/plantillas-horario')}>
            Volver
          </Button>
        </>
      }
    >
      {!detalle ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <Card titulo="Días y horario" descripcion="Referencia viva: guardar acá cambia el horario efectivo de TODOS los empleados que usan esta plantilla.">
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
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">{d.etiqueta}</td>
                    <td className="py-2 pr-4">
                      <input
                        type="checkbox"
                        checked={form[d.clave].trabaja}
                        onChange={(e) => setForm((f) => ({ ...f, [d.clave]: { ...f[d.clave], trabaja: e.target.checked } }))}
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="time"
                        disabled={!form[d.clave].trabaja}
                        value={form[d.clave].horaEntrada}
                        onChange={(e) => setForm((f) => ({ ...f, [d.clave]: { ...f[d.clave], horaEntrada: e.target.value } }))}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="time"
                        disabled={!form[d.clave].trabaja}
                        value={form[d.clave].horaSalida}
                        onChange={(e) => setForm((f) => ({ ...f, [d.clave]: { ...f[d.clave], horaSalida: e.target.value } }))}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PaginaDocumento>
  );
}
