import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { platformApiClient } from '../lib/platform-api-client';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { PlatformHeader } from '../components/organisms/PlatformHeader/PlatformHeader';
import { usePlatformAuth } from '../hooks/usePlatformAuth';

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
  modulos: { modulo: Modulo }[];
}

const ETIQUETA_CICLO: Record<CicloFacturacion, string> = { MENSUAL: 'mes', ANUAL: 'año' };

export function PlatformPlanes() {
  const { tienePermiso } = usePlatformAuth();
  const puedeGestionar = tienePermiso('platform.planes.gestionar');
  const queryClient = useQueryClient();

  const [planEditandoId, setPlanEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('0');
  const [cicloFacturacion, setCicloFacturacion] = useState<CicloFacturacion>('MENSUAL');
  const [modulosSeleccionados, setModulosSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data: planes } = useQuery({
    queryKey: ['platform-planes'],
    queryFn: async () => (await platformApiClient.get<Plan[]>('/platform/planes')).data,
  });

  const {
    data: catalogoModulos,
    isLoading: cargandoModulos,
    isError: errorModulos,
  } = useQuery({
    queryKey: ['platform-planes-modulos'],
    queryFn: async () => (await platformApiClient.get<Modulo[]>('/platform/planes/modulos')).data,
  });

  const planEditando = planes?.find((p) => p.id === planEditandoId) ?? null;

  useEffect(() => {
    if (planEditando) {
      setNombre(planEditando.nombre);
      setDescripcion(planEditando.descripcion ?? '');
      setPrecio(planEditando.precio);
      setCicloFacturacion(planEditando.cicloFacturacion);
      setModulosSeleccionados(new Set(planEditando.modulos.map((pm) => pm.modulo.clave)));
    }
  }, [planEditando]);

  function limpiarFormulario() {
    setPlanEditandoId(null);
    setNombre('');
    setDescripcion('');
    setPrecio('0');
    setCicloFacturacion('MENSUAL');
    setModulosSeleccionados(new Set());
    setError(null);
  }

  const guardarPlan = useMutation({
    mutationFn: async () => {
      const payload = {
        nombre,
        descripcion: descripcion || undefined,
        precio: Number(precio),
        cicloFacturacion,
        modulos: Array.from(modulosSeleccionados),
      };
      if (planEditandoId) return platformApiClient.patch(`/platform/planes/${planEditandoId}`, payload);
      return platformApiClient.post('/platform/planes', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-planes'] });
      limpiarFormulario();
    },
    onError: () => setError('No se pudo guardar el plan. Revisa que el nombre no esté repetido.'),
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
    guardarPlan.mutate();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
      <PlatformHeader titulo="Planes" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {puedeGestionar && (
          <Card
            className="lg:col-span-1"
            titulo={planEditandoId ? `Editar "${planEditando?.nombre}"` : 'Nuevo plan'}
            descripcion="Un plan agrupa los módulos que un tenant puede usar, con un precio de lista."
            acciones={
              planEditandoId && (
                <button type="button" className="text-xs text-slate-500 hover:underline" onClick={limpiarFormulario}>
                  Cancelar edición
                </button>
              )
            }
          >
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField id="nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              <FormField
                id="descripcion"
                label="Descripción (opcional)"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  id="precio"
                  label="Precio (RD$)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  required
                />
                <div>
                  <label htmlFor="ciclo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Ciclo
                  </label>
                  <Select
                    id="ciclo"
                    value={cicloFacturacion}
                    onChange={(e) => setCicloFacturacion(e.target.value as CicloFacturacion)}
                  >
                    <option value="MENSUAL">Mensual</option>
                    <option value="ANUAL">Anual</option>
                  </Select>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Módulos incluidos</p>
                  <span className="text-xs text-slate-400">{modulosSeleccionados.size} seleccionado(s)</span>
                </div>

                {cargandoModulos && <p className="text-sm text-slate-400">Cargando catálogo de módulos…</p>}
                {errorModulos && (
                  <p className="text-sm text-red-600">No se pudo cargar el catálogo de módulos. Intenta recargar la página.</p>
                )}
                {catalogoModulos && catalogoModulos.length === 0 && (
                  <p className="text-sm text-slate-400">No hay módulos en el catálogo todavía.</p>
                )}

                {catalogoModulos && catalogoModulos.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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

              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={guardarPlan.isPending} className="w-full">
                {guardarPlan.isPending ? 'Guardando…' : planEditandoId ? 'Guardar cambios' : 'Crear plan'}
              </Button>
            </form>
          </Card>
        )}

        <Card
          className={puedeGestionar ? 'lg:col-span-2' : 'lg:col-span-3'}
          titulo="Planes existentes"
          descripcion={planes ? `${planes.length} plan(es) en el catálogo` : undefined}
        >
          <div className="space-y-3">
            {planes?.map((plan) => (
              <div
                key={plan.id}
                className={clsx(
                  'rounded-lg border p-4 transition-colors',
                  plan.id === planEditandoId
                    ? 'border-sol-400 bg-sol-50/60 dark:border-sol-600 dark:bg-sol-900/10'
                    : 'border-slate-200 dark:border-slate-800',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{plan.nombre}</p>
                      <Badge tono="exito">
                        RD$ {Number(plan.precio).toLocaleString('es-DO')} / {ETIQUETA_CICLO[plan.cicloFacturacion]}
                      </Badge>
                    </div>
                    {plan.descripcion && <p className="text-sm text-slate-500 dark:text-slate-400">{plan.descripcion}</p>}
                  </div>
                  {puedeGestionar && (
                    <Button variante="secundario" onClick={() => setPlanEditandoId(plan.id)}>
                      Editar
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {plan.modulos.length === 0 ? (
                    <span className="text-xs text-slate-400">Sin módulos</span>
                  ) : (
                    plan.modulos.map((pm) => (
                      <Badge key={pm.modulo.clave} tono="neutro">
                        {pm.modulo.nombre}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            ))}
            {planes?.length === 0 && <p className="text-sm text-slate-400">Todavía no hay planes creados.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
