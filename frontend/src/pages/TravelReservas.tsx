import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, BedDouble, Clock, DollarSign, Plane, Plus, Receipt, Trash2, Wallet, X } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Input } from '../components/atoms/Input/Input';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { ConfirmModal } from '../components/molecules/ConfirmModal/ConfirmModal';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { StatCard } from '../components/molecules/StatCard/StatCard';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { PaginaResultado } from '../types/pagina-resultado';
import {
  COLOR_ESTADO_TRAVEL_RESERVA,
  ESTADOS_TRAVEL_RESERVA,
  ETIQUETA_ESTADO_TRAVEL_RESERVA,
  ETIQUETA_TIPO_TRAVEL_RESERVA,
  HotelListado,
  OfertaVuelo,
  ResultadoBusquedaHoteles,
  ResultadoBusquedaVuelos,
  TarifaHotel,
  TIPOS_TRAVEL_RESERVA,
  TravelReglaMarkup,
  TravelReserva,
} from '../types/travel';

interface ClienteOpcion {
  id: string;
  nombre: string;
}

/* ---------------------------------------------------------------- */
/* Alta manual (Fase 0) — sin cambios de fondo                       */
/* ---------------------------------------------------------------- */

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
  const [sugiriendo, setSugiriendo] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar(form);
  }

  return (
    <Modal titulo="Nueva reserva manual" onClose={onClose}>
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

/* ---------------------------------------------------------------- */
/* Saldo del ledger — Balance compartido de la plataforma             */
/* ---------------------------------------------------------------- */

interface ResumenTravel {
  reservasPorEstado: Record<string, number>;
  ingresosMes: number;
  pendientesDeFacturar: number;
  saldoLedger: { moneda: string; saldo: number }[];
}

function ResumenTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['travel-resumen'],
    queryFn: async () => (await apiClient.get<ResumenTravel>('/admin/travel/reservas/resumen')).data,
  });

  if (isLoading || !data) return <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  const totalReservas = Object.values(data.reservasPorEstado).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard etiqueta="Reservas totales" valor={String(totalReservas)} icono={Plane} />
        <StatCard etiqueta="Ingresos facturados (mes)" valor={formatoMoneda(String(data.ingresosMes), 'DOP')} icono={DollarSign} />
        <StatCard etiqueta="Confirmadas sin facturar" valor={String(data.pendientesDeFacturar)} icono={Clock} />
        <StatCard
          etiqueta="Saldo vs. Balance Duffel"
          valor={data.saldoLedger.length === 0 ? '—' : data.saldoLedger.map((s) => `${s.moneda} ${s.saldo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`).join(' · ')}
          icono={Wallet}
        />
      </div>

      <Card titulo="Reservas por estado">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ESTADOS_TRAVEL_RESERVA.map((estado) => (
            <div key={estado} className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800/60">
              <p className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO_TRAVEL_RESERVA[estado]}`}>{ETIQUETA_ESTADO_TRAVEL_RESERVA[estado]}</p>
              <p className="mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100">{data.reservasPorEstado[estado] ?? 0}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const FORM_REGLA_VACIA = { tipo: '', porcentaje: '', montoFijo: '' };

function MarkupTab() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [form, setForm] = useState(FORM_REGLA_VACIA);
  const [error, setError] = useState<string | null>(null);

  const { data: reglas, isLoading } = useQuery({
    queryKey: ['travel-markup'],
    queryFn: async () => (await apiClient.get<TravelReglaMarkup[]>('/admin/travel/markup')).data,
  });

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/admin/travel/markup', {
        tipo: form.tipo || undefined,
        ...(form.porcentaje !== '' ? { porcentaje: Number(form.porcentaje) } : {}),
        ...(form.montoFijo !== '' ? { montoFijo: Number(form.montoFijo) } : {}),
      }),
    onSuccess: () => {
      setForm(FORM_REGLA_VACIA);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['travel-markup'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la regla.')),
  });

  const toggleActiva = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => apiClient.patch(`/admin/travel/markup/${id}`, { activa }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['travel-markup'] }),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar la regla.')),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/travel/markup/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['travel-markup'] }),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar la regla.')),
  });

  const lista = reglas ?? [];
  const puedeGestionar = tienePermiso('travel.markup');

  return (
    <div className="space-y-4">
      {puedeGestionar && (
        <Card titulo="Nueva regla de markup" descripcion="Sugiere el precio de venta al reservar — nunca lo aplica solo, siempre editable.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crear.mutate();
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end"
          >
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
              <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="">Global (VUELO + HOTEL)</option>
                {TIPOS_TRAVEL_RESERVA.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_TIPO_TRAVEL_RESERVA[t]}
                  </option>
                ))}
              </Select>
            </div>
            <FormField
              label="Porcentaje (%)"
              type="number"
              step="0.01"
              value={form.porcentaje}
              onChange={(e) => setForm({ ...form, porcentaje: e.target.value, montoFijo: '' })}
              placeholder="ej. 15"
            />
            <FormField
              label="Monto fijo"
              type="number"
              step="0.01"
              value={form.montoFijo}
              onChange={(e) => setForm({ ...form, montoFijo: e.target.value, porcentaje: '' })}
              placeholder="ej. 30"
            />
            <Button type="submit" disabled={crear.isPending || (!form.porcentaje && !form.montoFijo)}>
              {crear.isPending ? 'Creando…' : 'Crear regla'}
            </Button>
          </form>
          <p className="mt-2 text-xs text-slate-400">Exactamente uno de los dos campos — porcentaje o monto fijo, nunca ambos.</p>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </Card>
      )}

      <Card sinPadding>
        {isLoading && <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
        {!isLoading && lista.length === 0 && (
          <EstadoVacio titulo="Sin reglas de markup" descripcion="Sin ninguna regla activa, el precio de venta sugerido es igual al costo (0% de markup)." />
        )}
        {!isLoading && lista.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Markup</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lista.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 text-slate-800 dark:text-slate-100">{r.tipo ? ETIQUETA_TIPO_TRAVEL_RESERVA[r.tipo] : 'Global'}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{r.porcentaje ? `+${r.porcentaje}%` : `+${r.montoFijo} (fijo)`}</td>
                  <td className="px-5 py-3">
                    {puedeGestionar ? (
                      <button
                        type="button"
                        onClick={() => toggleActiva.mutate({ id: r.id, activa: !r.activa })}
                        className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', r.activa ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}
                      >
                        {r.activa ? 'Activa' : 'Inactiva'}
                      </button>
                    ) : (
                      <span>{r.activa ? 'Activa' : 'Inactiva'}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {puedeGestionar && (
                      <button type="button" onClick={() => eliminar.mutate(r.id)} className="text-slate-400 hover:text-red-600" aria-label="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function SaldoLedger() {
  const { data } = useQuery({
    queryKey: ['travel-ledger'],
    queryFn: async () => (await apiClient.get<{ moneda: string; saldo: number }[]>('/admin/travel/ledger')).data,
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="font-medium">Saldo vs. Balance Duffel:</span>
      {data.map((s) => (
        <span key={s.moneda} className={clsx('rounded-full px-2 py-0.5 font-mono font-semibold', s.saldo < 0 ? 'bg-slate-100 dark:bg-slate-800' : 'bg-emerald-100 dark:bg-emerald-500/10')}>
          {s.moneda} {s.saldo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Buscar vuelo (Fase 2) — búsqueda + reserva reales                  */
/* ---------------------------------------------------------------- */

const FORM_BUSQUEDA_VACIO = {
  tipoViaje: 'ida' as 'ida' | 'ida_vuelta',
  origen: '',
  destino: '',
  fechaSalida: '',
  fechaRegreso: '',
  adultos: 1,
  // Edad exacta de cada niño/bebé — Duffel resuelve el tipo (child/infant_without_seat) según la edad, no hay que elegirlo a mano.
  ninos: [] as number[],
  infantes: [] as number[],
  cabina: 'economy' as 'economy' | 'premium_economy' | 'business' | 'first',
};

/** "PT9H30M" -> "9h 30m" — Duffel siempre manda duración ISO 8601. */
function formatoDuracionIso(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  const partes = [match?.[1] ? `${match[1]}h` : '', match?.[2] ? `${match[2]}m` : ''].filter(Boolean);
  return partes.length ? partes.join(' ') : iso;
}

/** Los horarios de Duffel no traen offset (hora local del aeropuerto) — nunca pasar por Date(), solo recortar el string. */
function formatoHoraVuelo(iso: string): string {
  return iso.slice(11, 16);
}

const ETIQUETA_TIPO_PASAJERO: Record<string, string> = { adult: 'Adulto', child: 'Niño', infant_without_seat: 'Bebé' };

function TarjetaOferta({ oferta, onReservar }: { oferta: OfertaVuelo; onReservar: () => void }) {
  const minutosParaExpirar = Math.max(0, Math.round((new Date(oferta.expiraEn).getTime() - Date.now()) / 60_000));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="space-y-3">
        {oferta.tramosCrudo.map((tramo) => (
          <div key={tramo.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {tramo.origin.iata_code} {formatoHoraVuelo(tramo.segments[0]?.departing_at ?? '')} → {tramo.destination.iata_code}{' '}
              {formatoHoraVuelo(tramo.segments[tramo.segments.length - 1]?.arriving_at ?? '')}
            </span>
            <span className="text-slate-400">{formatoDuracionIso(tramo.duration)}</span>
            <span className="text-slate-400">{tramo.segments.length === 1 ? 'Directo' : `${tramo.segments.length - 1} escala(s)`}</span>
            <span className="text-slate-500 dark:text-slate-400">{tramo.segments[0]?.marketing_carrier.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <span className="text-[11px] text-slate-400">Oferta válida por {minutosParaExpirar} min</span>
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {oferta.moneda} {Number(oferta.montoTotal).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </span>
          <Button type="button" onClick={onReservar}>
            Reservar
          </Button>
        </div>
      </div>
    </div>
  );
}

interface FormPasajero {
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  genero: 'm' | 'f';
  titulo: string;
  email: string;
  telefono: string;
  // Pasaporte (APIS) — opcional, recomendado para vuelos internacionales. Si se completa uno de los 3, hay que completar los 3 (ver DTO backend).
  numeroPasaporte: string;
  paisEmisionPasaporte: string;
  fechaVencimientoPasaporte: string;
}
const PASAJERO_VACIO: FormPasajero = {
  nombre: '',
  apellido: '',
  fechaNacimiento: '',
  genero: 'm',
  titulo: 'mr',
  email: '',
  telefono: '',
  numeroPasaporte: '',
  paisEmisionPasaporte: '',
  fechaVencimientoPasaporte: '',
};
const TITULOS_PASAJERO: { valor: string; etiqueta: string }[] = [
  { valor: 'mr', etiqueta: 'Sr.' },
  { valor: 'mrs', etiqueta: 'Sra.' },
  { valor: 'ms', etiqueta: 'Srta.' },
  { valor: 'miss', etiqueta: 'Srta. (joven)' },
  { valor: 'dr', etiqueta: 'Dr./Dra.' },
];

function ReservarOfertaModal({
  oferta,
  clientes,
  guardando,
  error,
  onClose,
  onGuardar,
}: {
  oferta: OfertaVuelo;
  clientes: ClienteOpcion[] | undefined;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onGuardar: (dto: {
    clienteId: string;
    montoVenta: number;
    notas?: string;
    pasajeros: ({ id: string; infantePasajeroId?: string } & Omit<FormPasajero, 'numeroPasaporte' | 'paisEmisionPasaporte' | 'fechaVencimientoPasaporte'> &
      Partial<Pick<FormPasajero, 'numeroPasaporte' | 'paisEmisionPasaporte' | 'fechaVencimientoPasaporte'>>)[];
  }) => void;
}) {
  const pasajeroIds = oferta.pasajeros.map((p) => p.id);
  const adultoIds = oferta.pasajeros.filter((p) => p.tipo === 'adult').map((p) => p.id);
  const infanteIds = oferta.pasajeros.filter((p) => p.tipo === 'infant_without_seat').map((p) => p.id);
  const [clienteId, setClienteId] = useState('');
  const [montoVenta, setMontoVenta] = useState(oferta.montoTotal);
  const [notas, setNotas] = useState('');
  const [pasajeros, setPasajeros] = useState<Record<string, FormPasajero>>(Object.fromEntries(pasajeroIds.map((id) => [id, { ...PASAJERO_VACIO }])));
  // Duffel exige vincular cada bebé (infant_without_seat) a un adulto responsable — clave: id del bebé, valor: id del adulto elegido.
  const [infanteAdultoMap, setInfanteAdultoMap] = useState<Record<string, string>>({});

  // Markup automático — solo sugiere el punto de partida, el campo sigue 100% editable.
  useEffect(() => {
    apiClient
      .get<{ montoVentaSugerido: number }>('/admin/travel/markup/sugerir', { params: { tipo: 'VUELO', montoCosto: oferta.montoTotal } })
      .then((r) => setMontoVenta(String(r.data.montoVentaSugerido)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function actualizarPasajero(id: string, campo: keyof FormPasajero, valor: string) {
    setPasajeros((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  }

  const completo =
    clienteId &&
    montoVenta &&
    pasajeroIds.every((id) => pasajeros[id].nombre && pasajeros[id].apellido && pasajeros[id].fechaNacimiento && pasajeros[id].email && pasajeros[id].telefono) &&
    infanteIds.every((id) => infanteAdultoMap[id]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Invertido: por cada bebé, el vínculo va en el pasajero ADULTO (infantePasajeroId = id del bebé) — así lo exige Duffel.
    const adultoAInfante = Object.fromEntries(Object.entries(infanteAdultoMap).map(([infanteId, adultoId]) => [adultoId, infanteId]));

    onGuardar({
      clienteId,
      montoVenta: Number(montoVenta),
      notas: notas || undefined,
      pasajeros: pasajeroIds.map((id) => {
        // Nunca mandar strings vacíos en campos opcionales con validación de formato (ej. @Length(2,2))
        // — "" no es lo mismo que "no lo mandes" para class-validator, hay que omitir la clave entera.
        const { numeroPasaporte, paisEmisionPasaporte, fechaVencimientoPasaporte, ...resto } = pasajeros[id];
        const tienePasaporte = numeroPasaporte && paisEmisionPasaporte && fechaVencimientoPasaporte;
        return {
          id,
          ...resto,
          ...(tienePasaporte ? { numeroPasaporte, paisEmisionPasaporte, fechaVencimientoPasaporte } : {}),
          ...(adultoAInfante[id] ? { infantePasajeroId: adultoAInfante[id] } : {}),
        };
      }),
    });
  }

  return (
    <Modal titulo="Reservar vuelo" onClose={onClose} ancho="xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          {oferta.tramosCrudo.map((t) => (
            <p key={t.id} className="text-slate-600 dark:text-slate-300">
              {t.origin.iata_code} → {t.destination.iata_code} · {formatoHoraVuelo(t.segments[0]?.departing_at ?? '')}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
              <option value="">Seleccioná un cliente…</option>
              {clientes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>
          <FormField
            label={`Venta al cliente (costo: ${oferta.moneda} ${oferta.montoTotal})`}
            type="number"
            min="0"
            step="0.01"
            value={montoVenta}
            onChange={(e) => setMontoVenta(e.target.value)}
            required
          />
        </div>

        <div className="space-y-3">
          {oferta.pasajeros.map((p, i) => (
            <div key={p.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Pasajero {i + 1} — {ETIQUETA_TIPO_PASAJERO[p.tipo]}
                {p.edad != null && ` (${p.edad} ${p.edad === 1 ? 'año' : 'años'})`}
              </p>
              {p.tipo === 'infant_without_seat' && (
                <div className="mb-3 flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Viaja con (adulto responsable)</label>
                  <Select value={infanteAdultoMap[p.id] ?? ''} onChange={(e) => setInfanteAdultoMap((prev) => ({ ...prev, [p.id]: e.target.value }))} required>
                    <option value="">Seleccioná un adulto…</option>
                    {adultoIds.map((adultoId, j) => (
                      <option key={adultoId} value={adultoId}>
                        Pasajero {oferta.pasajeros.findIndex((pp) => pp.id === adultoId) + 1} (Adulto {j + 1})
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Título</label>
                  <Select value={pasajeros[p.id].titulo} onChange={(e) => actualizarPasajero(p.id, 'titulo', e.target.value)}>
                    {TITULOS_PASAJERO.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.etiqueta}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Género</label>
                  <Select value={pasajeros[p.id].genero} onChange={(e) => actualizarPasajero(p.id, 'genero', e.target.value)}>
                    <option value="m">Masculino</option>
                    <option value="f">Femenino</option>
                  </Select>
                </div>
                <FormField label="Nombre" value={pasajeros[p.id].nombre} onChange={(e) => actualizarPasajero(p.id, 'nombre', e.target.value)} required />
                <FormField label="Apellido" value={pasajeros[p.id].apellido} onChange={(e) => actualizarPasajero(p.id, 'apellido', e.target.value)} required />
                <FormField
                  label="Fecha de nacimiento"
                  type="date"
                  value={pasajeros[p.id].fechaNacimiento}
                  onChange={(e) => actualizarPasajero(p.id, 'fechaNacimiento', e.target.value)}
                  required
                />
                <FormField label="Email" type="email" value={pasajeros[p.id].email} onChange={(e) => actualizarPasajero(p.id, 'email', e.target.value)} required />
                <FormField label="Teléfono" value={pasajeros[p.id].telefono} onChange={(e) => actualizarPasajero(p.id, 'telefono', e.target.value)} required />
              </div>
              <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Pasaporte (opcional — recomendado para vuelos internacionales)</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField
                  label="Número de pasaporte"
                  value={pasajeros[p.id].numeroPasaporte}
                  onChange={(e) => actualizarPasajero(p.id, 'numeroPasaporte', e.target.value)}
                />
                <FormField
                  label="País emisor (ej. DO)"
                  maxLength={2}
                  value={pasajeros[p.id].paisEmisionPasaporte}
                  onChange={(e) => actualizarPasajero(p.id, 'paisEmisionPasaporte', e.target.value.toUpperCase())}
                />
                <FormField
                  label="Vencimiento"
                  type="date"
                  value={pasajeros[p.id].fechaVencimientoPasaporte}
                  onChange={(e) => actualizarPasajero(p.id, 'fechaVencimientoPasaporte', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!completo || guardando}>
            {guardando ? 'Reservando…' : 'Confirmar reserva'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BuscarVueloTab({ clientes }: { clientes: ClienteOpcion[] | undefined }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(FORM_BUSQUEDA_VACIO);
  const [ofertaAReservar, setOfertaAReservar] = useState<OfertaVuelo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buscar = useMutation({
    mutationFn: async () => {
      const tramos =
        form.tipoViaje === 'ida'
          ? [{ origen: form.origen.toUpperCase(), destino: form.destino.toUpperCase(), fecha: form.fechaSalida }]
          : [
              { origen: form.origen.toUpperCase(), destino: form.destino.toUpperCase(), fecha: form.fechaSalida },
              { origen: form.destino.toUpperCase(), destino: form.origen.toUpperCase(), fecha: form.fechaRegreso },
            ];
      return (
        await apiClient.post<ResultadoBusquedaVuelos>('/admin/travel/vuelos/buscar', {
          tramos,
          pasajeros: [
            ...Array.from({ length: form.adultos }, () => ({ tipo: 'adult' })),
            ...form.ninos.map((edad) => ({ edad })),
            ...form.infantes.map((edad) => ({ edad })),
          ],
          cabina: form.cabina,
        })
      ).data;
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo buscar vuelos.')),
  });

  const reservar = useMutation({
    mutationFn: async (dto: Parameters<Parameters<typeof ReservarOfertaModal>[0]['onGuardar']>[0]) =>
      apiClient.post('/admin/travel/reservas/duffel', { ofertaId: ofertaAReservar!.id, ...dto }),
    onSuccess: () => {
      setOfertaAReservar(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['travel-reservas'] });
      queryClient.invalidateQueries({ queryKey: ['travel-ledger'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo reservar el vuelo.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    buscar.mutate();
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={form.tipoViaje === 'ida'} onChange={() => setForm({ ...form, tipoViaje: 'ida' })} />
              Solo ida
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={form.tipoViaje === 'ida_vuelta'} onChange={() => setForm({ ...form, tipoViaje: 'ida_vuelta' })} />
              Ida y vuelta
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <FormField label="Origen (IATA)" value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })} maxLength={3} placeholder="SDQ" required />
            <FormField label="Destino (IATA)" value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} maxLength={3} placeholder="MAD" required />
            <FormField label="Salida" type="date" value={form.fechaSalida} onChange={(e) => setForm({ ...form, fechaSalida: e.target.value })} required />
            {form.tipoViaje === 'ida_vuelta' && (
              <FormField label="Regreso" type="date" value={form.fechaRegreso} onChange={(e) => setForm({ ...form, fechaRegreso: e.target.value })} required />
            )}
            <FormField
              label="Adultos"
              type="number"
              min="1"
              max="9"
              value={form.adultos}
              onChange={(e) => setForm({ ...form, adultos: Number(e.target.value) })}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cabina</label>
              <Select value={form.cabina} onChange={(e) => setForm({ ...form, cabina: e.target.value as typeof form.cabina })}>
                <option value="economy">Económica</option>
                <option value="premium_economy">Premium economy</option>
                <option value="business">Business</option>
                <option value="first">Primera</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Niños (2-17 años)</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, ninos: [...form.ninos, 8] })}
                  disabled={form.ninos.length >= 8}
                  className="text-xs font-medium text-sol-600 hover:underline disabled:opacity-50 dark:text-sol-400"
                >
                  + Agregar niño
                </button>
              </div>
              {form.ninos.map((edad, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={2}
                    max={17}
                    value={edad}
                    onChange={(e) => setForm({ ...form, ninos: form.ninos.map((v, j) => (j === i ? Number(e.target.value) : v)) })}
                  />
                  <button type="button" onClick={() => setForm({ ...form, ninos: form.ninos.filter((_, j) => j !== i) })} aria-label="Quitar niño">
                    <X size={16} className="text-slate-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bebés (0-1 años, en brazos)</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, infantes: [...form.infantes, 1] })}
                  disabled={form.infantes.length >= form.adultos}
                  className="text-xs font-medium text-sol-600 hover:underline disabled:opacity-50 dark:text-sol-400"
                >
                  + Agregar bebé
                </button>
              </div>
              {form.infantes.length >= form.adultos && (
                <p className="text-xs text-slate-400">Cada bebé necesita viajar con un adulto responsable — agregá otro adulto para sumar otro bebé.</p>
              )}
              {form.infantes.map((edad, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    value={edad}
                    onChange={(e) => setForm({ ...form, infantes: form.infantes.map((v, j) => (j === i ? Number(e.target.value) : v)) })}
                  />
                  <button type="button" onClick={() => setForm({ ...form, infantes: form.infantes.filter((_, j) => j !== i) })} aria-label="Quitar bebé">
                    <X size={16} className="text-slate-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={buscar.isPending || !form.origen || !form.destino || !form.fechaSalida} className="flex items-center gap-1.5">
            <Plane size={16} />
            {buscar.isPending ? 'Buscando…' : 'Buscar vuelos'}
          </Button>
        </form>
      </Card>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {buscar.data && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">{buscar.data.ofertas.length} oferta(s) encontrada(s).</p>
          {buscar.data.ofertas.map((oferta) => (
            <TarjetaOferta key={oferta.id} oferta={oferta} onReservar={() => setOfertaAReservar(oferta)} />
          ))}
        </div>
      )}

      {ofertaAReservar && (
        <ReservarOfertaModal
          oferta={ofertaAReservar}
          clientes={clientes}
          guardando={reservar.isPending}
          error={error}
          onClose={() => setOfertaAReservar(null)}
          onGuardar={(dto) => reservar.mutate(dto)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Buscar hotel (Hotelbeds) — búsqueda + reserva real                 */
/* ---------------------------------------------------------------- */

const FORM_BUSQUEDA_HOTEL_VACIO = { destino: '', checkIn: '', checkOut: '', adultos: 2, ninos: 0 };

interface FormHuespedHotel {
  nombre: string;
  apellido: string;
  tipo: 'AD' | 'CH';
}

function TarjetaHotel({ hotel, onReservar }: { hotel: HotelListado; onReservar: (tarifa: TarifaHotel, habitacionNombre: string) => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{hotel.nombre}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {hotel.categoria} · {hotel.destino}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {hotel.habitaciones.map((habitacion) => (
          <div key={habitacion.codigo} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{habitacion.nombre}</p>
            <div className="space-y-1.5">
              {habitacion.tarifas.map((tarifa) => (
                <div key={tarifa.rateKey} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">
                    {tarifa.regimen}
                    {tarifa.reembolsable && <span className="ml-1.5 text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">Reembolsable</span>}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {tarifa.moneda} {Number(tarifa.montoNeto).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                    <Button type="button" onClick={() => onReservar(tarifa, habitacion.nombre)} className="!px-3 !py-1 text-xs">
                      Reservar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReservarHotelModal({
  hotel,
  tarifa,
  huespedesIniciales,
  clientes,
  guardando,
  error,
  onClose,
  onGuardar,
}: {
  hotel: HotelListado;
  tarifa: TarifaHotel;
  huespedesIniciales: FormHuespedHotel[];
  clientes: ClienteOpcion[] | undefined;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onGuardar: (dto: { clienteId: string; rateKey: string; huespedes: FormHuespedHotel[]; montoVenta: number; notas?: string }) => void;
}) {
  const [clienteId, setClienteId] = useState('');
  const [montoVenta, setMontoVenta] = useState(tarifa.montoNeto);
  const [notas, setNotas] = useState('');
  const [huespedes, setHuespedes] = useState<FormHuespedHotel[]>(huespedesIniciales);

  useEffect(() => {
    apiClient
      .get<{ montoVentaSugerido: number }>('/admin/travel/markup/sugerir', { params: { tipo: 'HOTEL', montoCosto: tarifa.montoNeto } })
      .then((r) => setMontoVenta(String(r.data.montoVentaSugerido)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function actualizarHuesped(i: number, campo: keyof FormHuespedHotel, valor: string) {
    setHuespedes((prev) => prev.map((h, j) => (j === i ? { ...h, [campo]: valor } : h)));
  }

  const completo = clienteId && montoVenta && huespedes.every((h) => h.nombre && h.apellido);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar({ clienteId, rateKey: tarifa.rateKey, huespedes, montoVenta: Number(montoVenta), notas: notas || undefined });
  }

  return (
    <Modal titulo="Reservar hotel" onClose={onClose} ancho="xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <p className="font-medium text-slate-800 dark:text-slate-100">{hotel.nombre}</p>
          <p className="text-slate-600 dark:text-slate-300">{tarifa.regimen}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
              <option value="">Seleccioná un cliente…</option>
              {clientes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>
          <FormField
            label={`Venta al cliente (costo: ${tarifa.moneda} ${tarifa.montoNeto})`}
            type="number"
            min="0"
            step="0.01"
            value={montoVenta}
            onChange={(e) => setMontoVenta(e.target.value)}
            required
          />
        </div>

        <div className="space-y-3">
          {huespedes.map((h, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Huésped {i + 1} — {h.tipo === 'AD' ? 'Adulto' : 'Niño'}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Nombre" value={h.nombre} onChange={(e) => actualizarHuesped(i, 'nombre', e.target.value)} required />
                <FormField label="Apellido" value={h.apellido} onChange={(e) => actualizarHuesped(i, 'apellido', e.target.value)} required />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!completo || guardando}>
            {guardando ? 'Reservando…' : 'Confirmar reserva'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BuscarHotelTab({ clientes }: { clientes: ClienteOpcion[] | undefined }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(FORM_BUSQUEDA_HOTEL_VACIO);
  const [seleccion, setSeleccion] = useState<{ hotel: HotelListado; tarifa: TarifaHotel } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buscar = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<ResultadoBusquedaHoteles>('/admin/travel/hoteles/buscar', {
          destino: form.destino.toUpperCase(),
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          habitaciones: 1,
          adultos: form.adultos,
          ninos: form.ninos,
        })
      ).data,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo buscar hoteles.')),
  });

  const reservar = useMutation({
    mutationFn: async (dto: Parameters<Parameters<typeof ReservarHotelModal>[0]['onGuardar']>[0]) => apiClient.post('/admin/travel/reservas/hotelbeds', dto),
    onSuccess: () => {
      setSeleccion(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['travel-reservas'] });
      queryClient.invalidateQueries({ queryKey: ['travel-ledger'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo reservar el hotel.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    buscar.mutate();
  }

  const huespedesIniciales: FormHuespedHotel[] = [
    ...Array.from({ length: form.adultos }, () => ({ nombre: '', apellido: '', tipo: 'AD' as const })),
    ...Array.from({ length: form.ninos }, () => ({ nombre: '', apellido: '', tipo: 'CH' as const })),
  ];

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FormField label="Destino (código Hotelbeds)" value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} maxLength={3} placeholder="PMI" required />
            <FormField label="Check-in" type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} required />
            <FormField label="Check-out" type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} required />
            <FormField label="Adultos" type="number" min="1" max="9" value={form.adultos} onChange={(e) => setForm({ ...form, adultos: Number(e.target.value) })} />
            <FormField label="Niños" type="number" min="0" max="6" value={form.ninos} onChange={(e) => setForm({ ...form, ninos: Number(e.target.value) })} />
          </div>
          <p className="text-xs text-slate-400">Fase 1 — una habitación por reserva.</p>

          <Button type="submit" disabled={buscar.isPending || !form.destino || !form.checkIn || !form.checkOut} className="flex items-center gap-1.5">
            <BedDouble size={16} />
            {buscar.isPending ? 'Buscando…' : 'Buscar hoteles'}
          </Button>
        </form>
      </Card>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {buscar.data && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">{buscar.data.hoteles.length} hotel(es) encontrado(s).</p>
          {buscar.data.hoteles.map((hotel) => (
            <TarjetaHotel key={hotel.codigo} hotel={hotel} onReservar={(tarifa) => setSeleccion({ hotel, tarifa })} />
          ))}
        </div>
      )}

      {seleccion && (
        <ReservarHotelModal
          hotel={seleccion.hotel}
          tarifa={seleccion.tarifa}
          huespedesIniciales={huespedesIniciales}
          clientes={clientes}
          guardando={reservar.isPending}
          error={error}
          onClose={() => setSeleccion(null)}
          onGuardar={(dto) => reservar.mutate(dto)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Página principal — pestañas Reservas / Buscar vuelo               */
/* ---------------------------------------------------------------- */

const VISTAS = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'reservas', etiqueta: 'Reservas' },
  { id: 'buscar', etiqueta: 'Buscar vuelo' },
  { id: 'buscarHotel', etiqueta: 'Buscar hotel' },
  { id: 'markup', etiqueta: 'Markup' },
] as const;
type Vista = (typeof VISTAS)[number]['id'];

export function TravelReservas() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [vista, setVista] = useState<Vista>('reservas');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aEliminar, setAEliminar] = useState<TravelReserva | null>(null);
  const [aCancelar, setACancelar] = useState<TravelReserva | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: reservas, isLoading } = useQuery({
    queryKey: ['travel-reservas'],
    queryFn: async () => (await apiClient.get<TravelReserva[]>('/admin/travel/reservas')).data,
  });

  const { data: clientes } = useQuery({
    queryKey: ['clientes-opciones'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ClienteOpcion>>('/clientes', { params: { tamanoPagina: 200 } })).data.datos,
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
    <RequierePermiso permiso="travel.ver">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Travel Management</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Búsqueda y reserva real de vuelos (Duffel) + carga manual.</p>
          </div>
          {vista === 'reservas' && tienePermiso('travel.crear') && (
            <Button onClick={() => setModalAbierto(true)} className="flex items-center gap-1.5">
              <Plus size={16} />
              Carga manual
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex gap-1 overflow-x-auto">
            {VISTAS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVista(v.id)}
                className={clsx(
                  'shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
                  vista === v.id ? 'border-sol-500 text-sol-600 dark:text-sol-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400',
                )}
              >
                {v.etiqueta}
              </button>
            ))}
          </div>
          <SaldoLedger />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {vista === 'resumen' && <ResumenTab />}
        {vista === 'buscar' && <BuscarVueloTab clientes={clientes} />}
        {vista === 'buscarHotel' && <BuscarHotelTab clientes={clientes} />}
        {vista === 'markup' && <MarkupTab />}

        {vista === 'reservas' && (
          <Card sinPadding>
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
        )}

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
    </RequierePermiso>
  );
}
