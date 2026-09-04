import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { CampoImagen } from '../../molecules/CampoImagen/CampoImagen';
import { SelectorBodega } from '../../molecules/SelectorBodega/SelectorBodega';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { useAuth } from '../../../hooks/useAuth';
import { construirUrlTienda } from '../../../hooks/useUrlTiendaPublica';
import {
  FUENTES_TIENDA,
  TAMANOS_FUENTE_TIENDA,
  RADIOS_TARJETA_TIENDA,
  PROPORCIONES_IMAGEN_TIENDA,
  ESTILOS_INSIGNIA_OFERTA_TIENDA,
  ESTILOS_INSIGNIA_SIN_STOCK_TIENDA,
  MENU_DEFAULT,
  TemaTienda,
  ClaveMenuTienda,
  variablesCssTema,
  DefaultsTemaPlantilla,
} from '../../../pages/tienda/tema';
import { TarjetaProductoTienda } from '../../../pages/tienda/TarjetaProductoTienda';
import { CarritoTiendaProvider } from '../../../pages/tienda/CarritoTiendaContext';
import { ProductoTienda } from '../../../hooks/useTienda';
import { MensajeBannerAnuncio, TamanoFuenteBanner } from '../../../pages/tienda/BannerAnuncio';

interface Configuracion {
  clave: string;
  valor: string;
}

const CLAVE_ACTIVA = 'TIENDA_ACTIVA';
const CLAVE_NOMBRE = 'TIENDA_NOMBRE';
const CLAVE_PLANTILLA = 'TIENDA_PLANTILLA';
const CLAVE_LOGO = 'TIENDA_LOGO';
const CLAVE_BANNER = 'TIENDA_BANNER';
const CLAVE_COLOR_ACENTO = 'TIENDA_COLOR_ACENTO';
const CLAVE_BODEGA_ID = 'TIENDA_BODEGA_ID';
const CLAVE_TEMA = 'TIENDA_TEMA';
const CLAVE_BANNER_TEXTO = 'TIENDA_BANNER_TEXTO';

const PLANTILLAS = [
  { value: 'DIRECTO', label: 'Directo' },
  { value: 'MERCADO', label: 'Mercado' },
  { value: 'BOUTIQUE', label: 'Boutique' },
  { value: 'BRUMA', label: 'Bruma (Belleza)' },
  { value: 'BLOQUE', label: 'Bloque (Streetwear)' },
  { value: 'NODO', label: 'Nodo (Tecnología)' },
  { value: 'CHISPA', label: 'Chispa (Y2K / Accesorios)' },
  { value: 'EDITORIAL', label: 'Editorial (Ropa · Fast fashion)' },
  { value: 'BASE', label: 'Base (Ropa · Básicos)' },
  { value: 'ROPERO', label: 'Ropero (Ropa · Vintage)' },
  { value: 'AMPLIA', label: 'Amplia (Ropa · Talla grande)' },
  { value: 'DISTRITO', label: 'Distrito (Ropa · Departamental premium)' },
  { value: 'ATELIER', label: 'Atelier (Ropa · Alta costura)' },
  { value: 'OFICIO', label: 'Oficio (Ropa · Corporativo)' },
  { value: 'BAZAR', label: 'Bazar Central (Marketplace · estilo Amazon)' },
  { value: 'VITRINA', label: 'Vitrina Abierta (Marketplace · estilo eBay)' },
  { value: 'SOLMARKET', label: 'Sol Market (Marketplace · dirección propia)' },
];

const ETIQUETA_MENU: Record<ClaveMenuTienda, string> = {
  inicio: 'Inicio',
  categorias: 'Categorías',
  carrito: 'Carrito',
  cuenta: 'Mi cuenta',
};

const TEMA_DEFAULT: TemaTienda = {
  colorAcento: null,
  colorFondo: null,
  colorSuperficie: null,
  colorTexto: null,
  fuenteDisplay: null,
  fuenteBody: null,
  tamanoFuente: 'MEDIANO',
  radioTarjeta: 'SUAVE',
  sombraTarjeta: true,
  proporcionImagen: 'CUADRADA',
  menu: MENU_DEFAULT,
  estiloInsigniaOferta: 'CLASICO',
  mostrarSeccionOfertas: true,
  estiloInsigniaSinStock: 'ETIQUETA',
};

const ETIQUETA_ESTILO_INSIGNIA: Record<TemaTienda['estiloInsigniaOferta'], string> = {
  CLASICO: 'Clásico',
  AHORRO: 'Ahorro explícito',
  CINTA: 'Cinta de esquina',
};

const ETIQUETA_ESTILO_INSIGNIA_SIN_STOCK: Record<TemaTienda['estiloInsigniaSinStock'], string> = {
  ETIQUETA: 'Insignia sólida',
  CINTA: 'Cinta de esquina',
  TEXTO: 'Texto discreto',
};

/** Defaults neutros solo para el preview del panel — no tienen relación con ninguna de las 17 plantillas reales. */
const PREVIEW_DEFAULTS: DefaultsTemaPlantilla = {
  colorAcento: '#c4472b',
  colorFondo: '#f7f6f3',
  colorSuperficie: '#ffffff',
  colorTexto: '#171512',
  fuenteDisplay: 'DM Sans',
  fuenteBody: 'DM Sans',
};

const PRODUCTO_PREVIEW_BASE = {
  codigo: 'DEMO',
  imagen: null,
  imagenAjuste: 'CUBRIR',
  porcentajeItbis: '18',
  tipo: 'PRODUCTO',
  categoria: null,
  stock: 10,
  varianteId: 'preview',
  tieneVariantes: false,
  sinStock: false,
} as const;

const PREVIEW_DESCUENTO: ProductoTienda = {
  ...PRODUCTO_PREVIEW_BASE,
  id: 'preview-descuento',
  nombre: 'Blazer entallado',
  precio: '2490',
  oferta: { tipo: 'DESCUENTO', precioConDescuento: 1990, ahorro: 500, porcentaje: 20 },
};

const PREVIEW_BOGO: ProductoTienda = {
  ...PRODUCTO_PREVIEW_BASE,
  id: 'preview-bogo',
  nombre: 'Camisa de lino',
  precio: '1290',
  oferta: { tipo: 'BOGO', comprarCantidad: 1, llevarCantidad: 1, porcentajeDescuentoLlevar: 100 },
};

const PREVIEW_SIN_STOCK: ProductoTienda = {
  ...PRODUCTO_PREVIEW_BASE,
  id: 'preview-sin-stock',
  nombre: 'Pantalón de vestir',
  precio: '1890',
  oferta: null,
  stock: 0,
  sinStock: true,
};

/** Agrupa visualmente los ~7 conceptos de la pestaña Personalización (Fase 15) — antes eran una sola columna continua sin ninguna separación. */
function SeccionPersonalizacion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</h3>
      {descripcion && <p className="mb-3 mt-1 text-xs text-slate-500 dark:text-slate-400">{descripcion}</p>}
      <div className={clsx('flex flex-col gap-4', !descripcion && 'mt-3')}>{children}</div>
    </div>
  );
}

/**
 * Parseo defensivo espejo de `resolverTemaTienda` (backend) — acá no hace
 * falta validar cada campo contra su unión de valores válidos porque la
 * única fuente que escribe esta clave es este mismo formulario (controles
 * cerrados, sin texto libre); solo hay que blindar contra un JSON
 * corrupto o un cambio de forma entre versiones.
 */
function parsearTemaGuardado(valorJson: string, colorAcentoLegacy: string): TemaTienda {
  try {
    const parseado = JSON.parse(valorJson);
    return {
      ...TEMA_DEFAULT,
      ...parseado,
      colorAcento: parseado.colorAcento ?? (colorAcentoLegacy || null),
      menu: Array.isArray(parseado.menu) && parseado.menu.length === MENU_DEFAULT.length ? parseado.menu : MENU_DEFAULT,
    };
  } catch {
    return { ...TEMA_DEFAULT, colorAcento: colorAcentoLegacy || null };
  }
}

interface BannerAnuncioForm {
  mensajes: MensajeBannerAnuncio[];
  intervaloSegundos: number;
}

const BANNER_ANUNCIO_DEFAULT: BannerAnuncioForm = { mensajes: [], intervaloSegundos: 5 };

/**
 * Parseo defensivo espejo de `resolverBannerAnuncio` (backend) — antes de
 * esta extensión la clave guardaba un string plano (un único mensaje,
 * siempre blanco sobre el acento del tema). Si el valor guardado no es
 * JSON, se materializa como ese mensaje legado con el acento ACTUAL como
 * color de fondo (en vez de "hereda del tema") — apenas el admin guarda una
 * vez desde este editor, el mensaje pasa a tener un color explícito, ya no
 * legado.
 */
function parsearBannerAnuncioGuardado(valorCrudo: string, colorAcentoActual: string): BannerAnuncioForm {
  if (!valorCrudo) return BANNER_ANUNCIO_DEFAULT;
  try {
    const parseado = JSON.parse(valorCrudo);
    if (parseado && Array.isArray(parseado.mensajes)) {
      return {
        mensajes: parseado.mensajes.map((m: Partial<MensajeBannerAnuncio>) => ({
          texto: m.texto ?? '',
          colorFondo: m.colorFondo ?? colorAcentoActual,
          colorTexto: m.colorTexto ?? '#ffffff',
          tamanoFuente: m.tamanoFuente ?? 'NORMAL',
        })),
        intervaloSegundos: typeof parseado.intervaloSegundos === 'number' ? parseado.intervaloSegundos : 5,
      };
    }
  } catch {
    // no era JSON — es el string legado, tratado abajo.
  }
  return { mensajes: [{ texto: valorCrudo, colorFondo: colorAcentoActual, colorTexto: '#ffffff', tamanoFuente: 'NORMAL' }], intervaloSegundos: 5 };
}

/**
 * Configuración de la Tienda Online (plugin e-commerce v1) — guarda en el
 * store genérico `Configuracion` (mismo backend/endpoint que
 * `PersonalizacionDocumentosPanel`, ver ese componente para el criterio).
 * El storefront público (`/tienda/:subdominio`, Fase 2) lee estos mismos
 * valores vía `EcommerceService.obtenerConfig`.
 */
export function TiendaOnlineConfigPanel() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'general' | 'personalizacion'>('general');
  const [activa, setActiva] = useState(false);
  const [nombre, setNombre] = useState('');
  const [plantilla, setPlantilla] = useState('DIRECTO');
  const [logo, setLogo] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [colorAcento, setColorAcento] = useState('#f59e0b');
  const [bodegaId, setBodegaId] = useState('');
  const [bannerAnuncio, setBannerAnuncio] = useState<BannerAnuncioForm>(BANNER_ANUNCIO_DEFAULT);
  const [tema, setTema] = useState<TemaTienda>(TEMA_DEFAULT);

  const { data: configuraciones } = useQuery({
    queryKey: ['admin-configuraciones'],
    queryFn: async () => (await apiClient.get<Configuracion[]>('/admin/configuraciones')).data,
  });

  useEffect(() => {
    if (!configuraciones) return;
    const valor = (clave: string) => configuraciones.find((c) => c.clave === clave)?.valor ?? '';
    setActiva(valor(CLAVE_ACTIVA) === 'true');
    setNombre(valor(CLAVE_NOMBRE));
    setPlantilla(valor(CLAVE_PLANTILLA) || 'DIRECTO');
    setLogo(valor(CLAVE_LOGO) || null);
    setBanner(valor(CLAVE_BANNER) || null);
    setColorAcento(valor(CLAVE_COLOR_ACENTO) || '#f59e0b');
    setBodegaId(valor(CLAVE_BODEGA_ID));
    setBannerAnuncio(parsearBannerAnuncioGuardado(valor(CLAVE_BANNER_TEXTO), valor(CLAVE_COLOR_ACENTO) || '#111827'));
    const valorTema = valor(CLAVE_TEMA);
    setTema(valorTema ? parsearTemaGuardado(valorTema, valor(CLAVE_COLOR_ACENTO)) : { ...TEMA_DEFAULT, colorAcento: valor(CLAVE_COLOR_ACENTO) || null });
  }, [configuraciones]);

  const guardar = useMutation({
    mutationFn: async () =>
      Promise.all([
        apiClient.put(`/admin/configuraciones/${CLAVE_ACTIVA}`, { valor: activa ? 'true' : 'false' }),
        apiClient.put(`/admin/configuraciones/${CLAVE_NOMBRE}`, { valor: nombre }),
        apiClient.put(`/admin/configuraciones/${CLAVE_PLANTILLA}`, { valor: plantilla }),
        apiClient.put(`/admin/configuraciones/${CLAVE_LOGO}`, { valor: logo ?? '' }),
        apiClient.put(`/admin/configuraciones/${CLAVE_BANNER}`, { valor: banner ?? '' }),
        apiClient.put(`/admin/configuraciones/${CLAVE_COLOR_ACENTO}`, { valor: colorAcento }),
        apiClient.put(`/admin/configuraciones/${CLAVE_BODEGA_ID}`, { valor: bodegaId }),
        apiClient.put(`/admin/configuraciones/${CLAVE_TEMA}`, { valor: JSON.stringify(tema) }),
        apiClient.put(`/admin/configuraciones/${CLAVE_BANNER_TEXTO}`, { valor: JSON.stringify(bannerAnuncio) }),
      ]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-configuraciones'] }),
  });

  // Estado ya GUARDADO (no el del formulario sin guardar) — el enlace solo
  // debe habilitarse cuando de verdad va a responder 200, no cuando el
  // usuario recién tildó el checkbox sin haber apretado "Guardar" todavía.
  const activaGuardada = configuraciones?.find((c) => c.clave === CLAVE_ACTIVA)?.valor === 'true';
  const subdominio = usuario?.tenant?.subdominio;
  const urlTienda = subdominio ? construirUrlTienda(subdominio) : null;

  function agregarMensajeBanner() {
    setBannerAnuncio({
      ...bannerAnuncio,
      mensajes: [...bannerAnuncio.mensajes, { texto: '', colorFondo: colorAcento, colorTexto: '#ffffff', tamanoFuente: 'NORMAL' }],
    });
  }
  function actualizarMensajeBanner(indice: number, cambios: Partial<MensajeBannerAnuncio>) {
    setBannerAnuncio({ ...bannerAnuncio, mensajes: bannerAnuncio.mensajes.map((m, i) => (i === indice ? { ...m, ...cambios } : m)) });
  }
  function quitarMensajeBanner(indice: number) {
    setBannerAnuncio({ ...bannerAnuncio, mensajes: bannerAnuncio.mensajes.filter((_, i) => i !== indice) });
  }

  function moverMenu(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion;
    if (destino < 0 || destino >= tema.menu.length) return;
    const menu = [...tema.menu];
    [menu[indice], menu[destino]] = [menu[destino], menu[indice]];
    setTema({ ...tema, menu });
  }

  return (
    <Card
      titulo="Tienda Online"
      descripcion="Storefront público de tu catálogo, sobre el mismo dominio — activalo, elegí una plantilla y personalizala."
    >
      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setTab('general')}
          className={`px-3 py-2 text-sm font-medium ${tab === 'general' ? 'border-b-2 border-sol-500 text-sol-600 dark:text-sol-400' : 'text-slate-500 dark:text-slate-400'}`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setTab('personalizacion')}
          className={`px-3 py-2 text-sm font-medium ${tab === 'personalizacion' ? 'border-b-2 border-sol-500 text-sol-600 dark:text-sol-400' : 'text-slate-500 dark:text-slate-400'}`}
        >
          Personalización
        </button>
      </div>

      {tab === 'general' && (
        <div className="space-y-4">
          {urlTienda && (
            <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Enlace de tu tienda
              </span>
              {activaGuardada ? (
                <a
                  href={urlTienda}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-sol-600 hover:underline dark:text-sol-400"
                >
                  {urlTienda}
                  <ExternalLink size={14} />
                </a>
              ) : (
                <>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{urlTienda}</span>
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Marcá "Tienda activa" y guardá para que este enlace funcione.
                  </span>
                </>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} className="h-4 w-4 rounded" />
            Tienda activa
          </label>

          <FormField
            id="tienda-nombre"
            label="Nombre de la tienda"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Se usa el nombre de la empresa si se deja vacío"
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="tienda-plantilla" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Plantilla
            </label>
            <Select id="tienda-plantilla" value={plantilla} onChange={(e) => setPlantilla(e.target.value)}>
              {PLANTILLAS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="tienda-bodega" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Bodega de la que se descuenta stock/precio
            </label>
            <SelectorBodega id="tienda-bodega" value={bodegaId} onChange={setBodegaId} />
          </div>

          <CampoImagen valor={logo} onChange={setLogo} label="Logo" />
          <CampoImagen valor={banner} onChange={setBanner} label="Banner" />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Banner de anuncio (slide)</label>
              <Button type="button" variante="secundario" onClick={agregarMensajeBanner}>
                Agregar mensaje
              </Button>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Sin mensajes no se muestra ningún anuncio. Con 2 o más, rotan solos arriba de la tienda.
            </span>

            {bannerAnuncio.mensajes.length > 1 && (
              <div className="flex items-center gap-2">
                <label htmlFor="tienda-banner-intervalo" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Intervalo del slide (segundos)
                </label>
                <input
                  id="tienda-banner-intervalo"
                  type="number"
                  min={2}
                  max={30}
                  value={bannerAnuncio.intervaloSegundos}
                  onChange={(e) => setBannerAnuncio({ ...bannerAnuncio, intervaloSegundos: Math.min(30, Math.max(2, Number(e.target.value) || 5)) })}
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {bannerAnuncio.mensajes.map((mensaje, indice) => (
              <div key={indice} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mensaje.texto}
                    onChange={(e) => actualizarMensajeBanner(indice, { texto: e.target.value })}
                    placeholder='Ej. "Envío gratis en compras desde RD$ 3,000"'
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => quitarMensajeBanner(indice)}
                    className="shrink-0 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Quitar
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Fondo
                    <input
                      type="color"
                      value={mensaje.colorFondo ?? colorAcento}
                      onChange={(e) => actualizarMensajeBanner(indice, { colorFondo: e.target.value })}
                      className="h-7 w-12 rounded border border-slate-300 dark:border-slate-700"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Texto
                    <input
                      type="color"
                      value={mensaje.colorTexto}
                      onChange={(e) => actualizarMensajeBanner(indice, { colorTexto: e.target.value })}
                      className="h-7 w-12 rounded border border-slate-300 dark:border-slate-700"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Tamaño
                    <Select
                      value={mensaje.tamanoFuente}
                      onChange={(e) => actualizarMensajeBanner(indice, { tamanoFuente: e.target.value as TamanoFuenteBanner })}
                      className="py-1 text-xs"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="GRANDE">Grande</option>
                      <option value="MUY_GRANDE">Muy grande</option>
                    </Select>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="tienda-color" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Color de acento
            </label>
            <input
              id="tienda-color"
              type="color"
              value={colorAcento}
              onChange={(e) => setColorAcento(e.target.value)}
              className="h-9 w-16 rounded border border-slate-300 dark:border-slate-700"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">Usado por Directo/Mercado/Boutique. El resto de las plantillas usa la pestaña Personalización.</span>
          </div>

          <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      )}

      {tab === 'personalizacion' && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <p className="pb-5 text-xs text-slate-500 dark:text-slate-400">
            Se aplica sobre la plantilla elegida en la pestaña General. No tiene efecto en Directo/Mercado/Boutique,
            que siguen usando el color de acento clásico de la pestaña General.
          </p>

          <SeccionPersonalizacion titulo="Colores">
            <div className="grid grid-cols-4 gap-3">
              {(
                [
                  ['colorAcento', 'Acento'],
                  ['colorFondo', 'Fondo'],
                  ['colorSuperficie', 'Tarjetas'],
                  ['colorTexto', 'Texto'],
                ] as const
              ).map(([campo, etiqueta]) => (
                <div key={campo} className="flex flex-col items-center gap-1">
                  <input
                    type="color"
                    value={tema[campo] ?? '#888888'}
                    onChange={(e) => setTema({ ...tema, [campo]: e.target.value })}
                    className="h-9 w-full rounded border border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{etiqueta}</span>
                </div>
              ))}
            </div>
          </SeccionPersonalizacion>

          <SeccionPersonalizacion titulo="Tipografía">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="tema-fuente-display" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Fuente de títulos
                </label>
                <Select
                  id="tema-fuente-display"
                  value={tema.fuenteDisplay ?? ''}
                  onChange={(e) => setTema({ ...tema, fuenteDisplay: (e.target.value || null) as TemaTienda['fuenteDisplay'] })}
                >
                  <option value="">(automático de la plantilla)</option>
                  {FUENTES_TIENDA.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="tema-fuente-body" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Fuente de texto
                </label>
                <Select
                  id="tema-fuente-body"
                  value={tema.fuenteBody ?? ''}
                  onChange={(e) => setTema({ ...tema, fuenteBody: (e.target.value || null) as TemaTienda['fuenteBody'] })}
                >
                  <option value="">(automático de la plantilla)</option>
                  {FUENTES_TIENDA.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="tema-tamano" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Tamaño de fuente
              </label>
              <Select
                id="tema-tamano"
                value={tema.tamanoFuente}
                onChange={(e) => setTema({ ...tema, tamanoFuente: e.target.value as TemaTienda['tamanoFuente'] })}
              >
                {TAMANOS_FUENTE_TIENDA.map((t) => (
                  <option key={t} value={t}>
                    {t === 'CHICO' ? 'Chico' : t === 'MEDIANO' ? 'Mediano' : 'Grande'}
                  </option>
                ))}
              </Select>
            </div>
          </SeccionPersonalizacion>

          <SeccionPersonalizacion titulo="Tarjetas de producto">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="tema-radio" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Esquinas de tarjeta
                </label>
                <Select id="tema-radio" value={tema.radioTarjeta} onChange={(e) => setTema({ ...tema, radioTarjeta: e.target.value as TemaTienda['radioTarjeta'] })}>
                  {RADIOS_TARJETA_TIENDA.map((r) => (
                    <option key={r} value={r}>
                      {r === 'RECTA' ? 'Rectas' : r === 'SUAVE' ? 'Suaves' : 'Redondeadas'}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="tema-ratio" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Proporción de foto
                </label>
                <Select
                  id="tema-ratio"
                  value={tema.proporcionImagen}
                  onChange={(e) => setTema({ ...tema, proporcionImagen: e.target.value as TemaTienda['proporcionImagen'] })}
                >
                  {PROPORCIONES_IMAGEN_TIENDA.map((p) => (
                    <option key={p} value={p}>
                      {p === 'CUADRADA' ? 'Cuadrada' : p === 'VERTICAL' ? 'Vertical' : 'Panorámica'}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={tema.sombraTarjeta}
                onChange={(e) => setTema({ ...tema, sombraTarjeta: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              Sombra en la tarjeta
            </label>
          </SeccionPersonalizacion>

          <SeccionPersonalizacion titulo="Sección de Ofertas" descripcion='Franja informativa con las ofertas vigentes (ej. "10% OFF en Camisas"), arriba del catálogo en el Home.'>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={tema.mostrarSeccionOfertas}
                onChange={(e) => setTema({ ...tema, mostrarSeccionOfertas: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              Mostrar la sección de Ofertas en el Home
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Apagarla no oculta la insignia de oferta en cada producto (más abajo) — solo esta franja aparte.
            </p>
          </SeccionPersonalizacion>

          <SeccionPersonalizacion
            titulo="Insignia de oferta en la tarjeta"
            descripcion='Cómo se muestra un producto con oferta vigente en catálogo, Destacados y "También te puede interesar".'
          >
            <div className="grid grid-cols-3 gap-2">
              {ESTILOS_INSIGNIA_OFERTA_TIENDA.map((estilo) => (
                <button
                  key={estilo}
                  type="button"
                  onClick={() => setTema({ ...tema, estiloInsigniaOferta: estilo })}
                  className={clsx(
                    'rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors',
                    tema.estiloInsigniaOferta === estilo
                      ? 'border-sol-500 bg-sol-50 text-sol-700 dark:bg-sol-500/10 dark:text-sol-300'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600',
                  )}
                >
                  {ETIQUETA_ESTILO_INSIGNIA[estilo]}
                </button>
              ))}
            </div>
            <div
              className="flex gap-4 rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700"
              style={variablesCssTema(tema, PREVIEW_DEFAULTS) as CSSProperties}
            >
              <div className="pointer-events-none w-32 shrink-0">
                <CarritoTiendaProvider subdominio="__preview_oferta__">
                  <TarjetaProductoTienda producto={PREVIEW_DESCUENTO} subdominio="__preview__" estiloInsignia={tema.estiloInsigniaOferta} />
                </CarritoTiendaProvider>
              </div>
              <div className="pointer-events-none w-32 shrink-0">
                <CarritoTiendaProvider subdominio="__preview_oferta__">
                  <TarjetaProductoTienda producto={PREVIEW_BOGO} subdominio="__preview__" estiloInsignia={tema.estiloInsigniaOferta} />
                </CarritoTiendaProvider>
              </div>
              <p className="self-center text-xs text-slate-500 dark:text-slate-400">
                Vista previa con datos de ejemplo — a la izquierda una oferta de porcentaje, a la derecha una 2×1.
              </p>
            </div>
          </SeccionPersonalizacion>

          <SeccionPersonalizacion
            titulo="Etiqueta de sin stock"
            descripcion="Cómo se muestra un producto o variante agotado en catálogo, Destacados, y en el selector de opciones del detalle. Reemplaza a la insignia de oferta cuando ambas aplicarían a la vez."
          >
            <div className="grid grid-cols-3 gap-2">
              {ESTILOS_INSIGNIA_SIN_STOCK_TIENDA.map((estilo) => (
                <button
                  key={estilo}
                  type="button"
                  onClick={() => setTema({ ...tema, estiloInsigniaSinStock: estilo })}
                  className={clsx(
                    'rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors',
                    tema.estiloInsigniaSinStock === estilo
                      ? 'border-sol-500 bg-sol-50 text-sol-700 dark:bg-sol-500/10 dark:text-sol-300'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600',
                  )}
                >
                  {ETIQUETA_ESTILO_INSIGNIA_SIN_STOCK[estilo]}
                </button>
              ))}
            </div>
            <div
              className="flex gap-4 rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700"
              style={variablesCssTema(tema, PREVIEW_DEFAULTS) as CSSProperties}
            >
              <div className="pointer-events-none w-32 shrink-0">
                <CarritoTiendaProvider subdominio="__preview_sin_stock__">
                  <TarjetaProductoTienda producto={PREVIEW_SIN_STOCK} subdominio="__preview__" estiloInsigniaSinStock={tema.estiloInsigniaSinStock} />
                </CarritoTiendaProvider>
              </div>
              <p className="self-center text-xs text-slate-500 dark:text-slate-400">Vista previa con un producto agotado de ejemplo.</p>
            </div>
          </SeccionPersonalizacion>

          <SeccionPersonalizacion titulo="Menú de navegación">
            <div className="flex flex-col gap-1.5">
              {tema.menu.map((item, i) => (
                <div key={item.clave} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 dark:border-slate-700">
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{ETIQUETA_MENU[item.clave]}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moverMenu(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200">
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverMenu(i, 1)}
                      disabled={i === tema.menu.length - 1}
                      className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={item.visible}
                      onChange={(e) => {
                        const menu = [...tema.menu];
                        menu[i] = { ...item, visible: e.target.checked };
                        setTema({ ...tema, menu });
                      }}
                      className="h-3.5 w-3.5 rounded"
                    />
                    Visible
                  </label>
                </div>
              ))}
            </div>
          </SeccionPersonalizacion>

          <div className="pt-5">
            <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
