import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalNuevoUsuario de UsuariosPanel.tsx. */
export function UsuarioNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rolIds, setRolIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: roles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => (await apiClient.get<Rol[]>('/admin/roles')).data,
  });

  const crearUsuario = useMutation({
    mutationFn: async () => apiClient.post('/admin/usuarios', { email, nombre, password, rolIds, telefono: telefono || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de crear bien.
      confirmarGuardado();
      setTimeout(() => navigate('/usuarios'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el usuario. Revisa los datos.')),
  });

  function toggleRol(id: string) {
    setRolIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (rolIds.length === 0) {
      setError('Selecciona al menos un rol');
      return;
    }
    crearUsuario.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ email, nombre, password, telefono, rolIds });

  return (
    <PaginaDocumento
      titulo="Nuevo usuario"
      rutaVolver="/usuarios"
      etiquetaVolver="Volver a Usuarios"
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
          <Button type="submit" form="form-nuevo-usuario" disabled={crearUsuario.isPending} className="w-full">
            {crearUsuario.isPending ? 'Creando…' : 'Crear usuario'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/usuarios')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nuevo-usuario" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Información del usuario">
          <FormField id="nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <FormField id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <FormField
            id="password"
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <FormField id="telefono" label="Teléfono (opcional)" placeholder="+18095551234" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
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
        </Card>
      </form>
    </PaginaDocumento>
  );
}
