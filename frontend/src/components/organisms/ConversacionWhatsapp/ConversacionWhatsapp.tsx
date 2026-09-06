import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Package, Send } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import type { ProductoCatalogo } from '../CatalogoProductosPos/CatalogoProductosPos';
import type { PaginaResultado } from '../../../types/pagina-resultado';
import { QUERY_KEY_PENDIENTES } from '../BandejaWhatsappDrawer/BandejaWhatsappDrawer';

export interface MensajeConversacion {
  id: string;
  telefono: string;
  rol: 'USUARIO' | 'ASISTENTE' | 'HUMANO';
  contenido: string;
  perfilNombre: string | null;
  createdAt: string;
}

function formatoRD(valor: string) {
  return `RD$ ${Number(valor).toLocaleString('es-DO')}`;
}

/**
 * Vista de conversación completa (burbujas por rol + buscador de producto
 * embebido + composer) — extraída de `BandejaWhatsappDrawer` para
 * reusarla tal cual en la página "Mensajes" (inbox completo). Montala con
 * `key={telefono}` en el consumidor para que el estado local (texto,
 * buscador abierto) arranque limpio al cambiar de conversación, en vez de
 * arrastrar el de la anterior.
 */
export function ConversacionWhatsapp({
  telefono,
  onVolver,
  accionesExtra,
}: {
  telefono: string;
  /** Si viene, muestra la flecha "volver" (uso del drawer) — en la página "Mensajes" no aplica. */
  onVolver?: () => void;
  /** Slot para acciones extra del consumidor (ej. el botón "Cerrar" del drawer entero). */
  accionesExtra?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [mostrarBuscadorProducto, setMostrarBuscadorProducto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busquedaDebounced = useDebouncedValue(busquedaProducto);

  const { data: conversacion, isLoading: cargandoConversacion } = useQuery({
    queryKey: ['whatsapp-bandeja-conversacion', telefono],
    queryFn: async () => (await apiClient.get<MensajeConversacion[]>(`/admin/whatsapp-bandeja/${encodeURIComponent(telefono)}/conversacion`)).data,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });

  const { data: resultadosProducto, isFetching: buscandoProducto } = useQuery({
    queryKey: ['whatsapp-bandeja-buscar-producto', busquedaDebounced],
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<ProductoCatalogo>>('/productos/catalogo', { params: { busqueda: busquedaDebounced, tamanoPagina: 6 } })).data
        .datos,
    enabled: mostrarBuscadorProducto && busquedaDebounced.length > 1,
  });

  const responder = useMutation({
    mutationFn: async ({ contenido, productoId }: { contenido: string; productoId?: string }) =>
      apiClient.post(`/admin/whatsapp-bandeja/${encodeURIComponent(telefono)}/responder`, { contenido, productoId }),
    onSuccess: () => {
      setTexto('');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_PENDIENTES });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-bandeja-conversacion', telefono] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-mensajes-conversaciones'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo enviar el mensaje.')),
  });

  const marcarAtendido = useMutation({
    mutationFn: async () => apiClient.patch(`/admin/whatsapp-bandeja/${encodeURIComponent(telefono)}/atendido`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_PENDIENTES });
      onVolver?.();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo marcar como atendido.')),
  });

  const telefonoLegible = telefono.replace(/^whatsapp:/, '');
  const perfilNombre = conversacion?.find((m) => m.perfilNombre)?.perfilNombre ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        {onVolver && (
          <button type="button" onClick={onVolver} aria-label="Volver" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-900 dark:text-slate-100">{perfilNombre ?? telefonoLegible}</span>
          {perfilNombre && <span className="block truncate text-xs text-slate-400">{telefonoLegible}</span>}
        </div>
        <button
          type="button"
          onClick={() => marcarAtendido.mutate()}
          disabled={marcarAtendido.isPending}
          className="flex shrink-0 items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Check size={12} />
          Marcar atendido
        </button>
        {accionesExtra}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 px-4 py-3 dark:bg-slate-950">
        {cargandoConversacion && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
        {conversacion?.map((mensaje) => {
          const esCliente = mensaje.rol === 'USUARIO';
          return (
            <div key={mensaje.id} className={`flex ${esCliente ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[78%] rounded-xl px-3 py-1.5 text-sm ${
                  esCliente
                    ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    : mensaje.rol === 'HUMANO'
                      ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200'
                      : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                }`}
              >
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-60">
                  {esCliente ? 'Cliente' : mensaje.rol === 'HUMANO' ? 'Vos' : 'Bot'}
                </span>
                {mensaje.contenido}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="px-4 pt-2 text-xs text-red-600">{error}</p>}

      {mostrarBuscadorProducto && (
        <div className="border-t border-slate-200 p-3 dark:border-slate-700">
          <input
            autoFocus
            type="text"
            value={busquedaProducto}
            onChange={(e) => setBusquedaProducto(e.target.value)}
            placeholder="Buscar producto para enviar…"
            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          {buscandoProducto && <p className="text-xs text-slate-400">Buscando…</p>}
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {resultadosProducto?.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-1.5 dark:border-slate-700">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                  {p.imagen && <img src={p.imagen} alt={p.nombre} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{p.nombre}</p>
                  {p.precioVenta && <p className="text-xs text-sol-600 dark:text-sol-400">{formatoRD(p.precioVenta)}</p>}
                </div>
                <button
                  type="button"
                  disabled={responder.isPending}
                  onClick={() => {
                    setError(null);
                    responder.mutate({ contenido: p.nombre, productoId: p.id });
                    setMostrarBuscadorProducto(false);
                    setBusquedaProducto('');
                  }}
                  className="shrink-0 rounded-md bg-sol-500 px-2 py-1 text-xs font-semibold text-white"
                >
                  Enviar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setMostrarBuscadorProducto((v) => !v)}
          aria-label="Enviar producto"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${mostrarBuscadorProducto ? 'border-sol-500 text-sol-600' : 'border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400'}`}
        >
          <Package size={16} />
        </button>
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && texto.trim() && !responder.isPending) {
              setError(null);
              responder.mutate({ contenido: texto });
            }
          }}
          placeholder="Escribí una respuesta…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="button"
          disabled={!texto.trim() || responder.isPending}
          onClick={() => {
            setError(null);
            responder.mutate({ contenido: texto });
          }}
          aria-label="Enviar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sol-500 text-white disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
