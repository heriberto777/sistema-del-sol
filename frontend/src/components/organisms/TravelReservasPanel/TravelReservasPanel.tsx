import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Receipt, Trash2, X } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { formatoMoneda } from '../../../lib/formato-moneda-travel';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { Input } from '../../atoms/Input/Input';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { ConfirmModal } from '../../molecules/ConfirmModal/ConfirmModal';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { SelectorClienteConCrear, type ClienteOpcion } from '../../molecules/SelectorClienteConCrear/SelectorClienteConCrear';
import {
  COLOR_ESTADO_TRAVEL_RESERVA,
  ESTADOS_TRAVEL_RESERVA,
  ETIQUETA_ESTADO_TRAVEL_RESERVA,
  ETIQUETA_TIPO_TRAVEL_RESERVA,
  TIPOS_TRAVEL_RESERVA,
  TravelReserva,
} from '../../../types/travel';

const FORM_VACIO = {
  clienteId: '',
  tipo: TIPOS_TRAVEL_RESERVA[0] as (typeof TIPOS_TRAVEL_RESERVA)[number],
  moneda: 'DOP',
  montoCosto: '',
  montoVenta: '',
  notas: '',
  pasajeroNombre: '',
  pasajeroApellido: '',
};
type FormReserva = typeof FORM_VACIO;

/**
 * Extraído de TravelReservas.tsx (auditoría UX Fase 5) — listado de
 * reservas + carga manual. Antes vivía inline dentro del componente
 * principal, mezclado con el switch de las 5 pestañas.
 */
export function TravelReservasPanel() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aEliminar, setAEliminar] = useState<TravelReserva | null>(null);
  const [aCancelar, setACancelar] = useState<TravelReserva | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: reservas, isLoading } = useQuery({
    queryKey: ['travel-reservas'],
    queryFn: async () => (await apiClient.get<TravelReserva[]>('/admin/travel/reservas')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['travel-reservas'] });
    queryClient.invalidateQueries({ queryKey: ['travel-ledger'] });
  }

  const crear = useMutation({
    mutationFn: async (form: FormReserva) =>
      apiClient.post('/admin/travel/reservas', {
        clienteId: form.clienteId,
        tipo: form.tipo,
        moneda: form.moneda,
        montoCosto: Number(form.montoCosto),
        montoVenta: Number(form.montoVenta),
        notas: form.notas || undefined,
        pasajeros: form.pasajeroNombre && form.pasajeroApellido ? [{ nombre: form.pasajeroNombre, apellido: form.pasajeroApellido }] : [],
      }),
    onSuccess: () => {
      setModalAbierto(false);
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la reserva.')),
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => apiClient.patch(`/admin/travel/reservas/${id}`, { estado }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el estado.')),
  });

  const facturar = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/admin/travel/reservas/${id}/facturar`),
    onSuccess: () => {
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo facturar la reserva.')),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/travel/reservas/${id}`),
    onSuccess: () => {
      setAEliminar(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar la reserva.')),
  });

  const descartarAlerta = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/admin/travel/reservas/${id}/alerta/descartar`),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo descartar la alerta.')),
  });

  const lista = reservas ?? [];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Card
        sinPadding
        titulo="Reservas"
        acciones={
          tienePermiso('travel.crear') && (
            <Button onClick={() => setModalAbierto(true)} className="flex items-center gap-1.5">
              <Plus size={16} />
              Carga manual
            </Button>
          )
        }
      >
        {isLoading && <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
        {!isLoading && lista.length === 0 && (
          <EstadoVacio titulo="Sin reservas todavía" descripcion='Buscá un vuelo en la pestaña "Buscar vuelo" o cargá una reserva manual.' />
        )}
        {!isLoading && lista.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Venta</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lista.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.codigoInterno}</p>
                      {r.localizadorAerolinea && <p className="text-[10px] text-slate-400">Loc: {r.localizadorAerolinea}</p>}
                      {r.alertaProveedorTipo && (
                        <div className="mt-1 flex items-start gap-1 rounded bg-amber-50 px-1.5 py-1 text-[10px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          <span className="flex-1">{r.alertaProveedorDetalle}</span>
                          {tienePermiso('travel.editar') && (
                            <button
                              type="button"
                              onClick={() => descartarAlerta.mutate(r.id)}
                              disabled={descartarAlerta.isPending}
                              className="shrink-0 underline hover:no-underline"
                            >
                              Descartar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-800 dark:text-slate-100">{r.cliente.nombre}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {ETIQUETA_TIPO_TRAVEL_RESERVA[r.tipo]}
                      {r.proveedor && (
                        <span className="ml-1.5 rounded-full bg-sol-50 px-1.5 py-0.5 text-[10px] font-semibold text-sol-700 dark:bg-sol-500/10 dark:text-sol-300">
                          {r.proveedor}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {r.estado === 'FACTURADA' || r.estado === 'CANCELADA' ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO_TRAVEL_RESERVA[r.estado]}`}>
                          {ETIQUETA_ESTADO_TRAVEL_RESERVA[r.estado]}
                        </span>
                      ) : r.proveedor ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO_TRAVEL_RESERVA[r.estado]}`}>
                          {ETIQUETA_ESTADO_TRAVEL_RESERVA[r.estado]}
                        </span>
                      ) : (
                        <Select
                          value={r.estado}
                          onChange={(e) => cambiarEstado.mutate({ id: r.id, estado: e.target.value })}
                          className="!w-auto py-1 text-xs"
                        >
                          {ESTADOS_TRAVEL_RESERVA.filter((es) => es !== 'FACTURADA').map((es) => (
                            <option key={es} value={es}>
                              {ETIQUETA_ESTADO_TRAVEL_RESERVA[es]}
                            </option>
                          ))}
                        </Select>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-800 dark:text-slate-100">{formatoMoneda(r.montoVenta, r.moneda)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {!r.facturaId && r.estado !== 'CANCELADA' && tienePermiso('travel.facturar') && (
                          <button
                            type="button"
                            onClick={() => facturar.mutate(r.id)}
                            disabled={facturar.isPending}
                            className="text-slate-400 hover:text-sol-600"
                            aria-label="Facturar"
                            title="Facturar"
                          >
                            <Receipt size={16} />
                          </button>
                        )}
                        {r.proveedor && r.estado === 'CONFIRMADA' && tienePermiso('travel.cancelar') && (
                          <button
                            type="button"
                            onClick={() => setACancelar(r)}
                            className="text-slate-400 hover:text-red-600"
                            aria-label="Cancelar"
                            title="Cancelar contra el proveedor"
                          >
                            <X size={16} />
                          </button>
                        )}
                        {!r.proveedor && r.estado !== 'FACTURADA' && tienePermiso('travel.eliminar') && (
                          <button
                            type="button"
                            onClick={() => setAEliminar(r)}
                            className="text-slate-300 hover:text-red-600"
                            aria-label="Eliminar"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalAbierto && (
        <ReservaFormModal
          guardando={crear.isPending}
          error={error}
          onClose={() => setModalAbierto(false)}
          onGuardar={(form) => crear.mutate(form)}
        />
      )}

      {aEliminar && (
        <ConfirmModal
          titulo="Eliminar reserva"
          descripcion={`¿Eliminar la reserva ${aEliminar.codigoInterno}? Esta acción no se puede deshacer.`}
          confirmando={eliminar.isPending}
          onConfirmar={() => eliminar.mutate(aEliminar.id)}
          onCancelar={() => setAEliminar(null)}
        />
      )}

      {aCancelar && (
        <CancelarReservaModal
          reserva={aCancelar}
          onClose={() => setACancelar(null)}
          onCancelada={() => {
            setACancelar(null);
            invalidar();
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Alta manual (Fase 0) — sin cambios de fondo                       */
/* ---------------------------------------------------------------- */

function ReservaFormModal({
  guardando,
  error,
  onClose,
  onGuardar,
}: {
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onGuardar: (form: FormReserva) => void;
}) {
  const [form, setForm] = useState<FormReserva>(FORM_VACIO);
  const [cliente, setCliente] = useState<ClienteOpcion | null>(null);
  const [sugiriendo, setSugiriendo] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar(form);
  }

  return (
    <Modal titulo="Nueva reserva manual" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <SelectorClienteConCrear
          cliente={cliente}
          onSeleccionar={(c) => {
            setCliente(c);
            setForm((f) => ({ ...f, clienteId: c?.id ?? '' }));
          }}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
            <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as FormReserva['tipo'] })}>
              {TIPOS_TRAVEL_RESERVA.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_TRAVEL_RESERVA[t]}
                </option>
              ))}
            </Select>
          </div>
          <FormField
            label="Moneda"
            value={form.moneda}
            onChange={(e) => setForm({ ...form, moneda: e.target.value.toUpperCase() })}
            maxLength={3}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Costo (proveedor)"
            type="number"
            min="0"
            step="0.01"
            value={form.montoCosto}
            onChange={(e) => setForm({ ...form, montoCosto: e.target.value })}
            required
          />
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Venta (al cliente)</label>
              <button
                type="button"
                disabled={!form.montoCosto || sugiriendo}
                onClick={async () => {
                  setSugiriendo(true);
                  try {
                    const r = await apiClient.get<{ montoVentaSugerido: number }>('/admin/travel/markup/sugerir', {
                      params: { tipo: form.tipo, montoCosto: form.montoCosto },
                    });
                    setForm((f) => ({ ...f, montoVenta: String(r.data.montoVentaSugerido) }));
                  } catch {
                    /* silencioso — el campo sigue editable a mano */
                  } finally {
                    setSugiriendo(false);
                  }
                }}
                className="text-xs font-medium text-sol-600 hover:underline disabled:opacity-50 dark:text-sol-400"
              >
                {sugiriendo ? 'Calculando…' : 'Sugerir'}
              </button>
            </div>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.montoVenta}
              onChange={(e) => setForm({ ...form, montoVenta: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas (opcional)</label>
          <textarea
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Pasajero principal (opcional)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Nombre" value={form.pasajeroNombre} onChange={(e) => setForm({ ...form, pasajeroNombre: e.target.value })} />
            <FormField label="Apellido" value={form.pasajeroApellido} onChange={(e) => setForm({ ...form, pasajeroApellido: e.target.value })} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando || !form.clienteId || !form.montoCosto || !form.montoVenta}>
            {guardando ? 'Guardando…' : 'Crear reserva'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */
/* Cancelación real (Fase 1b) — cotizar + confirmar, 2 pasos          */
/* ---------------------------------------------------------------- */

function CancelarReservaModal({ reserva, onClose, onCancelada }: { reserva: TravelReserva; onClose: () => void; onCancelada: () => void }) {
  const [error, setError] = useState<string | null>(null);

  const cotizar = useMutation({
    mutationFn: async () => (await apiClient.post<{ id: string; montoReembolso: string | null; moneda: string | null }>(`/admin/travel/reservas/${reserva.id}/cancelacion/cotizar`)).data,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cotizar la cancelación.')),
  });

  const confirmar = useMutation({
    mutationFn: async () => apiClient.post(`/admin/travel/reservas/${reserva.id}/cancelacion/confirmar`),
    onSuccess: onCancelada,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo confirmar la cancelación.')),
  });

  useEffect(() => {
    cotizar.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal titulo={`Cancelar ${reserva.codigoInterno}`} onClose={onClose}>
      <div className="space-y-4">
        {cotizar.isPending && <p className="text-sm text-slate-500 dark:text-slate-400">Cotizando el reembolso con el proveedor…</p>}

        {cotizar.data && (
          <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
            {cotizar.data.montoReembolso ? (
              <p className="text-slate-700 dark:text-slate-200">
                Reembolso estimado: <strong>{cotizar.data.moneda} {Number(cotizar.data.montoReembolso).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</strong>
              </p>
            ) : (
              <p className="text-amber-700 dark:text-amber-400">Esta tarifa no es reembolsable — no habrá devolución al Balance.</p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Volver
          </Button>
          <Button type="button" variante="peligro" disabled={!cotizar.data || confirmar.isPending} onClick={() => confirmar.mutate()}>
            {confirmar.isPending ? 'Confirmando…' : 'Confirmar cancelación'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
