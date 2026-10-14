export type TipoBloque = 'logo' | 'datos_empresa' | 'datos_cliente' | 'encabezado' | 'tabla_lineas' | 'totales' | 'qr' | 'firma' | 'texto_legal' | 'imagen_libre';

export type CampoEmisorCliente = 'rnc' | 'direccion' | 'telefono';
export type ColumnaLinea = 'cantidad' | 'precioUnitario' | 'total';
export type FilaTotal = 'subtotal' | 'descuento' | 'itbis' | 'total';

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
};

/** Cada tipo de bloque, salvo "imagen_libre", puede aparecer una sola vez por documento — mantiene el editor simple para esta primera versión. */
export const BLOQUES_UNICOS: TipoBloque[] = ['logo', 'datos_empresa', 'datos_cliente', 'encabezado', 'tabla_lineas', 'totales', 'qr', 'firma', 'texto_legal'];
