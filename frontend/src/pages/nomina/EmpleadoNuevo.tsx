import { FormEvent, useState } from 'react';
import { IdCard } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalEmpleado (modo crear) de EmpleadosTable.tsx. */
export function EmpleadoNuevo() {
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

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.post('/nomina/empleados', {
        nombre,
        cedula,
        cargo,
        fechaIngreso,
        salarioBrutoMensual: Number(salarioBrutoMensual),
        puestoId: puestoId || undefined,
        plantillaHorarioId: plantillaHorarioId || undefined,
        userId: usuario?.id || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nomina-empleados'] });
      confirmarGuardado();
      navigate('/nomina/empleados');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el empleado — revisá que la cédula y el usuario vinculado no estén repetidos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({
    nombre,
    cedula,
    cargo,
    puestoId,
    plantillaHorarioId,
    fechaIngreso,
    salarioBrutoMensual,
    usuarioId: usuario?.id,
  });

  return (
    <PaginaDocumento
      titulo="Nuevo empleado"
      rutaVolver="/nomina/empleados"
      etiquetaVolver="Volver a Empleados"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vista previa</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{nombre || 'Sin nombre'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nuevo-empleado" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Agregar empleado'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/nomina/empleados')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nuevo-empleado" onSubmit={onSubmit} className="space-y-3">
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
    </PaginaDocumento>
  );
}
