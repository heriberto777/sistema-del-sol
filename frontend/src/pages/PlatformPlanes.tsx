import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { platformApiClient } from '../lib/platform-api-client';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Modal } from '../components/molecules/Modal/Modal';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
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
  activo: boolean;
  modulos: { modulo: Modulo }[];
}

interface Tenant {
  id: string;
  planId: string | null;
}

const ETIQUETA_CICLO: Record<CicloFacturacion, string> = { MENSUAL: 'mes', ANUAL: 'año' };

export function PlatformPlanes() {
  const { tienePermiso } = usePlatformAuth();
  const puedeGestionar = tienePermiso('platform.planes.gestionar');
  const queryClient = useQueryClient();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [planEditando, setPlanEditando] = useState<Plan | null>(null);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const { data: planes } = useQuery({
    queryKey: ['platform-planes'],
    queryFn: async () => (await platformApiClient.get<Plan[]>('/platform/planes')).data,
  });

  // Mismo queryKey que PlatformTenants.tsx — comparten caché, sin duplicar el fetch si ya se visitó esa pantalla.
  const { data: tenants } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => (await platformApiClient.get<Tenant[]>('/platform/tenants')).data,
  });

  const cantidadPorPlan = new Map<string, number>();
  for (const t of tenants ?? []) {
    if (t.planId) cantidadPorPlan.set(t.planId, (cantidadPorPlan.get(t.planId) ?? 0) + 1);
  }

  const cambiarActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) =>
      platformApiClient.patch(`/platform/planes/${id}`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-planes'] }),
  });

  function abrirNuevo() {
    setPlanEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(plan: Plan) {
    setPlanEditando(plan);
    setModalAbierto(true);
  }

  const planesVisibles = (planes ?? []).filter((p) => mostrarInactivos || p.activo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Planes</h1>
        {puedeGestionar && <Button onClick={abrirNuevo}>Nuevo plan</Button>}
      </div>

      <Card
        sinPadding
        titulo="Planes existentes"
        descripcion={planes ? `${planes.length} plan(es) en el catálogo` : undefined}
        acciones={
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
            Mostrar inactivos
          </label>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Precio</th>
                <th className="px-5 py-3 font-medium">Módulos</th>
                <th className="px-5 py-3 font-medium">Tenants</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {planesVisibles.map((plan) => (
                <tr key={plan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{plan.nombre}</p>
                    {plan.descripcion && <p className="text-xs text-slate-500 dark:text-slate-400">{plan.descripcion}</p>}
                  </td>
                  <td className="px-5 py-3">
                    RD$ {Number(plan.precio).toLocaleString('es-DO')} / {ETIQUETA_CICLO[plan.cicloFacturacion]}{' '}
                    <span className="text-xs text-slate-400">+ ITBIS</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
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
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{cantidadPorPlan.get(plan.id) ?? 0}</td>
                  <td className="px-5 py-3">
                    <Badge tono={plan.activo ? 'exito' : 'peligro'}>{plan.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {puedeGestionar && (
                      <RowActionsMenu
                        acciones={[
                          { etiqueta: 'Editar', onClick: () => abrirEditar(plan) },
                          plan.activo
                            ? {
                                etiqueta: 'Inactivar',
                                tono: 'peligro' as const,
                                onClick: () => cambiarActivo.mutate({ id: plan.id, activo: false }),
                              }
                            : { etiqueta: 'Activar', onClick: () => cambiarActivo.mutate({ id: plan.id, activo: true }) },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {planesVisibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    {planes?.length === 0 ? 'Todavía no hay planes creados.' : 'No hay planes activos — probá "Mostrar inactivos".'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalAbierto && <ModalPlan plan={planEditando} onClose={() => setModalAbierto(false)} />}
    </div>
  );
}

function ModalPlan({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(plan?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(plan?.descripcion ?? '');
  const [precio, setPrecio] = useState(plan?.precio ?? '0');
  const [cicloFacturacion, setCicloFacturacion] = useState<CicloFacturacion>(plan?.cicloFacturacion ?? 'MENSUAL');
  const [activo, setActivo] = useState(plan?.activo ?? true);
  const [modulosSeleccionados, setModulosSeleccionados] = useState<Set<string>>(
    new Set(plan?.modulos.map((pm) => pm.modulo.clave) ?? []),
  );
  const [error, setError] = useState<string | null>(null);

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
        ...(plan ? { activo } : {}),
      };
      if (plan) return platformApiClient.patch(`/platform/planes/${plan.id}`, payload);
      return platformApiClient.post('/platform/planes', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-planes'] });
      onClose();
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
    setError(null);
    guardarPlan.mutate();
  }

  return (
    <Modal titulo={plan ? `Editar "${plan.nombre}"` : 'Nuevo plan'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField id="plan-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <FormField id="plan-descripcion" label="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
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
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Módulos incluidos</p>
            <span className="text-xs text-slate-400">{modulosSeleccionados.size} seleccionado(s)</span>
          </div>

          {cargandoModulos && <p className="text-sm text-slate-400">Cargando catálogo de módulos…</p>}
          {errorModulos && <p className="text-sm text-red-600">No se pudo cargar el catálogo de módulos. Intenta recargar la página.</p>}
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

        {plan && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Plan activo
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardarPlan.isPending} className="w-full">
          {guardarPlan.isPending ? 'Guardando…' : plan ? 'Guardar cambios' : 'Crear plan'}
        </Button>
      </form>
    </Modal>
  );
}
