import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { FormField } from '../../components/molecules/FormField/FormField';
import { useHayCambios } from '../../hooks/useHayCambios';

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * HitoFormModal.tsx en su modo "Nuevo hito" (ProyectoHitosTab.tsx). El
 * modo "Editar" se fusiona con el detalle en HitoVer.tsx.
 */
export function HitoNuevo() {
  const { id: proyectoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [fechaObjetivo, setFechaObjetivo] = useState('');
  const [montoFijo, setMontoFijo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post(`/admin/proyectos/${proyectoId}/hitos`, {
        nombre,
        fechaObjetivo: fechaObjetivo || undefined,
        montoFijo: montoFijo !== '' ? Number(montoFijo) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de crear bien.
      confirmarGuardado();
      setTimeout(() => navigate(`/proyectos/${proyectoId}/hitos`), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el hito.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError('Ingresá un nombre.');
      return;
    }
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ nombre, fechaObjetivo, montoFijo });

  return (
    <PaginaDocumento
      titulo="Nuevo hito"
      rutaVolver={`/proyectos/${proyectoId}/hitos`}
      etiquetaVolver="Volver a Hitos"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Nombre</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{nombre || 'Sin nombre'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-hito-nuevo" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Guardando…' : 'Crear hito'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/proyectos/${proyectoId}/hitos`)}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-hito-nuevo" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Datos del hito">
          <div className="sm:col-span-2">
            <FormField id="hito-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
          </div>
          <FormField id="hito-fecha-objetivo" label="Fecha objetivo (opcional)" type="date" value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} />
          <FormField
            id="hito-monto-fijo"
            label="Monto fijo (opcional — solo si el proyecto factura a precio fijo)"
            type="number"
            min="0"
            value={montoFijo}
            onChange={(e) => setMontoFijo(e.target.value)}
          />
        </Card>
      </form>
    </PaginaDocumento>
  );
}
