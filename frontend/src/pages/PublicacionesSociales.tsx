import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { descargarBlob } from '../lib/descargar-archivo';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { PaginaResultado } from '../types/pagina-resultado';

type EstadoPublicacion = 'BORRADOR' | 'PENDIENTE_APROBACION' | 'APROBADA' | 'RECHAZADA' | 'CAMBIOS_SOLICITADOS';

type OfertaVisible =
  | { tipo: 'DESCUENTO'; precioConDescuento: number; ahorro: number; porcentaje: number }
  | { tipo: 'BOGO'; comprarCantidad: number; llevarCantidad: number; porcentajeDescuentoLlevar: number };

type FormatoPublicacion = 'CUADRADO' | 'VERTICAL';

interface PublicacionSocialResumen {
  id: string;
  estado: EstadoPublicacion;
  origen: 'FOTO_PRODUCTO' | 'IA';
  formato: FormatoPublicacion;
  promptIa: string | null;
  producto: {
    id: string;
    nombre: string;
    codigo: string;
    /** Solo vienen en el detalle (`GET /:id`), no en el listado — precio/oferta REALES, para comparar contra lo que dibujó la IA. */
    precioFormateado?: string | null;
    precioConDescuentoFormateado?: string | null;
    oferta?: OfertaVisible | null;
  };
  plantilla: { id: string; nombre: string };
  creadoPor: { id: string; nombre: string };
  aprobadoPor: { id: string; nombre: string } | null;
  motivoRechazo: string | null;
  createdAt: string;
  /** Fase 5 — historial completo, orden ascendente (la última es la vigente). */
  versiones?: VersionPublicacion[];
}

interface VersionPublicacion {
  id: string;
  numero: number;
  comentarioCambios: string | null;
  creadoPor: { id: string; nombre: string };
  createdAt: string;
}

interface ProductoOpcion {
  id: string;
  nombre: string;
  codigo: string;
}

interface PlantillaOpcion {
  id: string;
  clave: string;
  nombre: string;
}

const ETIQUETA_ESTADO: Record<EstadoPublicacion, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CAMBIOS_SOLICITADOS: 'Cambios solicitados',
};

const TONO_ESTADO: Record<EstadoPublicacion, 'neutro' | 'advertencia' | 'exito' | 'peligro'> = {
  BORRADOR: 'neutro',
  PENDIENTE_APROBACION: 'advertencia',
  APROBADA: 'exito',
  RECHAZADA: 'peligro',
  CAMBIOS_SOLICITADOS: 'advertencia',
};

function urlImagenPublica(id: string) {
  return `/api/public/publicaciones-sociales/${id}/imagen`;
}

const ETIQUETA_FORMATO: Record<FormatoPublicacion, string> = {
  CUADRADO: 'Cuadrado (feed de Instagram/Facebook)',
  VERTICAL: 'Vertical (Estados/Historias)',
};

/** Puntos de partida genéricos, sin importar el rubro del negocio — solo frontend, reemplazan el texto del textarea (sigue editable después). */
const PRESETS_ESTILO_IA = [
  { etiqueta: 'Elegante y minimalista', texto: 'Diseño elegante y minimalista, fondo liso o con textura sutil, mucho espacio en blanco' },
  { etiqueta: 'Vibrante y llamativo (oferta)', texto: 'Diseño vibrante y llamativo, colores saturados, ideal para una oferta o promoción' },
  { etiqueta: 'Profesional y corporativo', texto: 'Diseño profesional y corporativo, colores sobrios, aspecto serio y confiable' },
  { etiqueta: 'Cálido y acogedor', texto: 'Ambientación cálida y acogedora, luz suave, tonos tierra' },
  { etiqueta: 'Moderno, colores vivos', texto: 'Diseño moderno con colores vivos y formas geométricas, estilo urbano' },
  { etiqueta: 'Natural y orgánico', texto: 'Ambientación natural y orgánica, elementos vegetales, luz de día' },
] as const;

export function PublicacionesSociales() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoOpcion | null>(null);
  const [plantillaId, setPlantillaId] = useState('');
  const [promptIa, setPromptIa] = useState('');
  const [formato, setFormato] = useState<FormatoPublicacion>('CUADRADO');
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['publicaciones-sociales', pagina],
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<PublicacionSocialResumen>>('/admin/publicaciones-sociales', { params: { pagina } })).data,
  });

  const { data: plantillas } = useQuery({
    queryKey: ['publicaciones-sociales-plantillas'],
    queryFn: async () => (await apiClient.get<PlantillaOpcion[]>('/admin/publicaciones-sociales/plantillas')).data,
    enabled: modalCrearAbierto,
  });

  const crear = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post('/admin/publicaciones-sociales', {
          productoId: productoSeleccionado?.id,
          plantillaId,
          formato,
          ...(promptIa.trim() ? { promptIa: promptIa.trim() } : {}),
        })
      ).data as PublicacionSocialResumen,
    onSuccess: (creada) => {
      queryClient.invalidateQueries({ queryKey: ['publicaciones-sociales'] });
      setModalCrearAbierto(false);
      setProductoSeleccionado(null);
      setPlantillaId('');
      setPromptIa('');
      setFormato('CUADRADO');
      setErrorCrear(null);
      setDetalleId(creada.id);
    },
    onError: (err) => setErrorCrear(mensajeErrorApi(err, 'No se pudo generar el diseño.')),
  });

  function onSubmitCrear(e: FormEvent) {
    e.preventDefault();
    setErrorCrear(null);
    crear.mutate();
  }

  const publicaciones = data?.datos ?? [];

  return (
    <RequierePermiso permiso="publicacionessociales.ver">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Publicaciones Sociales</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Generá un banner del producto, mandalo a aprobación, y descargalo o envialo por WhatsApp una vez aprobado — vos publicás donde
              quieras.
            </p>
          </div>
          <RequierePermiso permiso="publicacionessociales.crear">
            <Button onClick={() => setModalCrearAbierto(true)}>Nueva publicación</Button>
          </RequierePermiso>
        </div>

        <Card contentClassName="flex flex-wrap items-center gap-3" sinPadding>
          {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {!isLoading && publicaciones.length === 0 && (
            <div className="w-full p-5">
              <EstadoVacio titulo="Sin publicaciones todavía" descripcion="Creá la primera eligiendo un producto y una plantilla." />
            </div>
          )}
          {publicaciones.length > 0 && (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-800">
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Plantilla</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Creado por</th>
                </tr>
              </thead>
              <tbody>
                {publicaciones.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setDetalleId(p.id)}
                    className="cursor-pointer border-b border-slate-50 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{p.producto.nombre}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-2">
                        {p.plantilla.nombre}
                        {p.origen === 'IA' && <Badge tono="neutro">IA</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tono={TONO_ESTADO[p.estado]}>{ETIQUETA_ESTADO[p.estado]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.creadoPor.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {data && (
            <div className="w-full border-t border-slate-100 p-4 dark:border-slate-800">
              <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>

        {modalCrearAbierto && (
          <Modal titulo="Nueva publicación" onClose={() => setModalCrearAbierto(false)}>
            <form onSubmit={onSubmitCrear} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Producto</label>
                <ComboboxBusqueda<ProductoOpcion>
                  valor={productoSeleccionado}
                  onSeleccionar={setProductoSeleccionado}
                  buscar={async (texto) => (await apiClient.get<PaginaResultado<ProductoOpcion>>('/productos', { params: { busqueda: texto } })).data.datos}
                  obtenerId={(p) => p.id}
                  obtenerEtiqueta={(p) => `${p.nombre} (${p.codigo})`}
                  placeholder="Buscar producto…"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Plantilla</label>
                <Select value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)} required>
                  <option value="">Elegí una plantilla…</option>
                  {plantillas?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Formato</label>
                <Select value={formato} onChange={(e) => setFormato(e.target.value as FormatoPublicacion)}>
                  {Object.entries(ETIQUETA_FORMATO).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </Select>
                {formato === 'VERTICAL' && !promptIa.trim() && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    El formato vertical solo está disponible generando con IA — describí una ambientación abajo.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="estilo-preset" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Estilo sugerido (opcional)
                </label>
                <Select
                  id="estilo-preset"
                  value=""
                  onChange={(e) => {
                    const preset = PRESETS_ESTILO_IA.find((p) => p.etiqueta === e.target.value);
                    if (preset) setPromptIa(preset.texto);
                  }}
                >
                  <option value="">Elegí un punto de partida…</option>
                  {PRESETS_ESTILO_IA.map((preset) => (
                    <option key={preset.etiqueta} value={preset.etiqueta}>
                      {preset.etiqueta}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Reemplaza el texto de abajo con un punto de partida — podés editarlo después.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="prompt-ia" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Ambientación con IA (opcional)
                </label>
                <textarea
                  id="prompt-ia"
                  value={promptIa}
                  onChange={(e) => setPromptIa(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Ej. Fondo de cocina moderna con luz cálida"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Si completás esto, la IA diseña la publicación completa (incluido el precio real y la oferta/descuento vigente, si tenés
                  uno) — solo describí el estilo o la ambientación que querés, no hace falta escribir el precio. Puede tardar unos segundos.
                  Dejalo vacío para usar la plantilla fija con la foto tal cual.
                </p>
              </div>

              {errorCrear && <p className="text-sm text-red-600 dark:text-red-400">{errorCrear}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variante="secundario" onClick={() => setModalCrearAbierto(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={crear.isPending || !productoSeleccionado || !plantillaId || (formato === 'VERTICAL' && !promptIa.trim())}
                >
                  {crear.isPending ? 'Generando…' : 'Generar diseño'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {detalleId && (
          <DetallePublicacionSocial id={detalleId} onClose={() => setDetalleId(null)} tienePermiso={tienePermiso} />
        )}
      </div>
    </RequierePermiso>
  );
}

interface DetalleProps {
  id: string;
  onClose: () => void;
  tienePermiso: (permiso: string) => boolean;
}

function DetallePublicacionSocial({ id, onClose, tienePermiso }: DetalleProps) {
  const queryClient = useQueryClient();
  const [formRechazoAbierto, setFormRechazoAbierto] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [formCambiosAbierto, setFormCambiosAbierto] = useState(false);
  const [comentarioCambios, setComentarioCambios] = useState('');
  const [regenPromptIaOverride, setRegenPromptIaOverride] = useState<string | undefined>(undefined);
  const [regenPlantillaIdOverride, setRegenPlantillaIdOverride] = useState<string | undefined>(undefined);
  const [regenFormatoOverride, setRegenFormatoOverride] = useState<FormatoPublicacion | undefined>(undefined);
  const [formWhatsappAbierto, setFormWhatsappAbierto] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [descargando, setDescargando] = useState(false);
  const [mensajeWhatsapp, setMensajeWhatsapp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: publicacion, isLoading } = useQuery({
    queryKey: ['publicaciones-sociales', id],
    queryFn: async () => (await apiClient.get<PublicacionSocialResumen>(`/admin/publicaciones-sociales/${id}`)).data,
  });

  const { data: plantillas } = useQuery({
    queryKey: ['publicaciones-sociales-plantillas'],
    queryFn: async () => (await apiClient.get<PlantillaOpcion[]>('/admin/publicaciones-sociales/plantillas')).data,
    enabled: publicacion?.estado === 'CAMBIOS_SOLICITADOS',
  });

  const regenPromptIa = regenPromptIaOverride ?? publicacion?.promptIa ?? '';
  const regenPlantillaId = regenPlantillaIdOverride ?? publicacion?.plantilla.id ?? '';
  const regenFormato = regenFormatoOverride ?? publicacion?.formato ?? 'CUADRADO';

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['publicaciones-sociales'] });
    queryClient.invalidateQueries({ queryKey: ['publicaciones-sociales', id] });
  }

  const enviarAAprobacion = useMutation({
    mutationFn: async () => apiClient.patch(`/admin/publicaciones-sociales/${id}/enviar-aprobacion`),
    onSuccess: () => {
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo enviar a aprobación.')),
  });

  const aprobar = useMutation({
    mutationFn: async () => apiClient.patch(`/admin/publicaciones-sociales/${id}/estado`, { estado: 'APROBADA' }),
    onSuccess: () => {
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo aprobar la publicación.')),
  });

  const rechazar = useMutation({
    mutationFn: async () => apiClient.patch(`/admin/publicaciones-sociales/${id}/estado`, { estado: 'RECHAZADA', motivoRechazo }),
    onSuccess: () => {
      setError(null);
      setFormRechazoAbierto(false);
      setMotivoRechazo('');
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo rechazar la publicación.')),
  });

  const solicitarCambios = useMutation({
    mutationFn: async () => apiClient.patch(`/admin/publicaciones-sociales/${id}/solicitar-cambios`, { comentario: comentarioCambios }),
    onSuccess: () => {
      setError(null);
      setFormCambiosAbierto(false);
      setComentarioCambios('');
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo enviar el pedido de cambios.')),
  });

  const regenerar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/admin/publicaciones-sociales/${id}/regenerar`, {
        plantillaId: regenPlantillaId,
        formato: regenFormato,
        ...(regenPromptIa.trim() ? { promptIa: regenPromptIa.trim() } : {}),
      }),
    onSuccess: () => {
      setError(null);
      setRegenPromptIaOverride(undefined);
      setRegenPlantillaIdOverride(undefined);
      setRegenFormatoOverride(undefined);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo regenerar el diseño.')),
  });

  const enviarWhatsapp = useMutation({
    mutationFn: async () => apiClient.post(`/admin/publicaciones-sociales/${id}/enviar-whatsapp`, { telefono }),
    onSuccess: () => {
      setError(null);
      setMensajeWhatsapp('Enviado por WhatsApp.');
      setFormWhatsappAbierto(false);
      setTelefono('');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo enviar por WhatsApp.')),
  });

  async function descargar() {
    setDescargando(true);
    setError(null);
    try {
      const respuesta = await apiClient.get(urlImagenPublica(id), { responseType: 'blob' });
      descargarBlob(new Blob([respuesta.data]), `publicacion-${id}.png`);
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo descargar la imagen.'));
    } finally {
      setDescargando(false);
    }
  }

  function onSubmitRechazo(e: FormEvent) {
    e.preventDefault();
    rechazar.mutate();
  }

  function onSubmitCambios(e: FormEvent) {
    e.preventDefault();
    solicitarCambios.mutate();
  }

  function onSubmitRegenerar(e: FormEvent) {
    e.preventDefault();
    regenerar.mutate();
  }

  function onSubmitWhatsapp(e: FormEvent) {
    e.preventDefault();
    setMensajeWhatsapp(null);
    enviarWhatsapp.mutate();
  }

  return (
    <Modal titulo="Publicación social" onClose={onClose} ancho="2xl">
      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
      {publicacion && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <img
            src={urlImagenPublica(id)}
            alt={`Diseño de ${publicacion.producto.nombre}`}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800"
          />

          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Producto</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{publicacion.producto.nombre}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Precio real (para comparar contra la imagen)</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {publicacion.producto.oferta?.tipo === 'DESCUENTO' ? (
                  <>
                    <span className="mr-2 text-slate-400 line-through dark:text-slate-500">{publicacion.producto.precioFormateado}</span>
                    <span>{publicacion.producto.precioConDescuentoFormateado}</span>
                    <span className="ml-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      -{publicacion.producto.oferta.porcentaje}%
                    </span>
                  </>
                ) : publicacion.producto.oferta?.tipo === 'BOGO' ? (
                  <>
                    {publicacion.producto.precioFormateado}
                    <span className="ml-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Compra {publicacion.producto.oferta.comprarCantidad}, llevá {publicacion.producto.oferta.llevarCantidad} (
                      {publicacion.producto.oferta.porcentajeDescuentoLlevar}% en las llevadas)
                    </span>
                  </>
                ) : (
                  (publicacion.producto.precioFormateado ?? '—')
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Plantilla</p>
              <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                {publicacion.plantilla.nombre}
                {publicacion.origen === 'IA' && <Badge tono="neutro">Generado con IA</Badge>}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ETIQUETA_FORMATO[publicacion.formato]}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Estado</p>
              <Badge tono={TONO_ESTADO[publicacion.estado]}>{ETIQUETA_ESTADO[publicacion.estado]}</Badge>
            </div>
            {publicacion.estado === 'RECHAZADA' && publicacion.motivoRechazo && (
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Motivo del rechazo</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{publicacion.motivoRechazo}</p>
              </div>
            )}

            {publicacion.versiones && publicacion.versiones.length > 1 && (
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Historial de versiones</p>
                <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  {publicacion.versiones.map((v) => (
                    <li key={v.id}>
                      <span className="font-medium">v{v.numero}</span> — {v.creadoPor.nombre} ({new Date(v.createdAt).toLocaleDateString()})
                      {v.comentarioCambios && <span className="text-slate-500 dark:text-slate-400"> — pedido: "{v.comentarioCambios}"</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {mensajeWhatsapp && <p className="text-sm text-emerald-600 dark:text-emerald-400">{mensajeWhatsapp}</p>}

            <div className="flex flex-col gap-2 pt-2">
              {publicacion.estado === 'BORRADOR' && (
                <Button onClick={() => enviarAAprobacion.mutate()} disabled={enviarAAprobacion.isPending}>
                  {enviarAAprobacion.isPending ? 'Enviando…' : 'Enviar a aprobación'}
                </Button>
              )}

              {publicacion.estado === 'PENDIENTE_APROBACION' &&
                tienePermiso('publicacionessociales.aprobar') &&
                !formRechazoAbierto &&
                !formCambiosAbierto && (
                  <div className="flex gap-2">
                    <Button onClick={() => aprobar.mutate()} disabled={aprobar.isPending}>
                      {aprobar.isPending ? 'Aprobando…' : 'Aprobar'}
                    </Button>
                    <Button variante="secundario" onClick={() => setFormCambiosAbierto(true)}>
                      Solicitar cambios
                    </Button>
                    <Button variante="secundario" onClick={() => setFormRechazoAbierto(true)}>
                      Rechazar
                    </Button>
                  </div>
                )}

              {formRechazoAbierto && (
                <form onSubmit={onSubmitRechazo} className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                  <FormField
                    id="motivo-rechazo"
                    label="Motivo del rechazo"
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    required
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variante="secundario" onClick={() => setFormRechazoAbierto(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={rechazar.isPending || !motivoRechazo.trim()}>
                      {rechazar.isPending ? 'Rechazando…' : 'Confirmar rechazo'}
                    </Button>
                  </div>
                </form>
              )}

              {formCambiosAbierto && (
                <form onSubmit={onSubmitCambios} className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                  <FormField
                    id="comentario-cambios"
                    label="Qué hay que cambiar"
                    value={comentarioCambios}
                    onChange={(e) => setComentarioCambios(e.target.value)}
                    required
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variante="secundario" onClick={() => setFormCambiosAbierto(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={solicitarCambios.isPending || !comentarioCambios.trim()}>
                      {solicitarCambios.isPending ? 'Enviando…' : 'Enviar pedido de cambios'}
                    </Button>
                  </div>
                </form>
              )}

              {publicacion.estado === 'CAMBIOS_SOLICITADOS' && (
                <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Te pidieron estos cambios</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {publicacion.versiones?.[publicacion.versiones.length - 1]?.comentarioCambios}
                    </p>
                  </div>
                  <form onSubmit={onSubmitRegenerar} className="space-y-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Plantilla</label>
                      <Select value={regenPlantillaId} onChange={(e) => setRegenPlantillaIdOverride(e.target.value)}>
                        {plantillas?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Formato</label>
                      <Select value={regenFormato} onChange={(e) => setRegenFormatoOverride(e.target.value as FormatoPublicacion)}>
                        {Object.entries(ETIQUETA_FORMATO).map(([valor, etiqueta]) => (
                          <option key={valor} value={valor}>
                            {etiqueta}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="regen-prompt-ia" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Ambientación con IA (opcional)
                      </label>
                      <textarea
                        id="regen-prompt-ia"
                        value={regenPromptIa}
                        onChange={(e) => setRegenPromptIaOverride(e.target.value)}
                        maxLength={500}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Después de regenerar, volvés a tener que pulsar "Enviar a aprobación".
                    </p>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={regenerar.isPending}>
                        {regenerar.isPending ? 'Regenerando…' : 'Regenerar'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {publicacion.estado === 'APROBADA' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button onClick={descargar} disabled={descargando}>
                      {descargando ? 'Descargando…' : 'Descargar'}
                    </Button>
                    {!formWhatsappAbierto && (
                      <Button variante="secundario" onClick={() => setFormWhatsappAbierto(true)}>
                        Enviar por WhatsApp
                      </Button>
                    )}
                  </div>

                  {formWhatsappAbierto && (
                    <form onSubmit={onSubmitWhatsapp} className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                      <FormField
                        id="whatsapp-telefono"
                        label="Teléfono (con código de país)"
                        placeholder="+18095551234"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        required
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variante="secundario" onClick={() => setFormWhatsappAbierto(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={enviarWhatsapp.isPending || telefono.trim().length < 8}>
                          {enviarWhatsapp.isPending ? 'Enviando…' : 'Enviar'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
