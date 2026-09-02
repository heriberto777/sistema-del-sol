import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { CampoImagen } from '../../molecules/CampoImagen/CampoImagen';
import { SelectorBodega } from '../../molecules/SelectorBodega/SelectorBodega';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { useAuth } from '../../../hooks/useAuth';
import {
  FUENTES_TIENDA,
  TAMANOS_FUENTE_TIENDA,
  RADIOS_TARJETA_TIENDA,
  PROPORCIONES_IMAGEN_TIENDA,
  MENU_DEFAULT,
  TemaTienda,
  ClaveMenuTienda,
} from '../../../pages/tienda/tema';

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
};

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
  const [bannerTexto, setBannerTexto] = useState('');
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
    setBannerTexto(valor(CLAVE_BANNER_TEXTO));
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
        apiClient.put(`/admin/configuraciones/${CLAVE_BANNER_TEXTO}`, { valor: bannerTexto }),
      ]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-configuraciones'] }),
  });

  // Estado ya GUARDADO (no el del formulario sin guardar) — el enlace solo
  // debe habilitarse cuando de verdad va a responder 200, no cuando el
  // usuario recién tildó el checkbox sin haber apretado "Guardar" todavía.
  const activaGuardada = configuraciones?.find((c) => c.clave === CLAVE_ACTIVA)?.valor === 'true';
  const subdominio = usuario?.tenant?.subdominio;
  const urlTienda = subdominio ? `${window.location.origin}/tienda/${subdominio}` : null;

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

          <div className="flex flex-col gap-1">
            <label htmlFor="tienda-banner-texto" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Banner de anuncio (texto)
            </label>
            <textarea
              id="tienda-banner-texto"
              rows={2}
              value={bannerTexto}
              onChange={(e) => setBannerTexto(e.target.value)}
              placeholder='Ej. "Envío gratis en compras desde RD$ 3,000" — se muestra arriba de todo en la tienda pública'
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">Dejalo vacío para no mostrar ningún anuncio.</span>
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
        <div className="space-y-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Se aplica sobre la plantilla elegida en la pestaña General. No tiene efecto en Directo/Mercado/Boutique,
            que siguen usando el color de acento clásico de la pestaña General.
          </p>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Colores</span>
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
          </div>

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

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Menú de navegación</span>
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
          </div>

          <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      )}
    </Card>
  );
}
