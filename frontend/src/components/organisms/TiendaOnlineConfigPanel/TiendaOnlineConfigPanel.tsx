import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { CampoImagen } from '../../molecules/CampoImagen/CampoImagen';
import { SelectorBodega } from '../../molecules/SelectorBodega/SelectorBodega';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { useAuth } from '../../../hooks/useAuth';

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

const PLANTILLAS = [
  { value: 'DIRECTO', label: 'Directo' },
  { value: 'MERCADO', label: 'Mercado' },
  { value: 'BOUTIQUE', label: 'Boutique' },
];

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
  const [activa, setActiva] = useState(false);
  const [nombre, setNombre] = useState('');
  const [plantilla, setPlantilla] = useState('DIRECTO');
  const [logo, setLogo] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [colorAcento, setColorAcento] = useState('#f59e0b');
  const [bodegaId, setBodegaId] = useState('');

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
      ]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-configuraciones'] }),
  });

  // Estado ya GUARDADO (no el del formulario sin guardar) — el enlace solo
  // debe habilitarse cuando de verdad va a responder 200, no cuando el
  // usuario recién tildó el checkbox sin haber apretado "Guardar" todavía.
  const activaGuardada = configuraciones?.find((c) => c.clave === CLAVE_ACTIVA)?.valor === 'true';
  const subdominio = usuario?.tenant?.subdominio;
  const urlTienda = subdominio ? `${window.location.origin}/tienda/${subdominio}` : null;

  return (
    <Card
      titulo="Tienda Online"
      descripcion="Storefront público de tu catálogo, sobre el mismo dominio — activalo y elegí una plantilla."
    >
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
        </div>

        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Card>
  );
}
