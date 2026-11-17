import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza al modal "Nueva sucursal" de SucursalesTable.tsx. */
export function SucursalNueva() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.post('/sucursales', {
        nombre,
        nombreComercial: nombreComercial || undefined,
        telefono: telefono || undefined,
        direccion: direccion || undefined,
        ciudad: ciudad || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursales'] });
      confirmarGuardado();
      navigate('/sucursales');
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

  const [haycambios, confirmarGuardado] = useHayCambios({ nombre, nombreComercial, telefono, ciudad, direccion });

  return (
    <PaginaDocumento
      titulo="Nueva sucursal"
      rutaVolver="/sucursales"
      etiquetaVolver="Volver a Sucursales"
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
          <Button type="submit" form="form-nueva-sucursal" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Crear sucursal'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/sucursales')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-sucursal" onSubmit={onSubmit} className="space-y-3">
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
        </Card>
      </form>
    </PaginaDocumento>
  );
}
