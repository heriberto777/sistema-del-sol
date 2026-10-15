import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, ArrowLeftRight, BedDouble, Check, ChevronDown, Clock, DollarSign, Plane, Plus, Receipt, Trash2, User, Users, Wallet, X } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Input } from '../components/atoms/Input/Input';
import { FormField } from '../components/molecules/FormField/FormField';
import { AutocompleteAeropuerto } from '../components/molecules/AutocompleteAeropuerto/AutocompleteAeropuerto';
import { AutocompleteDestinoHotel } from '../components/molecules/AutocompleteDestinoHotel/AutocompleteDestinoHotel';
import { Modal } from '../components/molecules/Modal/Modal';
import { ConfirmModal } from '../components/molecules/ConfirmModal/ConfirmModal';
import { Tabs } from '../components/molecules/Tabs/Tabs';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
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
  TramoVueloCrudo,
  TravelReglaMarkup,
  TravelReserva,
} from '../types/travel';

interface ClienteOpcion {
  id: string;
  nombre: string;
}

/** Texto literal que manda TravelConfigService cuando el tenant no cargó su cuenta — ver obtenerCredencialesDuffel/obtenerCredencialesHotelbeds. */
const SIN_CUENTA_PROPIA = 'todavía no configuró su cuenta de';

/** Error de búsqueda/reserva — si es por falta de cuenta propia, agrega el link directo a Configuración → Viajes en vez de dejar al usuario adivinar qué hacer. */
function ErrorBusquedaTravel({ mensaje }: { mensaje: string }) {
  if (!mensaje.includes(SIN_CUENTA_PROPIA)) {
    return <p className="text-sm text-red-600 dark:text-red-400">{mensaje}</p>;
  }
  return (
    <p className="text-sm text-red-600 dark:text-red-400">
      {mensaje}{' '}
      <Link to="/travel-config" className="font-medium underline">
        Ir a Configuración → Viajes
      </Link>
    </p>
  );
}

/** Buscador con autocompletado (mismo patrón que FacturacionNueva.tsx) + alta rápida inline si el cliente todavía no existe — antes un <select> con hasta 200 clientes sin buscador. */
function SelectorClienteConCrear({ cliente, onSeleccionar }: { cliente: ClienteOpcion | null; onSeleccionar: (c: ClienteOpcion | null) => void }) {
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
      <ComboboxBusqueda<ClienteOpcion>
        valor={cliente}
        onSeleccionar={onSeleccionar}
        obtenerId={(c) => c.id}
        obtenerEtiqueta={(c) => c.nombre}
        placeholder="Buscar cliente…"
        icono={<User size={15} />}
        buscar={async (texto) =>
          (await apiClient.get<PaginaResultado<ClienteOpcion>>('/clientes', { params: { busqueda: texto, tamanoPagina: 10 } })).data.datos
        }
      />
      <button
        type="button"
        onClick={() => setMostrarNuevo((v) => !v)}
        className="self-start text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
      >
        + Nuevo cliente
      </button>
      {mostrarNuevo && (
        <NuevoClienteInline
          onCreado={(c) => {
            onSeleccionar(c);
            setMostrarNuevo(false);
          }}
        />
      )}
    </div>
  );
}

function NuevoClienteInline({ onCreado }: { onCreado: (c: ClienteOpcion) => void }) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () => (await apiClient.post<ClienteOpcion>('/clientes', { nombre, tipo: 'PERSONA_FISICA' })).data,
    onSuccess: (cliente) => onCreado(cliente),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el cliente.')),
  });

  return (
    <div className="mt-1 flex items-end gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800">
      <div className="flex-1">
        <FormField id="travel-nuevo-cliente-nombre" label="Nombre del cliente" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <Button type="button" variante="secundario" disabled={!nombre || crear.isPending} onClick={() => crear.mutate()}>
        Crear
      </Button>
    </div>
  );
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
  // '' = todas las cabinas (Duffel las devuelve mezcladas si no se manda cabin_class) — antes forzaba "economy" de arranque.
  cabina: '' as '' | 'economy' | 'premium_economy' | 'business' | 'first',
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

function minutosDesdeIso(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  return Number(match?.[1] ?? 0) * 60 + Number(match?.[2] ?? 0);
}
function duracionTotalMinutos(oferta: OfertaVuelo): number {
  return oferta.tramosCrudo.reduce((acc, t) => acc + minutosDesdeIso(t.duration), 0);
}
function ofertaEsDirecta(oferta: OfertaVuelo): boolean {
  return oferta.tramosCrudo.every((t) => t.segments.length === 1);
}
function aerolineaDeOferta(oferta: OfertaVuelo): string {
  return oferta.tramosCrudo[0]?.segments[0]?.marketing_carrier.name ?? '—';
}
function logoDeOferta(oferta: OfertaVuelo): string | null {
  return oferta.tramosCrudo[0]?.segments[0]?.marketing_carrier.logo_symbol_url ?? null;
}
/** Mayor cantidad de escalas entre los tramos de la oferta (ej. ida directa + vuelta con 1 escala -> 1). */
function escalasMaxDeOferta(oferta: OfertaVuelo): number {
  return Math.max(0, ...oferta.tramosCrudo.map((t) => t.segments.length - 1));
}

type FranjaHoraria = 'madrugada' | 'manana' | 'tarde' | 'noche';
const FRANJAS_HORARIAS: { id: FranjaHoraria; etiqueta: string; rango: string }[] = [
  { id: 'madrugada', etiqueta: 'Madrugada', rango: '00:00–06:00' },
  { id: 'manana', etiqueta: 'Mañana', rango: '06:00–12:00' },
  { id: 'tarde', etiqueta: 'Tarde', rango: '12:00–18:00' },
  { id: 'noche', etiqueta: 'Noche', rango: '18:00–24:00' },
];
/** Franja horaria de la salida del PRIMER tramo — lo que el usuario ve primero al comparar opciones. */
function franjaHorariaDeOferta(oferta: OfertaVuelo): FranjaHoraria {
  const hora = Number(formatoHoraVuelo(oferta.tramosCrudo[0]?.segments[0]?.departing_at ?? '00:00').slice(0, 2));
  if (hora < 6) return 'madrugada';
  if (hora < 12) return 'manana';
  if (hora < 18) return 'tarde';
  return 'noche';
}

function toggleEnSet<T>(set: Set<T>, valor: T): Set<T> {
  const nuevo = new Set(set);
  if (nuevo.has(valor)) nuevo.delete(valor);
  else nuevo.add(valor);
  return nuevo;
}

const ETIQUETA_TIPO_PASAJERO: Record<string, string> = { adult: 'Adulto', child: 'Niño', infant_without_seat: 'Bebé' };

const ORDENES_VUELO = [
  { id: 'recomendado', etiqueta: 'Recomendado' },
  { id: 'precio', etiqueta: 'Más económico' },
  { id: 'duracion', etiqueta: 'Más rápido' },
] as const;

/** Logo real de la aerolínea (Duffel lo manda por segmento) — si no vino o falla al cargar, cae a las iniciales de siempre. */
function LogoAerolinea({ nombre, logoUrl }: { nombre: string; logoUrl: string | null }) {
  const [fallo, setFallo] = useState(false);
  if (logoUrl && !fallo) {
    return (
      <img
        src={logoUrl}
        alt={nombre}
        className="h-9 w-9 shrink-0 rounded-full border border-slate-100 bg-white object-contain p-1 dark:border-slate-700"
        onError={() => setFallo(true)}
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sol-100 text-xs font-bold text-sol-700 dark:bg-sol-500/10 dark:text-sol-400">
      {nombre.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** "Operado por X" solo cuando la aerolínea que opera el vuelo de verdad (code-share) difiere de la que vendió el ticket — null = no aplica, no mostrar nada. */
function operadoPorDeTramo(tramo: TramoVueloCrudo): string | null {
  const seg = tramo.segments[0];
  if (!seg?.operating_carrier || seg.operating_carrier.iata_code === seg.marketing_carrier.iata_code) return null;
  return seg.operating_carrier.name;
}

/** Nombre comercial de la tarifa (ej. "Economy Light") del primer pasajero/segmento — representativo de toda la oferta, igual criterio que aerolineaDeOferta. */
function nombreTarifaDeOferta(oferta: OfertaVuelo): string | null {
  return oferta.tramosCrudo[0]?.segments[0]?.passengers[0]?.cabin_class_marketing_name ?? null;
}

/** "1 maleta de mano + 1 facturada" — resumen legible del equipaje incluido, o null si Duffel no lo trajo. */
function equipajeDeOferta(oferta: OfertaVuelo): string | null {
  const baggages = oferta.tramosCrudo[0]?.segments[0]?.passengers[0]?.baggages;
  if (!baggages || baggages.length === 0) return null;
  return baggages
    .filter((b) => b.quantity > 0)
    .map((b) => `${b.quantity} maleta${b.quantity === 1 ? '' : 's'} ${b.type === 'checked' ? 'facturada' : 'de mano'}${b.quantity === 1 ? '' : 's'}`)
    .join(' + ');
}

/** Fila de resultado — estilo comparativo (aerolínea/badges + horarios + precio) inspirado en Trip.com. */
function FilaOferta({ oferta, onReservar }: { oferta: OfertaVuelo; onReservar: () => void }) {
  const minutosParaExpirar = Math.max(0, Math.round((new Date(oferta.expiraEn).getTime() - Date.now()) / 60_000));
  const directo = ofertaEsDirecta(oferta);
  const aerolinea = aerolineaDeOferta(oferta);
  const nombreTarifa = nombreTarifaDeOferta(oferta);
  const equipaje = equipajeDeOferta(oferta);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-center gap-2.5 sm:w-40">
        <LogoAerolinea nombre={aerolinea} logoUrl={logoDeOferta(oferta)} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{aerolinea}</p>
          <span
            className={clsx(
              'inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
              directo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800',
            )}
          >
            {directo ? 'Directo' : 'Con escala(s)'}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        {oferta.tramosCrudo.map((tramo) => {
          const operadoPor = operadoPorDeTramo(tramo);
          return (
            <div key={tramo.id}>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {tramo.origin.iata_code} {formatoHoraVuelo(tramo.segments[0]?.departing_at ?? '')} → {tramo.destination.iata_code}{' '}
                  {formatoHoraVuelo(tramo.segments[tramo.segments.length - 1]?.arriving_at ?? '')}
                </span>
                <span className="text-slate-400">{formatoDuracionIso(tramo.duration)}</span>
                <span className="text-slate-400">{tramo.segments.length === 1 ? 'Directo' : `${tramo.segments.length - 1} escala(s)`}</span>
              </div>
              {operadoPor && <p className="text-xs text-slate-400">Operado por {operadoPor}</p>}
            </div>
          );
        })}
        {(nombreTarifa || equipaje) && (
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
            {nombreTarifa && <span className="font-medium">Tarifa {nombreTarifa}</span>}
            {nombreTarifa && equipaje && <span>·</span>}
            {equipaje && <span>{equipaje}</span>}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-100 pt-3 dark:border-slate-800 sm:w-44 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
        <span className="text-[11px] text-slate-400">Válida {minutosParaExpirar} min</span>
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {oferta.moneda} {Number(oferta.montoTotal).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </span>
          <Button type="button" onClick={onReservar}>
            Seleccionar
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
  guardando,
  error,
  onClose,
  onGuardar,
}: {
  oferta: OfertaVuelo;
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
  const [cliente, setCliente] = useState<ClienteOpcion | null>(null);
  const clienteId = cliente?.id ?? '';
  const [montoVenta, setMontoVenta] = useState(oferta.montoTotal);
  const [notas, setNotas] = useState('');
  const [pasajeros, setPasajeros] = useState<Record<string, FormPasajero>>(Object.fromEntries(pasajeroIds.map((id) => [id, { ...PASAJERO_VACIO }])));
  // Duffel exige vincular cada bebé (infant_without_seat) a un adulto responsable — clave: id del bebé, valor: id del adulto elegido.
  const [infanteAdultoMap, setInfanteAdultoMap] = useState<Record<string, string>>({});
  // Separa "cerrar la venta" de "cargar viajeros" — antes todo en un solo scroll largo, con Notas
  // al final después de toda la lista de pasajeros.
  const [pestana, setPestana] = useState<'venta' | 'pasajeros'>('venta');

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
    <Modal titulo="Reservar vuelo" onClose={onClose} ancho="full">
      <form onSubmit={onSubmit} className="space-y-4">
        <Tabs
          pestanas={[
            { id: 'venta', etiqueta: 'Datos de venta' },
            { id: 'pasajeros', etiqueta: `Pasajeros (${oferta.pasajeros.length})` },
          ]}
          activa={pestana}
          onCambiar={setPestana}
        />

        {pestana === 'venta' && (
        <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          {oferta.tramosCrudo.map((t) => (
            <p key={t.id} className="text-slate-600 dark:text-slate-300">
              {t.origin.iata_code} → {t.destination.iata_code} · {formatoHoraVuelo(t.segments[0]?.departing_at ?? '')}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectorClienteConCrear cliente={cliente} onSeleccionar={setCliente} />
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

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        </div>
        )}

        {pestana === 'pasajeros' && (
        <div className="space-y-3">
          {/* Duffel devuelve "phone_number invalid" sin más contexto si no es E.164 — se avisa acá arriba en vez de que el usuario lo descubra recién al chocar con el error. */}
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
            El teléfono de cada pasajero debe llevar el código de país, sin espacios ni guiones — ej. <span className="font-mono">+18095551234</span>.
          </p>
          {oferta.pasajeros.map((p, i) => {
            const completo = !!(pasajeros[p.id].nombre && pasajeros[p.id].apellido && pasajeros[p.id].fechaNacimiento && pasajeros[p.id].email && pasajeros[p.id].telefono);
            return (
              // Antes acordeón (un pasajero a la vez) — con el modal `full` ahora hay espacio
              // de sobra para tener a todos los pasajeros abiertos y visibles al mismo tiempo,
              // sin tener que hacer clic para ver/completar cada uno.
              <div key={p.id} className="rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Pasajero {i + 1} — {ETIQUETA_TIPO_PASAJERO[p.tipo]}
                    {p.edad != null && ` (${p.edad} ${p.edad === 1 ? 'año' : 'años'})`}
                  </span>
                  {completo ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Check size={13} /> Completo
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400">Falta completar</span>
                  )}
                </div>
                <div className="p-3">
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
                  {/* 4 columnas con el modal `full` — antes 3 (2xl) dejaba una fila suelta para 7 campos. */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    <FormField
                      label="Teléfono"
                      type="tel"
                      placeholder="+18095551234"
                      value={pasajeros[p.id].telefono}
                      onChange={(e) => actualizarPasajero(p.id, 'telefono', e.target.value)}
                      required
                    />
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
              </div>
            );
          })}
        </div>
        )}

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

/** Popover "¿Quiénes vuelan?" — mismos datos de siempre (adultos + edad exacta de niños/bebés), agrupados como en Avianca. */
function PasajerosPopover({ form, setForm }: { form: typeof FORM_BUSQUEDA_VACIO; setForm: (f: typeof FORM_BUSQUEDA_VACIO) => void }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  const resumen = [
    `${form.adultos} adulto${form.adultos === 1 ? '' : 's'}`,
    form.ninos.length ? `${form.ninos.length} niño${form.ninos.length === 1 ? '' : 's'}` : null,
    form.infantes.length ? `${form.infantes.length} bebé${form.infantes.length === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div ref={ref} className="relative flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pasajeros</label>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 px-3 py-2 text-left text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <span className="flex items-center gap-1.5 truncate">
          <Users size={14} className="shrink-0 text-slate-400" />
          {resumen}
        </span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </button>

      {abierto && (
        <div className="absolute top-full z-20 mt-1 w-80 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Adultos</p>
              <p className="text-xs text-slate-400">Desde 15 años</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={form.adultos <= 1}
                onClick={() => setForm({ ...form, adultos: form.adultos - 1 })}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 disabled:opacity-30 dark:border-slate-700"
              >
                −
              </button>
              <span className="w-4 text-center font-mono text-sm font-semibold">{form.adultos}</span>
              <button
                type="button"
                disabled={form.adultos >= 9}
                onClick={() => setForm({ ...form, adultos: form.adultos + 1 })}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 disabled:opacity-30 dark:border-slate-700"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Niños</p>
                <p className="text-xs text-slate-400">2 a 17 años</p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, ninos: [...form.ninos, 8] })}
                disabled={form.ninos.length >= 8}
                className="text-xs font-medium text-sol-600 hover:underline disabled:opacity-50 dark:text-sol-400"
              >
                + Agregar
              </button>
            </div>
            {form.ninos.map((edad, i) => (
              <div key={i} className="flex items-center gap-2 pl-1">
                <span className="text-xs text-slate-400">Edad</span>
                <Input
                  type="number"
                  min={2}
                  max={17}
                  value={edad}
                  onChange={(e) => setForm({ ...form, ninos: form.ninos.map((v, j) => (j === i ? Number(e.target.value) : v)) })}
                  className="!w-16 !py-1"
                />
                <button type="button" onClick={() => setForm({ ...form, ninos: form.ninos.filter((_, j) => j !== i) })} aria-label="Quitar niño">
                  <X size={14} className="text-slate-400 hover:text-red-600" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Bebés</p>
                <p className="text-xs text-slate-400">Menores de 2 años, en brazos</p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, infantes: [...form.infantes, 1] })}
                disabled={form.infantes.length >= form.adultos}
                className="text-xs font-medium text-sol-600 hover:underline disabled:opacity-50 dark:text-sol-400"
              >
                + Agregar
              </button>
            </div>
            {form.infantes.length >= form.adultos && (
              <p className="text-xs text-slate-400">Cada bebé necesita viajar con un adulto — agregá otro adulto para sumar otro bebé.</p>
            )}
            {form.infantes.map((edad, i) => (
              <div key={i} className="flex items-center gap-2 pl-1">
                <span className="text-xs text-slate-400">Edad</span>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  value={edad}
                  onChange={(e) => setForm({ ...form, infantes: form.infantes.map((v, j) => (j === i ? Number(e.target.value) : v)) })}
                  className="!w-16 !py-1"
                />
                <button type="button" onClick={() => setForm({ ...form, infantes: form.infantes.filter((_, j) => j !== i) })} aria-label="Quitar bebé">
                  <X size={14} className="text-slate-400 hover:text-red-600" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
}

/** YYYY-MM-DD + N días (puede ser negativo) — sin líos de zona horaria, se arma a mediodía local nomás para el cálculo de calendario. */
function sumarDias(fechaIso: string, dias: number): string {
  const fecha = new Date(`${fechaIso}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

const OFFSETS_MATRIZ_FECHAS = [-3, -2, -1, 0, 1, 2, 3] as const;

/**
 * Barra de precios de días cercanos (±3 días) — dispara una búsqueda
 * liviana por cada día (solo nos interesa el precio más bajo, no el
 * detalle de ofertas) vía useQueries, en paralelo. El día 0 (la fecha ya
 * buscada) NO dispara una llamada extra — reusa el resultado de la
 * búsqueda principal que ya está en pantalla. "Ida y vuelta" desplaza
 * AMBAS fechas por el mismo delta (mantiene la duración del viaje), nunca
 * fija el regreso — variar solo la ida y dejar el regreso fijo daría
 * viajes de duración distinta entre un día y otro, más confuso que útil.
 */
function MatrizFechas({
  form,
  precioActual,
  onSeleccionarFecha,
}: {
  form: typeof FORM_BUSQUEDA_VACIO;
  precioActual: { monto: number; moneda: string } | null;
  onSeleccionarFecha: (fechaSalida: string, fechaRegreso: string) => void;
}) {
  const offsetsAConsultar = OFFSETS_MATRIZ_FECHAS.filter((o) => o !== 0);

  const resultados = useQueries({
    queries: offsetsAConsultar.map((offset) => {
      const fechaSalida = sumarDias(form.fechaSalida, offset);
      const fechaRegreso = form.tipoViaje === 'ida_vuelta' ? sumarDias(form.fechaRegreso, offset) : '';
      return {
        queryKey: [
          'travel-matriz-fechas',
          form.origen,
          form.destino,
          fechaSalida,
          fechaRegreso,
          form.adultos,
          form.ninos,
          form.infantes,
          form.cabina,
        ],
        queryFn: async (): Promise<{ monto: number; moneda: string } | null> => {
          const tramos =
            form.tipoViaje === 'ida'
              ? [{ origen: form.origen.toUpperCase(), destino: form.destino.toUpperCase(), fecha: fechaSalida }]
              : [
                  { origen: form.origen.toUpperCase(), destino: form.destino.toUpperCase(), fecha: fechaSalida },
                  { origen: form.destino.toUpperCase(), destino: form.origen.toUpperCase(), fecha: fechaRegreso },
                ];
          const { data } = await apiClient.post<ResultadoBusquedaVuelos>('/admin/travel/vuelos/buscar', {
            tramos,
            pasajeros: [
              ...Array.from({ length: form.adultos }, () => ({ tipo: 'adult' })),
              ...form.ninos.map((edad) => ({ edad })),
              ...form.infantes.map((edad) => ({ edad })),
            ],
            cabina: form.cabina || undefined,
          });
          if (data.ofertas.length === 0) return null;
          const masBarata = data.ofertas.reduce((min, o) => (Number(o.montoTotal) < Number(min.montoTotal) ? o : min));
          return { monto: Number(masBarata.montoTotal), moneda: masBarata.moneda };
        },
        staleTime: 5 * 60_000,
        retry: false,
      };
    }),
  });

  const dias = OFFSETS_MATRIZ_FECHAS.map((offset) => {
    if (offset === 0) return { offset, precio: precioActual, cargando: false };
    const resultado = resultados[offsetsAConsultar.indexOf(offset)];
    return { offset, precio: resultado?.data ?? null, cargando: resultado?.isLoading ?? false };
  });

  const precioMinimo = Math.min(...dias.map((d) => d.precio?.monto).filter((m): m is number => typeof m === 'number'));

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {dias.map((d, i) => {
        const fecha = sumarDias(form.fechaSalida, d.offset);
        const fechaObj = new Date(`${fecha}T12:00:00`);
        const esActual = d.offset === 0;
        const esMasBarato = !esActual && typeof d.precio?.monto === 'number' && d.precio.monto === precioMinimo;
        return (
          <button
            key={d.offset}
            type="button"
            disabled={esActual}
            onClick={() => onSeleccionarFecha(fecha, form.tipoViaje === 'ida_vuelta' ? sumarDias(form.fechaRegreso, d.offset) : form.fechaRegreso)}
            className={clsx(
              'flex flex-col items-center gap-0.5 border-r border-slate-100 px-1 py-2.5 text-xs transition-colors last:border-r-0 dark:border-slate-800',
              esActual ? 'bg-sol-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
              i === 0 && 'rounded-l-xl',
              i === dias.length - 1 && 'rounded-r-xl',
            )}
          >
            <span className={clsx('capitalize', esActual ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}>
              {fechaObj.toLocaleDateString('es-DO', { weekday: 'short' })} {fechaObj.getDate()}
            </span>
            {d.cargando ? (
              <span className={esActual ? 'text-white/70' : 'text-slate-300 dark:text-slate-600'}>…</span>
            ) : d.precio ? (
              <span
                className={clsx(
                  'font-semibold',
                  esActual ? 'text-white' : esMasBarato ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300',
                )}
              >
                {d.precio.moneda} {d.precio.monto.toLocaleString('es-DO', { maximumFractionDigits: 0 })}
              </span>
            ) : (
              <span className={esActual ? 'text-white/70' : 'text-slate-300 dark:text-slate-600'}>N/D</span>
            )}
            {esActual && <span className="text-[9px] font-semibold uppercase text-white/80">Seleccionado</span>}
          </button>
        );
      })}
    </div>
  );
}

function BuscarVueloTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(FORM_BUSQUEDA_VACIO);
  const [ofertaAReservar, setOfertaAReservar] = useState<OfertaVuelo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orden, setOrden] = useState<(typeof ORDENES_VUELO)[number]['id']>('recomendado');
  const [filtroEscalas, setFiltroEscalas] = useState<'todos' | 'directo' | 'max1'>('todos');
  // Sets vacíos = sin filtrar por ese criterio (se ve todo) — mismo criterio que "ningún checkbox tildado = todos".
  const [horariosSeleccionados, setHorariosSeleccionados] = useState<Set<FranjaHoraria>>(new Set());
  const [aerolineasSeleccionadas, setAerolineasSeleccionadas] = useState<Set<string>>(new Set());

  const buscar = useMutation({
    mutationFn: async (formParaBuscar: typeof FORM_BUSQUEDA_VACIO) => {
      const tramos =
        formParaBuscar.tipoViaje === 'ida'
          ? [{ origen: formParaBuscar.origen.toUpperCase(), destino: formParaBuscar.destino.toUpperCase(), fecha: formParaBuscar.fechaSalida }]
          : [
              { origen: formParaBuscar.origen.toUpperCase(), destino: formParaBuscar.destino.toUpperCase(), fecha: formParaBuscar.fechaSalida },
              { origen: formParaBuscar.destino.toUpperCase(), destino: formParaBuscar.origen.toUpperCase(), fecha: formParaBuscar.fechaRegreso },
            ];
      return (
        await apiClient.post<ResultadoBusquedaVuelos>('/admin/travel/vuelos/buscar', {
          tramos,
          pasajeros: [
            ...Array.from({ length: formParaBuscar.adultos }, () => ({ tipo: 'adult' })),
            ...formParaBuscar.ninos.map((edad) => ({ edad })),
            ...formParaBuscar.infantes.map((edad) => ({ edad })),
          ],
          // "" -> no se manda cabin_class (Duffel exige el campo ausente, no vacío, para traer todas las cabinas).
          cabina: formParaBuscar.cabina || undefined,
        })
      ).data;
    },
    onSuccess: () => {
      // Resultados nuevos — los filtros de la búsqueda anterior podían referirse a aerolíneas/franjas que ya no aplican.
      setFiltroEscalas('todos');
      setHorariosSeleccionados(new Set());
      setAerolineasSeleccionadas(new Set());
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo buscar vuelos.')),
  });

  /** Dispara una nueva búsqueda con un form explícito (ej. desde la matriz de fechas) sin depender del `form` del cierre — useMutation lee el argumento, no el estado. */
  function buscarCon(formParaBuscar: typeof FORM_BUSQUEDA_VACIO) {
    setForm(formParaBuscar);
    setError(null);
    buscar.mutate(formParaBuscar);
  }

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
    buscarCon(form);
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setForm({ ...form, tipoViaje: 'ida' })}
              className={clsx(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                form.tipoViaje === 'ida' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              Solo ida
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, tipoViaje: 'ida_vuelta' })}
              className={clsx(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                form.tipoViaje === 'ida_vuelta' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              Ida y vuelta
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="flex items-end gap-2 lg:col-span-5">
              <AutocompleteAeropuerto label="Origen" value={form.origen} onChange={(codigo) => setForm({ ...form, origen: codigo })} required />
              <button
                type="button"
                onClick={() => setForm({ ...form, origen: form.destino, destino: form.origen })}
                aria-label="Intercambiar origen y destino"
                className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-400 hover:border-sol-500 hover:text-sol-600 dark:border-slate-700 dark:hover:border-sol-500"
              >
                <ArrowLeftRight size={16} />
              </button>
              <AutocompleteAeropuerto label="Destino" value={form.destino} onChange={(codigo) => setForm({ ...form, destino: codigo })} required />
            </div>
            <div className="lg:col-span-2">
              <FormField label="Salida" type="date" value={form.fechaSalida} onChange={(e) => setForm({ ...form, fechaSalida: e.target.value })} required />
            </div>
            {form.tipoViaje === 'ida_vuelta' && (
              <div className="lg:col-span-2">
                <FormField label="Regreso" type="date" value={form.fechaRegreso} onChange={(e) => setForm({ ...form, fechaRegreso: e.target.value })} required />
              </div>
            )}
            <div className="lg:col-span-2">
              <PasajerosPopover form={form} setForm={setForm} />
            </div>
            <div className="flex flex-col gap-1 lg:col-span-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cabina</label>
              <Select value={form.cabina} onChange={(e) => setForm({ ...form, cabina: e.target.value as typeof form.cabina })}>
                <option value="">Todas las cabinas</option>
                <option value="economy">Económica</option>
                <option value="premium_economy">Premium</option>
                <option value="business">Business</option>
                <option value="first">Primera</option>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={buscar.isPending || !form.origen || !form.destino || !form.fechaSalida} className="flex items-center gap-1.5">
            <Plane size={16} />
            {buscar.isPending ? 'Buscando…' : 'Buscar vuelos'}
          </Button>
        </form>
      </Card>

      {error && <ErrorBusquedaTravel mensaje={error} />}

      {buscar.data && (() => {
        const aerolineasDisponibles = [...new Set(buscar.data.ofertas.map(aerolineaDeOferta))].sort();
        const preciosOfertas = buscar.data.ofertas.map((o) => Number(o.montoTotal));
        const precioActual = preciosOfertas.length
          ? { monto: Math.min(...preciosOfertas), moneda: buscar.data.ofertas[0].moneda }
          : null;

        const ofertasFiltradas = buscar.data.ofertas
          .filter((o) => filtroEscalas === 'todos' || (filtroEscalas === 'directo' ? ofertaEsDirecta(o) : escalasMaxDeOferta(o) <= 1))
          .filter((o) => horariosSeleccionados.size === 0 || horariosSeleccionados.has(franjaHorariaDeOferta(o)))
          .filter((o) => aerolineasSeleccionadas.size === 0 || aerolineasSeleccionadas.has(aerolineaDeOferta(o)))
          .slice()
          .sort((a, b) => {
            if (orden === 'precio') return Number(a.montoTotal) - Number(b.montoTotal);
            if (orden === 'duracion') return duracionTotalMinutos(a) - duracionTotalMinutos(b);
            return 0;
          });

        const hayFiltrosActivos = filtroEscalas !== 'todos' || horariosSeleccionados.size > 0 || aerolineasSeleccionadas.size > 0;

        return (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <aside className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:w-56 lg:shrink-0">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Filtros</p>
                <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">Escalas</p>
                <div className="space-y-1.5">
                  {([
                    { id: 'todos', etiqueta: 'Todos' },
                    { id: 'directo', etiqueta: 'Directo' },
                    { id: 'max1', etiqueta: 'Máx. 1 escala' },
                  ] as const).map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input type="radio" name="filtro-escalas" checked={filtroEscalas === opt.id} onChange={() => setFiltroEscalas(opt.id)} />
                      {opt.etiqueta}
                    </label>
                  ))}
                </div>
              </div>

              {aerolineasDisponibles.length > 1 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">Aerolíneas</p>
                  <div className="space-y-1.5">
                    {aerolineasDisponibles.map((a) => (
                      <label key={a} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={aerolineasSeleccionadas.has(a)}
                          onChange={() => setAerolineasSeleccionadas((prev) => toggleEnSet(prev, a))}
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">Horario de salida</p>
                <div className="space-y-1.5">
                  {FRANJAS_HORARIAS.map((f) => (
                    <label key={f.id} title={f.rango} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input type="checkbox" checked={horariosSeleccionados.has(f.id)} onChange={() => setHorariosSeleccionados((prev) => toggleEnSet(prev, f.id))} />
                      {f.etiqueta}
                    </label>
                  ))}
                </div>
              </div>

              {hayFiltrosActivos && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltroEscalas('todos');
                    setHorariosSeleccionados(new Set());
                    setAerolineasSeleccionadas(new Set());
                  }}
                  className="text-xs font-semibold text-sol-600 hover:text-sol-700 dark:text-sol-400"
                >
                  Limpiar filtros
                </button>
              )}
            </aside>

            <div className="min-w-0 flex-1 space-y-3">
              <MatrizFechas form={form} precioActual={precioActual} onSeleccionarFecha={(fechaSalida, fechaRegreso) => buscarCon({ ...form, fechaSalida, fechaRegreso })} />

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex gap-1">
                  {ORDENES_VUELO.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOrden(o.id)}
                      className={clsx(
                        'rounded-lg px-3 py-1.5 text-xs font-semibold',
                        orden === o.id ? 'bg-sol-100 text-sol-700 dark:bg-sol-500/10 dark:text-sol-400' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800',
                      )}
                    >
                      {o.etiqueta}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-400">
                  {ofertasFiltradas.length} de {buscar.data.ofertas.length} oferta(s)
                </span>
              </div>

              {ofertasFiltradas.map((oferta) => (
                <FilaOferta key={oferta.id} oferta={oferta} onReservar={() => setOfertaAReservar(oferta)} />
              ))}
              {ofertasFiltradas.length === 0 && (
                <div className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  <p>Ninguna oferta coincide con los filtros elegidos.</p>
                  {hayFiltrosActivos && (
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroEscalas('todos');
                        setHorariosSeleccionados(new Set());
                        setAerolineasSeleccionadas(new Set());
                      }}
                      className="text-xs font-semibold text-sol-600 hover:text-sol-700 dark:text-sol-400"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {ofertaAReservar && (
        <ReservarOfertaModal
          oferta={ofertaAReservar}
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

/** El `regimen` viene tal cual de Hotelbeds (boardName) — mapeo best-effort a ícono + etiqueta en español, con fallback al texto original. */
const REGIMENES_CONOCIDOS: { patron: RegExp; icono: string; etiqueta: string }[] = [
  { patron: /ALL\s*INCLUSIVE/i, icono: '🍹', etiqueta: 'Todo incluido' },
  { patron: /FULL\s*BOARD/i, icono: '🍽️', etiqueta: 'Pensión completa' },
  { patron: /HALF\s*BOARD/i, icono: '🍽️', etiqueta: 'Media pensión' },
  { patron: /BED\s*AND\s*BREAKFAST|BREAKFAST/i, icono: '🥐', etiqueta: 'Desayuno incluido' },
  { patron: /SELF\s*CATERING/i, icono: '🧑‍🍳', etiqueta: 'Autoservicio' },
  { patron: /ROOM\s*ONLY|SIN\s*R[ÉE]GIMEN/i, icono: '🛏️', etiqueta: 'Solo habitación' },
];
function iconoYEtiquetaRegimen(regimen: string): { icono: string; etiqueta: string } {
  const match = REGIMENES_CONOCIDOS.find((r) => r.patron.test(regimen));
  return match ?? { icono: '🏨', etiqueta: regimen };
}

function TablaTarifasHabitacion({ habitacion, onReservar }: { habitacion: HotelListado['habitaciones'][number]; onReservar: (tarifa: TarifaHotel) => void }) {
  const montoMasBarato = Math.min(...habitacion.tarifas.map((t) => Number(t.montoNeto)));

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
      <p className="bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:bg-slate-800/60 dark:text-slate-100">{habitacion.nombre}</p>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {habitacion.tarifas.map((tarifa, i) => {
            const { icono, etiqueta } = iconoYEtiquetaRegimen(tarifa.regimen);
            const esMasBarata = Number(tarifa.montoNeto) === montoMasBarato;
            return (
              // Hotelbeds puede repetir el mismo rateKey dentro de una misma habitación (confirmado en vivo) — el índice evita que React descarte una tarifa por key duplicada.
              <tr key={`${tarifa.rateKey}-${i}`} className={esMasBarata ? 'bg-sol-50/60 dark:bg-sol-500/5' : undefined}>
                <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                  <span className="mr-1.5">{icono}</span>
                  {etiqueta}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                        tarifa.reembolsable
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800',
                      )}
                    >
                      {tarifa.reembolsable ? 'Reembolsable' : 'No reembolsable'}
                    </span>
                    {esMasBarata && (
                      <span className="rounded-full bg-sol-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sol-700 dark:bg-sol-500/10 dark:text-sol-400">
                        Más barata
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                  {tarifa.moneda} {Number(tarifa.montoNeto).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button type="button" onClick={() => onReservar(tarifa)} className="!px-3 !py-1 text-xs">
                    Reservar
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
      <div className="space-y-3">
        {hotel.habitaciones.map((habitacion) => (
          <TablaTarifasHabitacion key={habitacion.codigo} habitacion={habitacion} onReservar={(tarifa) => onReservar(tarifa, habitacion.nombre)} />
        ))}
      </div>
    </div>
  );
}

function ReservarHotelModal({
  hotel,
  tarifa,
  huespedesIniciales,
  guardando,
  error,
  onClose,
  onGuardar,
}: {
  hotel: HotelListado;
  tarifa: TarifaHotel;
  huespedesIniciales: FormHuespedHotel[];
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onGuardar: (dto: { clienteId: string; rateKey: string; huespedes: FormHuespedHotel[]; montoVenta: number; notas?: string }) => void;
}) {
  const [cliente, setCliente] = useState<ClienteOpcion | null>(null);
  const clienteId = cliente?.id ?? '';
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
          <SelectorClienteConCrear cliente={cliente} onSeleccionar={setCliente} />
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

function BuscarHotelTab() {
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
            <AutocompleteDestinoHotel label="Destino" value={form.destino} onChange={(codigo) => setForm({ ...form, destino: codigo })} required />
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

      {error && <ErrorBusquedaTravel mensaje={error} />}

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
        {vista === 'buscar' && <BuscarVueloTab />}
        {vista === 'buscarHotel' && <BuscarHotelTab />}
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
