import { useEffect, useState } from 'react';
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
}

interface Sucursal {
  id: string;
  nombre: string;
}

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  telefono: string | null;
  roles: { role: Rol }[];
  sucursales: { sucursal: Sucursal }[];
}

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalEditarUsuario de UsuariosPanel.tsx. */
export function UsuarioVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [telefono, setTelefono] = useState('');
  const [rolIds, setRolIds] = useState<string[]>([]);
  const [sucursalIds, setSucursalIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  const { data: usuario } = useQuery({
    queryKey: ['admin-usuarios', id],
    queryFn: async () => (await apiClient.get<Usuario>(`/admin/usuarios/${id}`)).data,
  });
  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => (await apiClient.get<Sucursal[]>('/sucursales')).data,
  });
  const { data: roles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => (await apiClient.get<Rol[]>('/admin/roles')).data,
  });

  useEffect(() => {
    if (usuario && !cargado) {
      setTelefono(usuario.telefono ?? '');
      setRolIds(usuario.roles.map((r) => r.role.id));
      setSucursalIds(usuario.sucursales.map((s) => s.sucursal.id));
      setCargado(true);
    }
  }, [usuario, cargado]);

  const guardar = useMutation({
    mutationFn: async () =>
      Promise.all([
        apiClient.put(`/admin/usuarios/${id}/sucursales`, { sucursalIds }),
        apiClient.patch(`/admin/usuarios/${id}`, { rolIds, telefono }),
      ]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] });
      confirmarGuardado();
      navigate('/usuarios');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar los cambios.')),
  });

  function toggleSucursal(idSuc: string) {
    setSucursalIds((prev) => (prev.includes(idSuc) ? prev.filter((s) => s !== idSuc) : [...prev, idSuc]));
  }

  function toggleRol(idRol: string) {
    setRolIds((prev) => (prev.includes(idRol) ? prev.filter((r) => r !== idRol) : [...prev, idRol]));
  }

  function onGuardar() {
    setError(null);
    if (rolIds.length === 0) {
      setError('Selecciona al menos un rol.');
      return;
    }
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ telefono, rolIds, sucursalIds }, cargado);

  return (
    <PaginaDocumento
      titulo={usuario ? `Usuario — ${usuario.nombre}` : 'Usuario'}
      rutaVolver="/usuarios"
      etiquetaVolver="Volver a Usuarios"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{usuario?.email ?? '—'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={onGuardar} disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/usuarios')}>
            Volver
          </Button>
        </>
      }
    >
      {!usuario ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <Card titulo="Información del usuario">
          <FormField id="telefono-editar" label="Teléfono (opcional)" placeholder="+18095551234" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Roles</p>
            <div className="flex flex-wrap gap-2">
              {roles?.map((rol) => (
                <label key={rol.id} className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                  <input type="checkbox" checked={rolIds.includes(rol.id)} onChange={() => toggleRol(rol.id)} />
                  {rol.nombre}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Sucursales en las que trabaja</p>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Sin ninguna marcada, el usuario puede elegir cualquier sucursal del negocio.
            </p>
            <div className="flex flex-wrap gap-2">
              {sucursales?.map((sucursal) => (
                <label key={sucursal.id} className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                  <input type="checkbox" checked={sucursalIds.includes(sucursal.id)} onChange={() => toggleSucursal(sucursal.id)} />
                  {sucursal.nombre}
                </label>
              ))}
            </div>
          </div>
        </Card>
      )}
    </PaginaDocumento>
  );
}
