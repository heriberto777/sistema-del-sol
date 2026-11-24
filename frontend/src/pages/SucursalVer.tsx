import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';

interface Sucursal {
  id: string;
  nombre: string;
  nombreComercial: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  activa: boolean;
}

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza al modal "Editar sucursal" de SucursalesTable.tsx. */
export function SucursalVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [activa, setActiva] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  const { data: sucursal } = useQuery({
    queryKey: ['sucursales', id],
    queryFn: async () => (await apiClient.get<Sucursal>(`/sucursales/${id}`)).data,
  });

  useEffect(() => {
    if (sucursal && !cargado) {
      setNombre(sucursal.nombre);
      setNombreComercial(sucursal.nombreComercial ?? '');
      setTelefono(sucursal.telefono ?? '');
      setCiudad(sucursal.ciudad ?? '');
      setDireccion(sucursal.direccion ?? '');
      setActiva(sucursal.activa);
      setCargado(true);
    }
  }, [sucursal, cargado]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/sucursales/${id}`, {
        nombre,
        nombreComercial: nombreComercial || undefined,
        telefono: telefono || undefined,
        direccion: direccion || undefined,
        ciudad: ciudad || undefined,
        activa,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursales'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de guardar bien.
      confirmarGuardado();
      setTimeout(() => navigate('/sucursales'), 0);
    },
    onError: (e: unknown) => {
      const mensaje = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(mensaje ?? 'No se pudo guardar la sucursal.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ nombre, nombreComercial, telefono, ciudad, direccion, activa }, cargado);

  return (
    <PaginaDocumento
      titulo={sucursal ? `Sucursal — ${sucursal.nombre}` : 'Sucursal'}
      rutaVolver="/sucursales"
      etiquetaVolver="Volver a Sucursales"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vista previa</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{nombre || '—'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-ver-sucursal" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/sucursales')}>
            Volver
          </Button>
        </>
      }
    >
      {!sucursal ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form id="form-ver-sucursal" onSubmit={onSubmit} className="space-y-3">
          <Card titulo="Información de la sucursal">
            <FormField id="sucursal-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            <FormField
              id="sucursal-nombre-comercial"
              label="Nombre comercial (opcional)"
              value={nombreComercial}
              onChange={(e) => setNombreComercial(e.target.value)}
            />
            <FormField id="sucursal-telefono" label="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            <FormField id="sucursal-ciudad" label="Ciudad (opcional)" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            <FormField id="sucursal-direccion" label="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
              Activa
            </label>
          </Card>
        </form>
      )}
    </PaginaDocumento>
  );
}
