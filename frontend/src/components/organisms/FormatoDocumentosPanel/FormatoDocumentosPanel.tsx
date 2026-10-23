import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { abrirBlob } from '../../../lib/descargar-archivo';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { CampoImagen } from '../../molecules/CampoImagen/CampoImagen';
import { EditorLayoutDocumento } from '../EditorLayoutDocumento/EditorLayoutDocumento';
import { BloqueLayout } from '../../../types/layout-documento';

type TipoDocumento = 'FACTURA' | 'COTIZACION' | 'REMISION' | 'ORDEN_COMPRA';
type QrContenido = 'LINK_PAGO' | 'TEXTO_LIBRE';

interface TipoPersonalizacion {
  tipoDocumento: TipoDocumento;
  etiqueta: string;
  camposEmisorVisibles: string[];
  camposClienteVisibles: string[];
  columnasLinea: string[];
  totalesVisibles: string[];
  textoLegal: string;
  qrHabilitado: boolean;
  qrContenido: QrContenido | null;
  qrValor: string;
  firmaHabilitada: boolean;
  firmaEtiqueta: string;
  firmaImagen: string;
  observacionesVisibles: boolean;
  layoutPersonalizado: BloqueLayout[] | null;
}

interface PersonalizacionDocumentos {
  colorAcentoDocumentos: string | null;
  logo: string | null;
  tipos: TipoPersonalizacion[];
}

const CAMPOS_EMISOR = [
  { value: 'rnc', label: 'RNC' },
  { value: 'direccion', label: 'Dirección' },
  { value: 'telefono', label: 'Teléfono' },
] as const;

const CAMPOS_CLIENTE = [
  { value: 'rnc', label: 'RNC/Cédula' },
  { value: 'direccion', label: 'Dirección' },
  { value: 'telefono', label: 'Teléfono' },
] as const;

const COLUMNAS = [
  { value: 'cantidad', label: 'Cantidad' },
  { value: 'precioUnitario', label: 'Precio unitario' },
  { value: 'total', label: 'Total' },
] as const;

const TOTALES = [
  { value: 'subtotal', label: 'Subtotal' },
  { value: 'descuento', label: 'Descuento' },
  { value: 'itbis', label: 'ITBIS' },
  { value: 'total', label: 'Total' },
] as const;

function alternar(lista: string[], valor: string): string[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

export function FormatoDocumentosPanel() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TipoDocumento>('FACTURA');
  const [color, setColor] = useState('');
  const [errorMarca, setErrorMarca] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['formato-documentos'],
    queryFn: async () => (await apiClient.get<PersonalizacionDocumentos>('/admin/personalizacion-documentos')).data,
  });

  useEffect(() => {
    if (data) setColor(data.colorAcentoDocumentos ?? '');
  }, [data]);

  const guardarMarca = useMutation({
    mutationFn: async () => apiClient.put('/admin/personalizacion-documentos/marca', { colorAcentoDocumentos: color }),
    onSuccess: () => {
      setErrorMarca(null);
      queryClient.invalidateQueries({ queryKey: ['formato-documentos'] });
    },
    onError: (err) => setErrorMarca(mensajeErrorApi(err, 'No se pudo guardar el color.')),
  });

  return (
    <div className="space-y-4">
      <Card
        titulo="Marca"
        descripcion="Color aplicado a las 5 plantillas de documentos (encabezados, totales, líneas). El logo se administra en Seguridad y Administración → Configuración → Documentos (branding)."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="color-acento" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Color de acento
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#c7922f'}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-slate-300 dark:border-slate-700"
                aria-label="Elegir color de acento"
              />
              <input
                id="color-acento"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#c7922f"
                className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-sol-500 focus:ring-1 focus:ring-sol-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {color && (
                <button type="button" onClick={() => setColor('')} className="text-xs text-red-600 hover:underline dark:text-red-400">
                  Quitar
                </button>
              )}
            </div>
          </div>
          <Button onClick={() => guardarMarca.mutate()} disabled={guardarMarca.isPending}>
            {guardarMarca.isPending ? 'Guardando…' : 'Guardar color'}
          </Button>
        </div>
        {errorMarca && <p className="mt-2 text-sm text-red-600">{errorMarca}</p>}
      </Card>

      <Card sinPadding titulo="Formato por tipo de documento">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 dark:border-slate-800">
          {data?.tipos.map((t) => (
            <button
              key={t.tipoDocumento}
              onClick={() => setTab(t.tipoDocumento)}
              className={clsx(
                'shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
                tab === t.tipoDocumento ? 'border-sol-500 text-sol-600 dark:text-sol-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400',
              )}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
        <div className="p-5">{data && <FormularioTipo key={tab} tipo={data.tipos.find((t) => t.tipoDocumento === tab)!} />}</div>
      </Card>
    </div>
  );
}

function FormularioTipo({ tipo }: { tipo: TipoPersonalizacion }) {
  const [modoEditor, setModoEditor] = useState(tipo.layoutPersonalizado !== null);

  if (modoEditor) {
    return <EditorLayoutDocumento tipoDocumento={tipo.tipoDocumento} bloquesGuardados={tipo.layoutPersonalizado} onCerrar={() => setModoEditor(false)} />;
  }

  return (
    <div className="space-y-4">
      {tipo.layoutPersonalizado !== null && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-sol-300 bg-sol-50 px-4 py-2.5 text-sm text-sol-800 dark:border-sol-800 dark:bg-sol-900/30 dark:text-sol-200">
          <span>Este documento ya tiene un editor visual personalizado activo — los campos de abajo no se usan mientras esté activo.</span>
          <Button type="button" variante="secundario" onClick={() => setModoEditor(true)}>
            Editar layout
          </Button>
        </div>
      )}
      <FormularioSimple tipo={tipo} />
      <button type="button" onClick={() => setModoEditor(true)} className="text-xs text-sol-600 hover:underline dark:text-sol-400">
        Usar editor visual (mover y redimensionar bloques libremente) →
      </button>
    </div>
  );
}

function FormularioSimple({ tipo }: { tipo: TipoPersonalizacion }) {
  const queryClient = useQueryClient();
  const esRemision = tipo.tipoDocumento === 'REMISION';

  const [camposEmisor, setCamposEmisor] = useState(tipo.camposEmisorVisibles);
  const [camposCliente, setCamposCliente] = useState(tipo.camposClienteVisibles);
  const [columnas, setColumnas] = useState(tipo.columnasLinea);
  const [totales, setTotales] = useState(tipo.totalesVisibles);
  const [textoLegal, setTextoLegal] = useState(tipo.textoLegal);
  const [qrHabilitado, setQrHabilitado] = useState(tipo.qrHabilitado);
  const [qrContenido, setQrContenido] = useState<QrContenido>(tipo.qrContenido ?? 'LINK_PAGO');
  const [qrValor, setQrValor] = useState(tipo.qrValor);
  const [firmaHabilitada, setFirmaHabilitada] = useState(tipo.firmaHabilitada);
  const [firmaEtiqueta, setFirmaEtiqueta] = useState(tipo.firmaEtiqueta);
  const [firmaImagen, setFirmaImagen] = useState<string | null>(tipo.firmaImagen || null);
  const [observacionesVisibles, setObservacionesVisibles] = useState(tipo.observacionesVisibles);
  const [error, setError] = useState<string | null>(null);
  const [previsualizando, setPrevisualizando] = useState(false);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.put(`/admin/personalizacion-documentos/${tipo.tipoDocumento}`, {
        camposEmisorVisibles: camposEmisor,
        camposClienteVisibles: camposCliente,
        columnasLinea: columnas,
        totalesVisibles: totales,
        textoLegal,
        qrHabilitado,
        qrContenido,
        qrValor,
        firmaHabilitada,
        firmaEtiqueta,
        firmaImagen: firmaImagen ?? '',
        observacionesVisibles,
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['formato-documentos'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el formato.')),
  });

  async function previsualizar() {
    setPrevisualizando(true);
    setError(null);
    try {
      const respuesta = await apiClient.get(`/admin/personalizacion-documentos/${tipo.tipoDocumento}/preview`, { responseType: 'blob' });
      abrirBlob(new Blob([respuesta.data], { type: 'application/pdf' }));
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo generar la vista previa.'));
    } finally {
      setPrevisualizando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <GrupoCasillas titulo="Datos de la empresa a mostrar" opciones={CAMPOS_EMISOR} valores={camposEmisor} onChange={(v) => setCamposEmisor(alternar(camposEmisor, v))} />
        <GrupoCasillas titulo="Datos del cliente a mostrar" opciones={CAMPOS_CLIENTE} valores={camposCliente} onChange={(v) => setCamposCliente(alternar(camposCliente, v))} />
      </div>

      {esRemision ? (
        <p className="text-xs text-slate-400">Remisión no muestra precios ni totales — no aplica elegir columnas ni totales para este tipo.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <GrupoCasillas titulo="Columnas de la tabla" opciones={COLUMNAS} valores={columnas} onChange={(v) => setColumnas(alternar(columnas, v))} />
          <GrupoCasillas titulo="Totales a mostrar" opciones={TOTALES} valores={totales} onChange={(v) => setTotales(alternar(totales, v))} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="texto-legal" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Texto legal / notas de {tipo.etiqueta.toLowerCase()}
        </label>
        <textarea
          id="texto-legal"
          value={textoLegal}
          onChange={(e) => setTextoLegal(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Ej: Precios sujetos a cambio sin previo aviso."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-1 focus:ring-sol-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={qrHabilitado} onChange={(e) => setQrHabilitado(e.target.checked)} />
          Código QR
        </label>
        {qrHabilitado && (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Contenido</label>
              <Select value={qrContenido} onChange={(e) => setQrContenido(e.target.value as QrContenido)} className="w-44">
                <option value="LINK_PAGO">Link de pago</option>
                <option value="TEXTO_LIBRE">Texto/URL libre</option>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{qrContenido === 'LINK_PAGO' ? 'URL de pago' : 'Texto o URL'}</label>
              <input
                value={qrValor}
                onChange={(e) => setQrValor(e.target.value)}
                placeholder={qrContenido === 'LINK_PAGO' ? 'https://...' : 'Texto o URL a codificar'}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-1 focus:ring-sol-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={firmaHabilitada} onChange={(e) => setFirmaHabilitada(e.target.checked)} />
          Firma
        </label>
        {firmaHabilitada && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Etiqueta</label>
              <input
                value={firmaEtiqueta}
                onChange={(e) => setFirmaEtiqueta(e.target.value)}
                placeholder="Autorizado por"
                className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-1 focus:ring-sol-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <CampoImagen valor={firmaImagen} onChange={setFirmaImagen} label="Imagen de firma/sello (opcional)" />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={observacionesVisibles} onChange={(e) => setObservacionesVisibles(e.target.checked)} />
          Observaciones del documento
        </label>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Imprime el campo de Observaciones que se escribe al crear cada {tipo.etiqueta.toLowerCase()}, cuando lo trae lleno. Desactivado, nunca se
          imprime aunque el documento sí lo tenga.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button type="button" variante="secundario" onClick={previsualizar} disabled={previsualizando}>
          {previsualizando ? 'Generando…' : 'Vista previa'}
        </Button>
        <span className="text-xs text-slate-400">La vista previa usa la última configuración guardada.</span>
      </div>
    </div>
  );
}

function GrupoCasillas({
  titulo,
  opciones,
  valores,
  onChange,
}: {
  titulo: string;
  opciones: readonly { value: string; label: string }[];
  valores: string[];
  onChange: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{titulo}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {opciones.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={valores.includes(o.value)} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
