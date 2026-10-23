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
  | 'campo';

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
  | 'nota_pie';

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
  /** Solo para tipo "campo" — ver ClaveCampoDocumento. */
  campo?: ClaveCampoDocumento;
  /** Solo para tipo "campo" — prefijo opcional, ej. "Factura No.". */
  etiqueta?: string;
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
};

/** Cada tipo de bloque, salvo "imagen_libre" y "campo", puede aparecer una sola vez por documento — un campo suelto sí se repite (ej. número en una esquina, fecha en otra). */
export const BLOQUES_UNICOS: TipoBloque[] = ['logo', 'datos_empresa', 'datos_cliente', 'encabezado', 'tabla_lineas', 'totales', 'qr', 'firma', 'texto_legal'];
