import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { ESTADOS_HITO, ETIQUETA_ESTADO_HITO, Hito } from '../../../types/proyectos';

interface ProyectoHitosTabProps {
  proyectoId: string;
  hitos: Hito[];
  onInvalidar: () => void;
  onError: (mensaje: string | null) => void;
  onFacturado: (mensaje: string) => void;
}

export function ProyectoHitosTab({ proyectoId, hitos, onInvalidar, onError, onFacturado }: ProyectoHitosTabProps) {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [hitoEditando, setHitoEditando] = useState<Hito | null>(null);
  const [hitoAEliminar, setHitoAEliminar] = useState<Hito | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);

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
      invalidar();
    },
    onError: (err) => onError(mensajeErrorApi(err, 'No se pudo facturar el hito.')),
  });

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
        {hitos.map((h) => (
          <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{h.nombre}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {h.fechaObjetivo && `Vence ${new Date(h.fechaObjetivo).toLocaleDateString('es-DO')}`}
                {h.fechaObjetivo && h.montoFijo && ' · '}
                {h.montoFijo && `RD$ ${Number(h.montoFijo).toLocaleString('es-DO')}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!h.facturaId && (
                <RequierePermiso permiso="proyectos.facturar">
                  <Button
                    type="button"
                    variante="secundario"
                    onClick={() => facturarHito.mutate(h.id)}
                    disabled={facturarHito.isPending}
                  >
                    {facturarHito.isPending ? 'Facturando…' : 'Facturar'}
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
        ))}
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
