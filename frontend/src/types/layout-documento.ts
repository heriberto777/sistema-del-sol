export type TipoBloque =
  | 'logo'
  | 'datos_empresa'
  | 'datos_cliente'
  | 'encabezado'
  | 'tabla_lineas'
  | 'totales'
  | 'qr'
  | 'firma'
  | 'texto_legal'
  | 'imagen_libre'
  | 'campo'
  | 'badge';

export type CampoEmisorCliente = 'rnc' | 'direccion' | 'telefono';
export type ColumnaLinea = 'cantidad' | 'precioUnitario' | 'total' | 'codigo' | 'categoria' | 'unidadMedida' | 'porcentajeItbis' | 'descuentoLinea';
export type FilaTotal = 'subtotal' | 'descuento' | 'itbis' | 'total';
/** Ver backend/src/common/pdf/campos-documento.ts — misma lista de claves. Las etiquetas vienen del backend (GET campos-disponibles), este tipo solo acota qué puede guardarse. */
export type ClaveCampoDocumento =
  | 'numero'
  | 'numero_interno'
  | 'ncf'
  | 'tipo_ncf'
  | 'fecha'
  | 'fecha_vencimiento'
  | 'tipoDocumento'
  | 'estado'
  | 'plazo_pago_dias'
  | 'responsable_nombre'
  | 'forma_pago_nombre'
  | 'referencia_pago'
  | 'motivo_nota'
  | 'motivo_anulacion'
  | 'motivo_rechazo'
  | 'bodega_nombre'
  | 'tasa_cambio'
  | 'pagada'
  | 'fecha_pago'
  | 'cliente_nombre'
  | 'cliente_rnc'
  | 'cliente_direccion'
  | 'cliente_telefono'
  | 'cliente_email'
  | 'cliente_nombre_contacto'
  | 'cliente_plazo_pago_dias'
  | 'emisor_nombre'
  | 'emisor_rnc'
  | 'emisor_direccion'
  | 'emisor_telefono'
  | 'emisor_email'
  | 'subtotal'
  | 'descuento'
  | 'itbis'
  | 'total'
  | 'total_moneda'
  | 'observaciones'
  | 'nota_pie'
  | 'proveedor_factura_numero'
  | 'proveedor_factura_monto'
  | 'fecha_recepcion';

/** Posición/tamaño en PORCENTAJE (0-100) del área útil de la página — igual criterio que el motor de render del backend (documento-pdf-layout.ts), para que el mismo layout sirva en Carta y A4. */
export interface BloqueLayout {
  tipo: TipoBloque;
  x: number;
  y: number;
  w: number;
  h: number;
  campos?: CampoEmisorCliente[];
  columnas?: ColumnaLinea[];
  filas?: FilaTotal[];
  imagen?: string;
  /** Solo para tipo "campo"/"badge" — ver ClaveCampoDocumento. */
  campo?: ClaveCampoDocumento;
  /** Solo para tipo "campo" — prefijo opcional, ej. "Factura No.". */
  etiqueta?: string;
  /** "Formato de Documentos" Fase F — color de fondo propio del bloque (cualquier tipo). Sin esto, sin fondo. */
  colorFondo?: string;
  /** Color de texto propio del bloque. Sin esto, el color por defecto de ese tipo (en "badge", blanco). */
  colorTexto?: string;
  /** Solo para tipo "tabla_lineas" — fondo del renglón de encabezado de la tabla. */
  colorEncabezado?: string;
  /** Solo para tipo "tabla_lineas" — color de texto del encabezado (blanco por defecto si hay colorEncabezado). */
  colorTextoEncabezado?: string;
}

export const ETIQUETA_BLOQUE: Record<TipoBloque, string> = {
  logo: 'Logo',
  datos_empresa: 'Datos de la empresa',
  datos_cliente: 'Datos del cliente',
  encabezado: 'Encabezado',
  tabla_lineas: 'Tabla de líneas',
  totales: 'Totales',
  qr: 'Código QR',
  firma: 'Firma',
  texto_legal: 'Texto legal',
  imagen_libre: 'Imagen libre',
  campo: 'Campo suelto',
  badge: 'Pastilla de color',
};

/** Cada tipo de bloque, salvo "imagen_libre", "campo" y "badge", puede aparecer una sola vez por documento — un campo suelto o una pastilla sí se repiten. */
export const BLOQUES_UNICOS: TipoBloque[] = ['logo', 'datos_empresa', 'datos_cliente', 'encabezado', 'tabla_lineas', 'totales', 'qr', 'firma', 'texto_legal'];

/**
 * "Formato de Documentos" Fase G — editor básico del ticket térmico
 * (80mm/58mm): a diferencia de `BloqueLayout` (posición libre x/y), acá
 * el layout es una lista ORDENADA — el orden del array es el orden de
 * impresión, apilado vertical. Ver backend/src/common/pdf/documento-ticket.ts.
 */
export type TipoBloqueTermico = 'logo' | 'encabezado' | 'cliente' | 'tabla_lineas' | 'totales' | 'campo' | 'observaciones' | 'texto_legal';

export interface BloqueTermico {
  tipo: TipoBloqueTermico;
  /** Solo para tipo "campo" — ver ClaveCampoDocumento. */
  campo?: ClaveCampoDocumento;
  /** Solo para tipo "campo" — prefijo opcional, ej. "Mesa:". */
  etiqueta?: string;
}

export const ETIQUETA_BLOQUE_TERMICO: Record<TipoBloqueTermico, string> = {
  logo: 'Logo',
  encabezado: 'Encabezado (tipo, número, fecha)',
  cliente: 'Datos del cliente',
  tabla_lineas: 'Tabla de líneas',
  totales: 'Totales',
  campo: 'Campo suelto',
  observaciones: 'Observaciones',
  texto_legal: 'Nota de pie / texto legal',
};

/** Orden/contenido por defecto — EXACTAMENTE el diseño fijo de siempre del ticket, para que "empezar a editar" parta de algo conocido. */
export const BLOQUES_TERMICO_DEFECTO: BloqueTermico[] = [
  { tipo: 'logo' },
  { tipo: 'encabezado' },
  { tipo: 'cliente' },
  { tipo: 'tabla_lineas' },
  { tipo: 'totales' },
  { tipo: 'observaciones' },
  { tipo: 'texto_legal' },
];
