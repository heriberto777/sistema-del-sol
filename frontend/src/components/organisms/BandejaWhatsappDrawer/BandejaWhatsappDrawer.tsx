import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, MessageCircle, Package, Send, X } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import type { ProductoCatalogo } from '../CatalogoProductosPos/CatalogoProductosPos';
import type { PaginaResultado } from '../../../types/pagina-resultado';
import { useBandejaWhatsappDrawer } from './BandejaWhatsappDrawerContext';

export interface MensajePendiente {
  id: string;
  telefono: string;
  contenido: string;
  createdAt: string;
}

interface MensajeConversacion {
  id: string;
  telefono: string;
  rol: 'USUARIO' | 'ASISTENTE' | 'HUMANO';
  contenido: string;
  createdAt: string;
}

/** Query key compartida con `BandejaWhatsappWidget` — un solo polling, no dos. */
export const QUERY_KEY_PENDIENTES = ['whatsapp-bandeja'];

function formatoRD(valor: string) {
  return `RD$ ${Number(valor).toLocaleString('es-DO')}`;
}

/**
 * Panel lateral de altura completa (Concepto 1 elegido por el usuario,
 * mismo patrón que `CarritoDrawer` de la tienda) — reemplaza al viejo
 * `BandejaWhatsappPanel` de Administración → Integraciones. Dos vistas
 * internas (lista de pendientes / conversación completa), sin rutear —
 * es más simple que meterlo en el context, y nada más lo necesita.
 */
export function BandejaWhatsappDrawer() {
  const { abierto, cerrar } = useBandejaWhatsappDrawer();
  const queryClient = useQueryClient();
  const [telefonoActivo, setTelefonoActivo] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [mostrarBuscadorProducto, setMostrarBuscadorProducto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busquedaDebounced = useDebouncedValue(busquedaProducto);

  useEffect(() => {
    if (!abierto) return undefined;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [abierto, cerrar]);

  useEffect(() => {
    if (!abierto) {
      setTelefonoActivo(null);
      setTexto('');
      setMostrarBuscadorProducto(false);
      setBusquedaProducto('');
      setError(null);
    }
  }, [abierto]);

  const { data: pendientes, isLoading: cargandoPendientes } = useQuery({
    queryKey: QUERY_KEY_PENDIENTES,
    queryFn: async () => (await apiClient.get<MensajePendiente[]>('/admin/whatsapp-bandeja')).data,
    refetchInterval: 20_000,
    enabled: abierto,
  });

  const { data: conversacion, isLoading: cargandoConversacion } = useQuery({
    queryKey: ['whatsapp-bandeja-conversacion', telefonoActivo],
    queryFn: async () => (await apiClient.get<MensajeConversacion[]>(`/admin/whatsapp-bandeja/${encodeURIComponent(telefonoActivo!)}/conversacion`)).data,
    enabled: abierto && !!telefonoActivo,
    refetchInterval: 10_000,
  });

  const { data: resultadosProducto, isFetching: buscandoProducto } = useQuery({
    queryKey: ['whatsapp-bandeja-buscar-producto', busquedaDebounced],
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<ProductoCatalogo>>('/productos/catalogo', { params: { busqueda: busquedaDebounced, tamanoPagina: 6 } })).data
        .datos,
    enabled: abierto && mostrarBuscadorProducto && busquedaDebounced.length > 1,
  });

  const responder = useMutation({
    mutationFn: async ({ telefono, contenido, productoId }: { telefono: string; contenido: string; productoId?: string }) =>
      apiClient.post(`/admin/whatsapp-bandeja/${encodeURIComponent(telefono)}/responder`, { contenido, productoId }),
    onSuccess: () => {
      setTexto('');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_PENDIENTES });
      if (telefonoActivo) queryClient.invalidateQueries({ queryKey: ['whatsapp-bandeja-conversacion', telefonoActivo] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo enviar el mensaje.')),
  });

  const marcarAtendido = useMutation({
    mutationFn: async (telefono: string) => apiClient.patch(`/admin/whatsapp-bandeja/${encodeURIComponent(telefono)}/atendido`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_PENDIENTES });
      setTelefonoActivo(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo marcar como atendido.')),
  });

  if (!abierto) return null;

  const telefonoLegible = telefonoActivo?.replace(/^whatsapp:/, '') ?? '';

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={cerrar} aria-hidden="true" />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-slate-900">
        {!telefonoActivo && (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                <MessageCircle size={18} />
                Bandeja de WhatsApp
              </h2>
              <button type="button" onClick={cerrar} aria-label="Cerrar" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cargandoPendientes && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
              {pendientes?.length === 0 && (
                <div className="p-5">
                  <EstadoVacio titulo="Sin pendientes" descripcion="No hay conversaciones de WhatsApp esperando atención." />
                </div>
              )}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendientes?.map((mensaje) => (
                  <button
                    key={mensaje.id}
                    type="button"
                    onClick={() => setTelefonoActivo(mensaje.telefono)}
                    className="flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{mensaje.telefono.replace(/^whatsapp:/, '')}</span>
                      <span className="text-xs text-slate-400">{new Date(mensaje.createdAt).toLocaleString('es-DO')}</span>
                    </div>
                    <span className="truncate text-sm text-slate-500 dark:text-slate-400">{mensaje.contenido}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {telefonoActivo && (
          <>
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <button type="button" onClick={() => setTelefonoActivo(null)} aria-label="Volver" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <ArrowLeft size={18} />
              </button>
              <span className="flex-1 font-medium text-slate-900 dark:text-slate-100">{telefonoLegible}</span>
              <button
                type="button"
                onClick={() => marcarAtendido.mutate(telefonoActivo)}
                disabled={marcarAtendido.isPending}
                className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Check size={12} />
                Marcar atendido
              </button>
              <button type="button" onClick={cerrar} aria-label="Cerrar" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X size={20} />
              </button>
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
                          responder.mutate({ telefono: telefonoActivo, contenido: p.nombre, productoId: p.id });
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
                    responder.mutate({ telefono: telefonoActivo, contenido: texto });
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
                  responder.mutate({ telefono: telefonoActivo, contenido: texto });
                }}
                aria-label="Enviar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sol-500 text-white disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
