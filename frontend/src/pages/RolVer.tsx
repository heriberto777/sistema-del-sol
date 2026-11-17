import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';

interface Rol {
  id: string;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
}

interface RolDetalle extends Rol {
  rolePermissions: { permission: { clave: string } }[];
}

interface Permiso {
  id: string;
  clave: string;
  descripcion: string | null;
}

function agruparPermisos(permisos: Permiso[]) {
  const grupos = new Map<string, Permiso[]>();
  for (const permiso of permisos) {
    const [modulo] = permiso.clave.split('.');
    if (!grupos.has(modulo)) grupos.set(modulo, []);
    grupos.get(modulo)!.push(permiso);
  }
  return Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b));
}

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalRol de RolesPanel.tsx. */
export function RolVer() {
  const { id } = useParams<{ id: string }>();
  const esNuevo = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  const { data: catalogoPermisos } = useQuery({
    queryKey: ['admin-permisos'],
    queryFn: async () => (await apiClient.get<Permiso[]>('/admin/permisos')).data,
  });

  const { data: rolDetalle } = useQuery({
    queryKey: ['admin-rol-detalle', id],
    enabled: !esNuevo,
    queryFn: async () => (await apiClient.get<RolDetalle>(`/admin/roles/${id}`)).data,
  });

  useEffect(() => {
    if (!rolDetalle || cargado) return;
    setNombre(rolDetalle.nombre);
    setDescripcion(rolDetalle.descripcion ?? '');
    setPermisosSeleccionados(new Set(rolDetalle.rolePermissions.map((rp) => rp.permission.clave)));
    setCargado(true);
  }, [rolDetalle, cargado]);

  const guardar = useMutation({
    mutationFn: async () => {
      const permisos = Array.from(permisosSeleccionados);
      if (!esNuevo) {
        return apiClient.patch(`/admin/roles/${id}`, { nombre, descripcion: descripcion || undefined, permisos });
      }
      return apiClient.post('/admin/roles', { nombre, descripcion: descripcion || undefined, permisos });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      confirmarGuardado();
      navigate('/roles-permisos');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el rol. Revisa que el nombre no esté repetido y que haya al menos un permiso.')),
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
    setError(null);
    if (permisosSeleccionados.size === 0) {
      setError('Seleccioná al menos un permiso.');
      return;
    }
    guardar.mutate();
  }

  const grupos = agruparPermisos(catalogoPermisos ?? []);
  const [haycambios, confirmarGuardado] = useHayCambios(
    { nombre, descripcion, permisos: Array.from(permisosSeleccionados) },
    esNuevo || cargado,
  );

  if (!esNuevo && !rolDetalle) {
    return (
      <PaginaDocumento titulo="Rol" rutaVolver="/roles-permisos" etiquetaVolver="Volver a Roles y permisos" haycambios={false} resumen={null} acciones={null}>
        <p className="text-sm text-slate-400">Cargando…</p>
      </PaginaDocumento>
    );
  }

  return (
    <PaginaDocumento
      titulo={esNuevo ? 'Nuevo rol' : `Rol — ${rolDetalle!.nombre}`}
      rutaVolver="/roles-permisos"
      etiquetaVolver="Volver a Roles y permisos"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Permisos seleccionados</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{permisosSeleccionados.size}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-rol" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/roles-permisos')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-rol" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Información del rol">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              id="rol-nombre"
              label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              disabled={!esNuevo && !!rolDetalle?.esSistema}
            />
            <FormField id="rol-descripcion" label="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
        </Card>

        <Card titulo="Permisos">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {grupos.map(([modulo, permisos]) => (
              <div key={modulo}>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-400">{modulo}</p>
                <div className="flex flex-wrap gap-3">
                  {permisos.map((permiso) => (
                    <label key={permiso.id} className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                      <input type="checkbox" checked={permisosSeleccionados.has(permiso.clave)} onChange={() => alternarPermiso(permiso.clave)} />
                      {permiso.clave}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </form>
    </PaginaDocumento>
  );
}
