/**
 * Valores válidos de los arrays de `PersonalizacionDocumentoTipo` — ver
 * el mismo conjunto en `backend/src/common/pdf/documento-pdf.ts`
 * (`ColumnaLinea`/`FilaTotal`, tipos TS sin existencia en runtime). Vive
 * acá para que el DTO pueda validar contra ellos con `@IsIn`.
 */
export const CAMPOS_EMISOR_CLIENTE = ['rnc', 'direccion', 'telefono'] as const;
export const COLUMNAS_LINEA = ['cantidad', 'precioUnitario', 'total'] as const;
export const TOTALES_VISIBLES = ['subtotal', 'descuento', 'itbis', 'total'] as const;
