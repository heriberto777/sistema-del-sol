import { FormEvent, useEffect, useState } from 'react';
import { IdCard } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { FormField } from '../../components/molecules/FormField/FormField';
import { ComboboxBusqueda } from '../../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { SelectPuesto } from '../../components/molecules/SelectPuesto/SelectPuesto';
import { SelectPlantillaHorario } from '../../components/molecules/SelectPlantillaHorario/SelectPlantillaHorario';
import { PaginaResultado } from '../../types/pagina-resultado';
import { useHayCambios } from '../../hooks/useHayCambios';

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

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalEmpleado (modo editar) de EmpleadosTable.tsx. */
export function EmpleadoVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [cargo, setCargo] = useState('');
  const [puestoId, setPuestoId] = useState('');
  const [plantillaHorarioId, setPlantillaHorarioId] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [salarioBrutoMensual, setSalarioBrutoMensual] = useState('');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  const { data: empleado } = useQuery({
    queryKey: ['nomina-empleados', id],
    queryFn: async () => (await apiClient.get<Empleado>(`/nomina/empleados/${id}`)).data,
  });

  useEffect(() => {
    if (empleado && !cargado) {
      setNombre(empleado.nombre);
      setCedula(empleado.cedula);
      setCargo(empleado.cargo);
      setPuestoId(empleado.puesto?.id ?? '');
      setPlantillaHorarioId(empleado.plantillaHorario?.id ?? '');
      setFechaIngreso(empleado.fechaIngreso.slice(0, 10));
      setSalarioBrutoMensual(empleado.salarioBrutoMensual);
      setUsuario(empleado.user);
      setCargado(true);
    }
  }, [empleado, cargado]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/nomina/empleados/${id}`, {
        nombre,
        cedula,
        cargo,
        fechaIngreso,
        salarioBrutoMensual: Number(salarioBrutoMensual),
        puestoId: puestoId || null,
        plantillaHorarioId: plantillaHorarioId || null,
        userId: usuario?.id ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nomina-empleados'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de guardar bien.
      confirmarGuardado();
      setTimeout(() => navigate('/nomina/empleados'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el empleado — revisá que la cédula y el usuario vinculado no estén repetidos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios(
    { nombre, cedula, cargo, puestoId, plantillaHorarioId, fechaIngreso, salarioBrutoMensual, usuarioId: usuario?.id },
    cargado,
  );

  return (
    <PaginaDocumento
      titulo={empleado ? `Empleado — ${empleado.nombre}` : 'Empleado'}
      rutaVolver="/nomina/empleados"
      etiquetaVolver="Volver a Empleados"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cédula</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{empleado?.cedula ?? '—'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-ver-empleado" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/nomina/empleados')}>
            Volver
          </Button>
        </>
      }
    >
      {!empleado ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form id="form-ver-empleado" onSubmit={onSubmit} className="space-y-3">
          <Card titulo="Información del empleado">
            <FormField id="empleado-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            <FormField id="empleado-cedula" label="Cédula" value={cedula} onChange={(e) => setCedula(e.target.value)} required />
            <FormField id="empleado-cargo" label="Cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} required />
            <div className="flex flex-col gap-1">
              <label htmlFor="empleado-puesto" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Puesto (opcional, para filtrar/reportar)
              </label>
              <SelectPuesto id="empleado-puesto" value={puestoId} onChange={setPuestoId} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="empleado-plantilla-horario" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Plantilla de horario (opcional — sin elegir, se auto-asigna la predeterminada si existe)
              </label>
              <SelectPlantillaHorario id="empleado-plantilla-horario" value={plantillaHorarioId} onChange={setPlantillaHorarioId} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Vincular a un usuario existente (opcional, habilita marcar entrada/salida por autoservicio)
              </label>
              <ComboboxBusqueda<Usuario>
                valor={usuario}
                onSeleccionar={setUsuario}
                obtenerId={(u) => u.id}
                obtenerEtiqueta={(u) => `${u.nombre} (${u.email})`}
                placeholder="Buscar usuario…"
                icono={<IdCard size={15} />}
                buscar={async (texto) =>
                  (
                    await apiClient.get<PaginaResultado<Usuario>>('/nomina/empleados/usuarios-disponibles', {
                      params: { busqueda: texto, tamanoPagina: 10 },
                    })
                  ).data.datos
                }
              />
            </div>
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
          </Card>
        </form>
      )}
    </PaginaDocumento>
  );
}
