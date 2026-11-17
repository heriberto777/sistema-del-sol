import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { Contrato } from '../types/inmobiliaria';

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal AdministracionAlquilerModal de Contratos.tsx. Modelo 2 — activar/pausar la administración recurrente de un alquiler ya cerrado. */
export function ContratoAdministrarAlquiler() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [porcentaje, setPorcentaje] = useState('10');
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: contrato } = useQuery({
    queryKey: ['inmobiliaria-contrato', id],
    queryFn: async () => (await apiClient.get<Contrato>(`/admin/inmobiliaria/contratos/${id}`)).data,
  });

  useEffect(() => {
    if (contrato && !cargado) {
      setPorcentaje(contrato.porcentajeComisionAdministracion ?? '10');
      setCargado(true);
    }
  }, [contrato, cargado]);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['inmobiliaria-contratos'] });

  const activarAdministracion = useMutation({
    mutationFn: async () => apiClient.patch(`/admin/inmobiliaria/contratos/${id}/administracion-alquiler`, { porcentajeComisionAdministracion: Number(porcentaje) }),
    onSuccess: () => {
      invalidar();
      navigate('/contratos-propiedad');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo activar la administración.')),
  });

  const desactivarAdministracion = useMutation({
    mutationFn: async () => apiClient.delete(`/admin/inmobiliaria/contratos/${id}/administracion-alquiler`),
    onSuccess: () => {
      invalidar();
      navigate('/contratos-propiedad');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo pausar la administración.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    activarAdministracion.mutate();
  }

  const guardando = activarAdministracion.isPending || desactivarAdministracion.isPending;

  return (
    <PaginaDocumento
      titulo="Administración de alquiler"
      rutaVolver="/contratos-propiedad"
      etiquetaVolver="Volver a Contratos y comisiones"
      haycambios={false}
      resumen={
        contrato ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Propiedad</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{contrato.propiedad.titulo}</span>
          </div>
        ) : null
      }
      acciones={
        <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/contratos-propiedad')}>
          Volver
        </Button>
      }
    >
      {!contrato ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : !contrato.propiedad.propietarioId ? (
        <Card titulo="Administración de alquiler">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Esta propiedad no tiene un propietario asignado — asignalo desde Propiedades (campo "Propietario") antes de activar la administración recurrente.
          </p>
        </Card>
      ) : contrato.administracionActiva ? (
        <Card titulo="Administración de alquiler">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              Administración <b>activa</b> — comisión de administración: <b>{contrato.porcentajeComisionAdministracion}%</b>.
            </p>
            {contrato.proximoCobroAlquilerEn && <p>Próximo cobro: {new Date(contrato.proximoCobroAlquilerEn).toLocaleDateString('es-DO')}</p>}
            <p className="text-xs text-slate-400">
              El cobro mensual se genera solo (todos los días a las 8am). Los cobros generados están en{' '}
              <Link to={`/alquileres?contratoPropiedadId=${contrato.id}`} className="text-teal-700 hover:underline dark:text-teal-400">
                Alquileres administrados
              </Link>
              .
            </p>
          </div>
          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button type="button" variante="peligro" disabled={guardando} onClick={() => desactivarAdministracion.mutate()}>
              {guardando ? 'Pausando…' : 'Pausar administración'}
            </Button>
          </div>
        </Card>
      ) : (
        <Card titulo="Activar administración de alquiler">
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              A partir de hoy se genera un cobro mensual de renta para este contrato. El propietario (ya asignado) recibe el alquiler
              cobrado menos la comisión de administración.
            </p>
            <FormField
              id="admin-alquiler-pct"
              label="% de comisión de administración"
              type="number"
              min="0"
              max="100"
              step="0.1"
              required
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Activando…' : 'Activar administración'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </PaginaDocumento>
  );
}
