/**
 * Campos extraídos de una factura de proveedor (imagen o PDF) — todos
 * opcionales/nullable a propósito: el modelo puede no leer algún campo
 * con claridad, y esto nunca se aplica solo (ver FacturaProveedorNueva.tsx,
 * siempre pre-llena un formulario editable, nunca guarda directo).
 */
export interface FacturaExtraida {
  proveedorNombre: string | null;
  proveedorRnc: string | null;
  ncf: string | null;
  /** YYYY-MM-DD si se pudo leer, null si no. */
  fecha: string | null;
  concepto: string | null;
  subtotal: number | null;
  itbis: number | null;
  total: number | null;
}

/** Un adaptador por proveedor de IA con capacidad de visión — mismo criterio que AnalizadorImagenAdapter, interfaz separada porque la forma de salida es otra (un objeto estructurado, no una lista de candidatos). */
export interface ExtractorFacturaAdapter {
  readonly clave: string;
  readonly habilitado: boolean;
  /** `archivoBase64` sin el prefijo `data:...;base64,`. `mimeType` puede ser `image/*` o `application/pdf`. */
  extraer(archivoBase64: string, mimeType: string): Promise<FacturaExtraida>;
}
