import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { platformApiClient } from '../lib/platform-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { usePlatformAuth } from '../hooks/usePlatformAuth';

interface PlatformPermission {
  id: string;
  clave: string;
}

interface PlatformRole {
  id: string;
  nombre: string;
  permisos: { permission: PlatformPermission }[];
}

export function PlatformRoles() {
  const { tienePermiso } = usePlatformAuth();
  const puedeGestionar = tienePermiso('platform.roles.gestionar');
  const queryClient = useQueryClient();

  const [rolEditandoId, setRolEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data: roles } = useQuery({
    queryKey: ['platform-roles'],
    queryFn: async () => (await platformApiClient.get<PlatformRole[]>('/platform/roles')).data,
  });

  const {
    data: catalogoPermisos,
    isLoading: cargandoPermisos,
    isError: errorPermisos,
  } = useQuery({
    queryKey: ['platform-roles-permisos'],
    queryFn: async () => (await platformApiClient.get<PlatformPermission[]>('/platform/roles/permisos')).data,
  });

  const rolEditando = roles?.find((r) => r.id === rolEditandoId) ?? null;

  useEffect(() => {
    if (rolEditando) {
      setNombre(rolEditando.nombre);
      setPermisosSeleccionados(new Set(rolEditando.permisos.map((rp) => rp.permission.clave)));
    }
  }, [rolEditando]);

  function limpiarFormulario() {
    setRolEditandoId(null);
    setNombre('');
    setPermisosSeleccionados(new Set());
    setError(null);
  }

  const guardarRol = useMutation({
    mutationFn: async () => {
      const payload = { nombre, permisos: Array.from(permisosSeleccionados) };
      if (rolEditandoId) return platformApiClient.patch(`/platform/roles/${rolEditandoId}`, payload);
      return platformApiClient.post('/platform/roles', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-roles'] });
      limpiarFormulario();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el rol. Revisa que el nombre no esté repetido.')),
  });

  function alternarPermiso(clave: string) {
    setPermisosSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardarRol.mutate();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Roles</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {puedeGestionar && (
          <Card
            className="lg:col-span-1"
            titulo={rolEditandoId ? `Editar "${rolEditando?.nombre}"` : 'Nuevo rol'}
            descripcion="Un rol agrupa los permisos que puede tener un admin de plataforma."
            acciones={
              rolEditandoId && (
                <button type="button" className="text-xs text-slate-500 hover:underline" onClick={limpiarFormulario}>
                  Cancelar edición
                </button>
              )
            }
          >
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField id="nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Permisos incluidos</p>
                  <span className="text-xs text-slate-400">{permisosSeleccionados.size} seleccionado(s)</span>
                </div>

                {cargandoPermisos && <p className="text-sm text-slate-400">Cargando catálogo de permisos…</p>}
                {errorPermisos && (
                  <p className="text-sm text-red-600">No se pudo cargar el catálogo de permisos. Intenta recargar la página.</p>
                )}

                {catalogoPermisos && catalogoPermisos.length > 0 && (
                  <div className="grid grid-cols-1 gap-2">
                    {catalogoPermisos.map((permiso) => {
                      const seleccionado = permisosSeleccionados.has(permiso.clave);
                      return (
                        <button
                          key={permiso.clave}
                          type="button"
                          aria-pressed={seleccionado}
                          onClick={() => alternarPermiso(permiso.clave)}
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
                          <span className="truncate font-mono text-xs">{permiso.clave}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={guardarRol.isPending} className="w-full">
                {guardarRol.isPending ? 'Guardando…' : rolEditandoId ? 'Guardar cambios' : 'Crear rol'}
              </Button>
            </form>
          </Card>
        )}

        <Card
          className={puedeGestionar ? 'lg:col-span-2' : 'lg:col-span-3'}
          titulo="Roles existentes"
          descripcion={roles ? `${roles.length} rol(es) en el catálogo` : undefined}
        >
          <div className="space-y-3">
            {roles?.map((rol) => (
              <div
                key={rol.id}
                className={clsx(
                  'rounded-lg border p-4 transition-colors',
                  rol.id === rolEditandoId
                    ? 'border-sol-400 bg-sol-50/60 dark:border-sol-600 dark:bg-sol-900/10'
                    : 'border-slate-200 dark:border-slate-800',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{rol.nombre}</p>
                  {puedeGestionar && (
                    <Button variante="secundario" onClick={() => setRolEditandoId(rol.id)}>
                      Editar
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {rol.permisos.length === 0 ? (
                    <span className="text-xs text-slate-400">Sin permisos</span>
                  ) : (
                    rol.permisos.map((rp) => (
                      <Badge key={rp.permission.clave} tono="neutro">
                        {rp.permission.clave}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            ))}
            {roles?.length === 0 && <p className="text-sm text-slate-400">Todavía no hay roles creados.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
