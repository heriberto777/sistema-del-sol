import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { ConfirmModal } from '../components/molecules/ConfirmModal/ConfirmModal';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { PaginaResultado } from '../types/pagina-resultado';
import {
  COLOR_ESTADO_TRAVEL_RESERVA,
  ESTADOS_TRAVEL_RESERVA,
  ETIQUETA_ESTADO_TRAVEL_RESERVA,
  ETIQUETA_TIPO_TRAVEL_RESERVA,
  TIPOS_TRAVEL_RESERVA,
  TravelReserva,
} from '../types/travel';

interface ClienteOpcion {
  id: string;
  nombre: string;
}

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

function formatoMoneda(monto: string, moneda: string) {
  return `${moneda} ${Number(monto).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ReservaFormModal({
  clientes,
  guardando,
  error,
  onClose,
  onGuardar,
}: {
  clientes: ClienteOpcion[] | undefined;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onGuardar: (form: FormReserva) => void;
}) {
  const [form, setForm] = useState<FormReserva>(FORM_VACIO);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar(form);
  }

  return (
    <Modal titulo="Nueva reserva" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
          <Select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} required>
            <option value="">Seleccioná un cliente…</option>
            {clientes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>

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
          <FormField
            label="Venta (al cliente)"
            type="number"
            min="0"
            step="0.01"
            value={form.montoVenta}
            onChange={(e) => setForm({ ...form, montoVenta: e.target.value })}
            required
          />
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

export function TravelReservas() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aEliminar, setAEliminar] = useState<TravelReserva | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: reservas, isLoading } = useQuery({
    queryKey: ['travel-reservas'],
    queryFn: async () => (await apiClient.get<TravelReserva[]>('/admin/travel/reservas')).data,
  });

  const { data: clientes } = useQuery({
    queryKey: ['clientes-opciones'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ClienteOpcion>>('/clientes', { params: { tamanoPagina: 200 } })).data.datos,
    enabled: modalAbierto,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['travel-reservas'] });
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

  const lista = reservas ?? [];

  return (
    <RequierePermiso permiso="travel.ver">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Reservas de viaje</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Fase 0 — carga manual, todavía sin buscador de vuelos/hoteles de un proveedor.
            </p>
          </div>
          {tienePermiso('travel.crear') && (
            <Button onClick={() => setModalAbierto(true)} className="flex items-center gap-1.5">
              <Plus size={16} />
              Nueva reserva
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Card sinPadding>
          {isLoading && <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {!isLoading && lista.length === 0 && (
            <EstadoVacio titulo="Sin reservas todavía" descripcion="Creá la primera reserva con el botón de arriba." />
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
                      <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{r.codigoInterno}</td>
                      <td className="px-5 py-3 text-slate-800 dark:text-slate-100">{r.cliente.nombre}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{ETIQUETA_TIPO_TRAVEL_RESERVA[r.tipo]}</td>
                      <td className="px-5 py-3">
                        {r.estado === 'FACTURADA' || r.estado === 'CANCELADA' ? (
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
                          {r.estado !== 'FACTURADA' && tienePermiso('travel.eliminar') && (
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
            clientes={clientes}
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
      </div>
    </RequierePermiso>
  );
}
