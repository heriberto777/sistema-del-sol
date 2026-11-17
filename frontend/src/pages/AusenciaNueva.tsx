import { FormEvent, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { PaginaResultado } from '../types/pagina-resultado';
import { useHayCambios } from '../hooks/useHayCambios';
import { useTiposAusenciaConfig } from '../hooks/useTiposAusenciaConfig';

interface Empleado {
  id: string;
  nombre: string;
  cedula: string;
}

type TipoAusencia = 'VACACIONES' | 'ENFERMEDAD' | 'PERMISO' | 'INJUSTIFICADA' | 'MATERNIDAD_PATERNIDAD' | 'OTRO';

const ETIQUETAS_TIPO: Record<TipoAusencia, string> = {
  VACACIONES: 'Vacaciones',
  ENFERMEDAD: 'Enfermedad',
  PERMISO: 'Permiso',
  INJUSTIFICADA: 'Injustificada',
  MATERNIDAD_PATERNIDAD: 'Maternidad/Paternidad',
  OTRO: 'Otro',
};

const CON_GOCE_POR_DEFECTO: Record<TipoAusencia, boolean> = {
  VACACIONES: true,
  ENFERMEDAD: true,
  PERMISO: true,
  MATERNIDAD_PATERNIDAD: true,
  INJUSTIFICADA: false,
  OTRO: true,
};

interface BalanceVacaciones {
  aniosCompletos: number;
  diasAcumulados: number;
  diasDisponibles: number;
  diasPagoPorAntiguedad: number;
}

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza al modal "Solicitar ausencia" de AusenciasTable.tsx. */
export function AusenciaNueva() {
  const navigate = useNavigate();
  const { data: tiposConfig } = useTiposAusenciaConfig();
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [tipo, setTipo] = useState<TipoAusencia>('VACACIONES');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [conGoceDeSueldo, setConGoceDeSueldo] = useState(true);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tiposActivos = (Object.keys(ETIQUETAS_TIPO) as TipoAusencia[]).filter(
    (t) => tiposConfig?.find((c) => c.tipo === t)?.activo ?? true,
  );
  const configTipoActual = tiposConfig?.find((c) => c.tipo === tipo);

  const { data: balance } = useQuery({
    queryKey: ['rrhh-balance-vacaciones', empleado?.id],
    queryFn: async () => (await apiClient.get<BalanceVacaciones>(`/nomina/empleados/${empleado!.id}/balance-vacaciones`)).data,
    enabled: !!empleado && tipo === 'VACACIONES',
  });

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/nomina/ausencias', {
        empleadoId: empleado!.id,
        tipo,
        fechaDesde,
        fechaHasta,
        conGoceDeSueldo,
        motivo: motivo || undefined,
      }),
    onSuccess: () => {
      confirmarGuardado();
      navigate('/ausencias');
    },
    onError: (e: unknown) => {
      const mensaje = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(mensaje ?? 'No se pudo registrar la solicitud.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!empleado) {
      setError('Seleccioná un empleado.');
      return;
    }
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ empleadoId: empleado?.id, tipo, fechaDesde, fechaHasta, conGoceDeSueldo, motivo });

  return (
    <PaginaDocumento
      titulo="Solicitar ausencia"
      rutaVolver="/ausencias"
      etiquetaVolver="Volver a Ausencias"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Empleado</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{empleado?.nombre ?? 'Sin seleccionar'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nueva-ausencia" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Guardando…' : 'Solicitar ausencia'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/ausencias')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-ausencia" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Información de la solicitud">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Empleado</label>
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
          <div className="flex flex-col gap-1">
            <label htmlFor="ausencia-tipo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Tipo
            </label>
            <Select
              id="ausencia-tipo"
              value={tipo}
              onChange={(e) => {
                const nuevoTipo = e.target.value as TipoAusencia;
                setTipo(nuevoTipo);
                setConGoceDeSueldo(tiposConfig?.find((c) => c.tipo === nuevoTipo)?.conGoceDeSueldoPorDefecto ?? CON_GOCE_POR_DEFECTO[nuevoTipo]);
              }}
            >
              {tiposActivos.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETAS_TIPO[t]}
                </option>
              ))}
            </Select>
          </div>
          {tipo === 'VACACIONES' && empleado && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {balance
                ? `Balance disponible: ${balance.diasDisponibles} día(s) (${balance.aniosCompletos} año(s) de antigüedad, ${balance.diasAcumulados} acumulado(s))`
                : 'Calculando balance de vacaciones…'}
            </p>
          )}
          {tipo !== 'VACACIONES' && configTipoActual?.maximoDiasPorAnio != null && (
            <p className="text-sm text-slate-600 dark:text-slate-400">Tope configurado: {configTipoActual.maximoDiasPorAnio} día(s)/año.</p>
          )}
          {configTipoActual?.requiereAprobacion === false && (
            <p className="text-sm text-amber-600 dark:text-amber-400">Este tipo se auto-aprueba al solicitarse.</p>
          )}
          <FormField id="ausencia-desde" label="Desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} required />
          <FormField id="ausencia-hasta" label="Hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} required />
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={conGoceDeSueldo} onChange={(e) => setConGoceDeSueldo(e.target.checked)} />
            Con goce de sueldo (no descuenta salario en nómina)
          </label>
          <FormField id="ausencia-motivo" label="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Card>
      </form>
    </PaginaDocumento>
  );
}
