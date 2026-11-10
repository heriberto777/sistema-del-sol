import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { BedDouble } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { AutocompleteDestinoHotel } from '../../molecules/AutocompleteDestinoHotel/AutocompleteDestinoHotel';
import { Modal } from '../../molecules/Modal/Modal';
import { ErrorBusquedaTravel } from '../../molecules/ErrorBusquedaTravel/ErrorBusquedaTravel';
import { SelectorClienteConCrear, type ClienteOpcion } from '../../molecules/SelectorClienteConCrear/SelectorClienteConCrear';
import { HotelListado, ResultadoBusquedaHoteles, TarifaHotel } from '../../../types/travel';

/** Extraído de TravelReservas.tsx (auditoría UX Fase 5) — búsqueda + reserva real de hoteles (Hotelbeds). Sin cambios de fondo, solo relocación. */
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

export function TravelBuscarHotelPanel() {
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
