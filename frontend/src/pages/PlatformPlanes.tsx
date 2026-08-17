import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { platformApiClient } from '../lib/platform-api-client';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';
import { usePlatformAuth } from '../hooks/usePlatformAuth';

interface Modulo {
  id: string;
  clave: string;
  nombre: string;
}

interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  modulos: { modulo: Modulo }[];
}

export function PlatformPlanes() {
  const { admin, logout } = usePlatformAuth();
  const queryClient = useQueryClient();

  const [planEditandoId, setPlanEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [modulosSeleccionados, setModulosSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data: planes } = useQuery({
    queryKey: ['platform-planes'],
    queryFn: async () => (await platformApiClient.get<Plan[]>('/platform/planes')).data,
  });

  const { data: catalogoModulos } = useQuery({
    queryKey: ['platform-planes-modulos'],
    queryFn: async () => (await platformApiClient.get<Modulo[]>('/platform/planes/modulos')).data,
  });

  const planEditando = planes?.find((p) => p.id === planEditandoId) ?? null;

  useEffect(() => {
    if (planEditando) {
      setNombre(planEditando.nombre);
      setDescripcion(planEditando.descripcion ?? '');
      setModulosSeleccionados(new Set(planEditando.modulos.map((pm) => pm.modulo.clave)));
    }
  }, [planEditando]);

  function limpiarFormulario() {
    setPlanEditandoId(null);
    setNombre('');
    setDescripcion('');
    setModulosSeleccionados(new Set());
    setError(null);
  }

  const guardarPlan = useMutation({
    mutationFn: async () => {
      const payload = { nombre, descripcion: descripcion || undefined, modulos: Array.from(modulosSeleccionados) };
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
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-sol-600 dark:text-sol-400">Plataforma — Planes</h1>
          <Link to="/plataforma/tenants" className="text-sm text-slate-500 hover:underline dark:text-slate-400">
            Ver tenants
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">{admin?.nombre}</span>
          <ThemeToggle />
          <Button variante="secundario" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-slate-900 dark:text-slate-100">
              {planEditandoId ? `Editar "${planEditando?.nombre}"` : 'Nuevo plan'}
            </h2>
            {planEditandoId && (
              <button type="button" className="text-xs text-slate-500 hover:underline" onClick={limpiarFormulario}>
                Cancelar edición
              </button>
            )}
          </div>
          <FormField id="nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <FormField
            id="descripcion"
            label="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Módulos incluidos</p>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
              {catalogoModulos?.map((modulo) => (
                <label key={modulo.clave} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={modulosSeleccionados.has(modulo.clave)}
                    onChange={() => alternarModulo(modulo.clave)}
                  />
                  {modulo.nombre}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={guardarPlan.isPending} className="w-full">
            {guardarPlan.isPending ? 'Guardando…' : planEditandoId ? 'Guardar cambios' : 'Crear plan'}
          </Button>
        </form>

        <div className="lg:col-span-2 space-y-3">
          {planes?.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{plan.nombre}</p>
                {plan.descripcion && <p className="text-sm text-slate-500 dark:text-slate-400">{plan.descripcion}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {plan.modulos.map((pm) => pm.modulo.nombre).join(', ') || 'Sin módulos'}
                </p>
              </div>
              <Button variante="secundario" onClick={() => setPlanEditandoId(plan.id)}>
                Editar
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
