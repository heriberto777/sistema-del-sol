import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { ConfirmModal } from '../../molecules/ConfirmModal/ConfirmModal';
import { RequierePermiso } from '../RequierePermiso/RequierePermiso';
import { HitoFormModal, HitoFormValues } from '../HitoFormModal/HitoFormModal';
import { FacturarHitoModal } from '../FacturarHitoModal/FacturarHitoModal';
import { useAuth } from '../../../hooks/useAuth';
import { ESTADOS_HITO, ETIQUETA_ESTADO_HITO, Hito, Tarea } from '../../../types/proyectos';

interface CostoHorasHito {
  horasTotales: number;
  costoHoras: number;
}

interface ProyectoHitosTabProps {
  proyectoId: string;
  hitos: Hito[];
  tareas: Tarea[];
  onInvalidar: () => void;
  onError: (mensaje: string | null) => void;
  onFacturado: (mensaje: string) => void;
}

export function ProyectoHitosTab({ proyectoId, hitos, tareas, onInvalidar, onError, onFacturado }: ProyectoHitosTabProps) {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const puedeVerCosto = tienePermiso('proyectos.rentabilidad.ver');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [hitoEditando, setHitoEditando] = useState<Hito | null>(null);
  const [hitoAEliminar, setHitoAEliminar] = useState<Hito | null>(null);
  const [hitoAFacturar, setHitoAFacturar] = useState<Hito | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Fase 5 — costo interno (salario) de las horas ya cargadas en cada hito,
  // para avisar si `montoFijo` no lo cubre. Mismo permiso que Rentabilidad:
  // deriva del salario de los empleados, más sensible que `proyectos.ver`.
  const { data: costoPorHito } = useQuery({
    queryKey: ['proyecto-costo-horas-hitos', proyectoId],
    queryFn: async () => (await apiClient.get<Record<string, CostoHorasHito>>(`/admin/proyectos/${proyectoId}/costo-horas-hitos`)).data,
    enabled: puedeVerCosto,
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
    onInvalidar();
  };

  const crearHito = useMutation({
    mutationFn: async (valores: HitoFormValues) => apiClient.post(`/admin/proyectos/${proyectoId}/hitos`, valores),
    onSuccess: () => {
      setModalAbierto(false);
      setErrorForm(null);
      invalidar();
    },
    onError: (err) => setErrorForm(mensajeErrorApi(err, 'No se pudo crear el hito.')),
  });

  const editarHito = useMutation({
    mutationFn: async (valores: HitoFormValues) => apiClient.patch(`/admin/proyectos/hitos/${hitoEditando?.id}`, valores),
    onSuccess: () => {
      setHitoEditando(null);
      setErrorForm(null);
      invalidar();
    },
    onError: (err) => setErrorForm(mensajeErrorApi(err, 'No se pudo guardar el hito.')),
  });

  const eliminarHito = useMutation({
    mutationFn: async (hitoId: string) => apiClient.delete(`/admin/proyectos/hitos/${hitoId}`),
    onSuccess: () => {
      setHitoAEliminar(null);
      invalidar();
    },
    onError: (err) => {
      onError(mensajeErrorApi(err, 'No se pudo eliminar el hito.'));
      setHitoAEliminar(null);
    },
  });

  const cambiarEstadoHito = useMutation({
    mutationFn: async ({ hitoId, estado }: { hitoId: string; estado: string }) => apiClient.patch(`/admin/proyectos/hitos/${hitoId}`, { estado }),
    onSuccess: invalidar,
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo cambiar el estado del hito.')),
  });

  const facturarHito = useMutation({
    mutationFn: async (hitoId: string) => (await apiClient.post<{ facturaId: string; numero: string | null; total: string }>(`/admin/proyectos/hitos/${hitoId}/facturar`)).data,
    onSuccess: (factura) => {
      onError(null);
      onFacturado(`Factura ${factura.numero ?? factura.facturaId} generada por RD$ ${Number(factura.total).toLocaleString('es-DO')}.`);
      setHitoAFacturar(null);
      invalidar();
    },
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo facturar el hito.')),
  });

  // Puntos 1 y 2 del pedido del usuario (2026-09-10): cantidad de tareas
  // asignadas a cada hito y su % de progreso (Terminadas ÷ total).
  const tareasDelHito = (hitoId: string) => tareas.filter((t) => t.hitoId === hitoId);
  const progresoHito = (hitoId: string) => {
    const delHito = tareasDelHito(hitoId);
    const terminadas = delHito.filter((t) => t.estado === 'TERMINADA').length;
    return { total: delHito.length, terminadas, porcentaje: delHito.length === 0 ? 0 : Math.round((terminadas / delHito.length) * 100) };
  };

  return (
    <Card
      titulo="Hitos"
      descripcion="Entregas o cortes de facturación del proyecto."
      acciones={
        <RequierePermiso permiso="proyectos.crear">
          <Button onClick={() => setModalAbierto(true)}>Nuevo hito</Button>
        </RequierePermiso>
      }
    >
      <div className="space-y-2">
        {hitos.length === 0 && <EstadoVacio titulo="Sin hitos todavía" />}
        {hitos.map((h) => {
          const costo = costoPorHito?.[h.id];
          const montoInsuficiente = costo && costo.horasTotales > 0 && h.montoFijo != null && Number(h.montoFijo) < costo.costoHoras;
          const progreso = progresoHito(h.id);
          return (
          <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{h.nombre}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {h.fechaObjetivo && `Vence ${new Date(h.fechaObjetivo).toLocaleDateString('es-DO')}`}
                {h.fechaObjetivo && h.montoFijo && ' · '}
                {h.montoFijo && `RD$ ${Number(h.montoFijo).toLocaleString('es-DO')}`}
                {(h.fechaObjetivo || h.montoFijo) && progreso.total > 0 && ' · '}
                {progreso.total > 0 && `${progreso.terminadas}/${progreso.total} tarea(s) · ${progreso.porcentaje}% completado`}
              </p>
              {puedeVerCosto && costo && costo.horasTotales > 0 && (
                <p className={clsx('mt-0.5 text-xs', montoInsuficiente ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500')}>
                  Costo interno de horas trabajadas: RD$ {costo.costoHoras.toLocaleString('es-DO', { maximumFractionDigits: 0 })} ({costo.horasTotales}h)
                  {montoInsuficiente && ' — supera el monto fijo pactado'}
                </p>
              )}
              {h.facturaId && (
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  Ya facturado — para revertirlo, anular la factura desde Facturación.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!h.facturaId && (
                <RequierePermiso permiso="proyectos.facturar">
                  <Button type="button" variante="secundario" onClick={() => setHitoAFacturar(h)}>
                    Facturar
                  </Button>
                </RequierePermiso>
              )}
              <Select
                value={h.estado}
                onChange={(e) => cambiarEstadoHito.mutate({ hitoId: h.id, estado: e.target.value })}
                disabled={!!h.facturaId}
                className="w-auto"
              >
                {ESTADOS_HITO.map((estado) => (
                  <option key={estado} value={estado}>
                    {ETIQUETA_ESTADO_HITO[estado]}
                  </option>
                ))}
              </Select>
              <RequierePermiso permiso="proyectos.editar">
                <RowActionsMenu
                  acciones={[
                    { etiqueta: 'Editar', onClick: () => setHitoEditando(h) },
                    { etiqueta: 'Eliminar', tono: 'peligro', onClick: () => setHitoAEliminar(h) },
                  ]}
                />
              </RequierePermiso>
            </div>
          </div>
          );
        })}
      </div>

      {modalAbierto && (
        <HitoFormModal
          guardando={crearHito.isPending}
          error={errorForm}
          onClose={() => {
            setModalAbierto(false);
            setErrorForm(null);
          }}
          onGuardar={(valores) => crearHito.mutate(valores)}
        />
      )}

      {hitoEditando && (
        <HitoFormModal
          hitoInicial={hitoEditando}
          guardando={editarHito.isPending}
          error={errorForm}
          onClose={() => {
            setHitoEditando(null);
            setErrorForm(null);
          }}
          onGuardar={(valores) => editarHito.mutate(valores)}
        />
      )}

      {hitoAFacturar && (
        <FacturarHitoModal
          hitoId={hitoAFacturar.id}
          confirmando={facturarHito.isPending}
          onConfirmar={() => facturarHito.mutate(hitoAFacturar.id)}
          onCancelar={() => setHitoAFacturar(null)}
        />
      )}

      {hitoAEliminar && (
        <ConfirmModal
          titulo="¿Eliminar este hito?"
          descripcion={
            <>
              Se eliminará <b>{hitoAEliminar.nombre}</b> y las tareas que lo tengan asignado quedarán sin hito.
              {hitoAEliminar.facturaId && (
                <p className="mt-2 text-amber-600 dark:text-amber-400">
                  Este hito ya tiene una factura generada — eliminarlo no anula esa factura, solo el hito.
                </p>
              )}
            </>
          }
          confirmando={eliminarHito.isPending}
          onConfirmar={() => eliminarHito.mutate(hitoAEliminar.id)}
          onCancelar={() => setHitoAEliminar(null)}
        />
      )}
    </Card>
  );
}
