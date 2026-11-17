import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { platformApiClient } from '../lib/platform-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';

type CicloFacturacion = 'MENSUAL' | 'ANUAL';

interface Modulo {
  id: string;
  clave: string;
  nombre: string;
}

interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: string;
  cicloFacturacion: CicloFacturacion;
  activo: boolean;
  modulos: { modulo: Modulo }[];
}

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalPlan de PlatformPlanes.tsx. */
export function PlatformPlanVer() {
  const { id } = useParams<{ id: string }>();
  const esNuevo = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: plan } = useQuery({
    queryKey: ['platform-planes', id],
    queryFn: async () => (await platformApiClient.get<Plan>(`/platform/planes/${id}`)).data,
    enabled: !esNuevo,
  });

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('0');
  const [cicloFacturacion, setCicloFacturacion] = useState<CicloFacturacion>('MENSUAL');
  const [activo, setActivo] = useState(true);
  const [modulosSeleccionados, setModulosSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (plan && !cargado) {
      setNombre(plan.nombre);
      setDescripcion(plan.descripcion ?? '');
      setPrecio(plan.precio);
      setCicloFacturacion(plan.cicloFacturacion);
      setActivo(plan.activo);
      setModulosSeleccionados(new Set(plan.modulos.map((pm) => pm.modulo.clave)));
      setCargado(true);
    }
  }, [plan, cargado]);

  const {
    data: catalogoModulos,
    isLoading: cargandoModulos,
    isError: errorModulos,
  } = useQuery({
    queryKey: ['platform-planes-modulos'],
    queryFn: async () => (await platformApiClient.get<Modulo[]>('/platform/planes/modulos')).data,
  });

  const guardarPlan = useMutation({
    mutationFn: async () => {
      const payload = {
        nombre,
        descripcion: descripcion || undefined,
        precio: Number(precio),
        cicloFacturacion,
        modulos: Array.from(modulosSeleccionados),
        ...(esNuevo ? {} : { activo }),
      };
      if (esNuevo) return platformApiClient.post('/platform/planes', payload);
      return platformApiClient.patch(`/platform/planes/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-planes'] });
      confirmarGuardado();
      navigate('/plataforma/planes');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el plan. Revisa que el nombre no esté repetido.')),
  });

  function alternarModulo(clave: string) {
    setModulosSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardarPlan.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios(
    { nombre, descripcion, precio, cicloFacturacion, activo, modulos: Array.from(modulosSeleccionados) },
    esNuevo || cargado,
  );

  return (
    <PaginaDocumento
      titulo={esNuevo ? 'Nuevo plan' : plan ? `Plan — ${plan.nombre}` : 'Plan'}
      rutaVolver="/plataforma/planes"
      etiquetaVolver="Volver a Planes"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Precio</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {Number(precio || 0).toLocaleString('es-DO')}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Módulos</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{modulosSeleccionados.size} seleccionado(s)</span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-plan" disabled={guardarPlan.isPending} className="w-full">
            {guardarPlan.isPending ? 'Guardando…' : esNuevo ? 'Crear plan' : 'Guardar cambios'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/plataforma/planes')}>
            Cancelar
          </Button>
        </>
      }
    >
      {!esNuevo && !plan ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form id="form-plan" onSubmit={onSubmit} className="space-y-4">
          <Card titulo="Información del plan">
            <div className="sm:col-span-2">
              <FormField id="plan-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <FormField id="plan-descripcion" label="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            <FormField
              id="plan-precio"
              label="Precio (RD$)"
              type="number"
              step="0.01"
              min="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              required
            />
            <div>
              <label htmlFor="plan-ciclo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Ciclo
              </label>
              <Select id="plan-ciclo" value={cicloFacturacion} onChange={(e) => setCicloFacturacion(e.target.value as CicloFacturacion)}>
                <option value="MENSUAL">Mensual</option>
                <option value="ANUAL">Anual</option>
              </Select>
            </div>

            {!esNuevo && (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                Plan activo
              </label>
            )}
          </Card>

          <Card titulo="Módulos incluidos" descripcion={`${modulosSeleccionados.size} seleccionado(s)`}>
            <div className="sm:col-span-2">
              {cargandoModulos && <p className="text-sm text-slate-400">Cargando catálogo de módulos…</p>}
              {errorModulos && <p className="text-sm text-red-600 dark:text-red-400">No se pudo cargar el catálogo de módulos. Intenta recargar la página.</p>}
              {catalogoModulos && catalogoModulos.length === 0 && <p className="text-sm text-slate-400">No hay módulos en el catálogo todavía.</p>}

              {catalogoModulos && catalogoModulos.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {catalogoModulos.map((modulo) => {
                    const seleccionado = modulosSeleccionados.has(modulo.clave);
                    return (
                      <button
                        key={modulo.clave}
                        type="button"
                        aria-pressed={seleccionado}
                        onClick={() => alternarModulo(modulo.clave)}
                        className={clsx(
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                          seleccionado
                            ? 'border-sol-400 bg-sol-50 text-sol-800 dark:border-sol-600 dark:bg-sol-900/30 dark:text-sol-300'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60',
                        )}
                      >
                        <span
                          className={clsx(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold text-white',
                            seleccionado ? 'border-sol-500 bg-sol-500' : 'border-slate-300 bg-transparent dark:border-slate-600',
                          )}
                        >
                          {seleccionado && '✓'}
                        </span>
                        <span className="truncate">{modulo.nombre}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </form>
      )}
    </PaginaDocumento>
  );
}
