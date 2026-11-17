import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { Select } from '../../components/atoms/Select/Select';
import { FormField } from '../../components/molecules/FormField/FormField';
import { useHayCambios } from '../../hooks/useHayCambios';

interface Sucursal {
  id: string;
  nombre: string;
}

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalNuevaBodega de StockBodegasPanel.tsx. */
export function BodegaNueva() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => (await apiClient.get<Sucursal[]>('/sucursales')).data,
  });

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/inventario/bodegas', { nombre, direccion: direccion || undefined, sucursalId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodegas'] });
      confirmarGuardado();
      navigate('/inventario/stock');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la bodega.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ nombre, direccion, sucursalId });

  return (
    <PaginaDocumento
      titulo="Nueva bodega"
      rutaVolver="/inventario/stock"
      etiquetaVolver="Volver a Stock"
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
          <Button type="submit" form="form-nueva-bodega" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear bodega'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/inventario/stock')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-bodega" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Información de la bodega">
          <div className="flex flex-col gap-1">
            <label htmlFor="bodega-sucursal" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Sucursal
            </label>
            <Select id="bodega-sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} required>
              <option value="">Seleccionar…</option>
              {sucursales?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </Select>
          </div>
          <FormField id="bodega-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <FormField id="bodega-direccion" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </Card>
      </form>
    </PaginaDocumento>
  );
}
