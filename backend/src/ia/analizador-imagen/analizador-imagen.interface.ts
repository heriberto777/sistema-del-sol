/** Una opción de nombre/descripción sugerida a partir de la foto — el admin elige cuál usar, nunca se aplica sola (ver ProductosController). */
export interface CandidatoProducto {
  nombre: string;
  descripcion: string;
}

/** Un adaptador por proveedor de IA — ni el controller ni el resto del sistema conocen cuál está detrás (ver AnalizadorImagenService), mismo criterio que PasarelaPagoAdapter. */
export interface AnalizadorImagenAdapter {
  readonly clave: string;
  readonly habilitado: boolean;
  /** `imagenBase64` sin el prefijo `data:image/...;base64,` — ya separado por quien llama. */
  analizar(imagenBase64: string, mimeType: string): Promise<CandidatoProducto[]>;
}
