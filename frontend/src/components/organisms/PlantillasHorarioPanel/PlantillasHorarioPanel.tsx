import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { type PlantillaHorario } from '../../../hooks/usePlantillasHorario';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';

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

/** Plantillas de horario reutilizables (plan de integración Cuadre, ítem G-1) — referencia viva: editar los días acá cambia el horario efectivo de TODOS los empleados que la tengan asignada. */
export function PlantillasHorarioPanel() {
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [predeterminada, setPredeterminada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plantillaEditandoDias, setPlantillaEditandoDias] = useState<PlantillaHorario | null>(null);

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
                      onClick={() => setPlantillaEditandoDias(p)}
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

      {plantillaEditandoDias && (
        <ModalDiasPlantilla plantilla={plantillaEditandoDias} onClose={() => setPlantillaEditandoDias(null)} />
      )}
    </div>
  );
}

function ModalDiasPlantilla({ plantilla, onClose }: { plantilla: PlantillaHorario; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EstadoDias>(estadoInicial());
  const [error, setError] = useState<string | null>(null);

  const { data: detalle, isLoading } = useQuery({
    queryKey: ['plantilla-horario-dias', plantilla.id],
    queryFn: async () => (await apiClient.get<PlantillaHorarioDetalle>(`/nomina/plantillas-horario/${plantilla.id}`)).data,
  });

  useEffect(() => {
    if (!detalle) return;
    const base = estadoInicial();
    for (const franja of detalle.dias) {
      base[franja.diaSemana] = { trabaja: true, horaEntrada: franja.horaEntrada, horaSalida: franja.horaSalida };
    }
    setForm(base);
  }, [detalle]);

  const guardar = useMutation({
    mutationFn: async () => {
      const dias = DIAS.filter((d) => form[d.clave].trabaja).map((d) => ({
        diaSemana: d.clave,
        horaEntrada: form[d.clave].horaEntrada,
        horaSalida: form[d.clave].horaSalida,
      }));
      return apiClient.put(`/nomina/plantillas-horario/${plantilla.id}/dias`, { dias });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantilla-horario-dias', plantilla.id] });
      onClose();
    },
    onError: (e: unknown) => {
      const mensaje = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(mensaje ?? 'No se pudo guardar la plantilla.');
    },
  });

  return (
    <Modal titulo={`Días de "${plantilla.nombre}"`} onClose={onClose}>
      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
      {!isLoading && (
        <div className="space-y-4">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Referencia viva: guardar acá cambia el horario efectivo de TODOS los empleados que usan esta plantilla.
          </p>
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando…' : 'Guardar días'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
