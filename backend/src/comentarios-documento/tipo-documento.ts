import { TipoDocumentoComentario } from '@prisma/client';

/** Etiqueta legible para notificaciones/UI — nunca el valor crudo del enum. */
export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumentoComentario, string> = {
  FACTURA: 'Factura',
  COTIZACION: 'Cotización',
};

/**
 * Permiso de "ver" del documento padre — comentar/listar comentarios
 * reusa ESTE permiso (no uno nuevo de "comentarios.ver"), mismo criterio
 * que "quien puede ver la factura puede dejarle una nota". Exportado acá
 * (no solo en el service) porque `RecordatoriosService` no necesita este
 * mapa, pero si algún día se agrega un tercer tipo de documento, este es
 * el único lugar a tocar junto con `ETIQUETA_TIPO_DOCUMENTO`.
 */
export const PERMISO_VER_POR_TIPO_DOCUMENTO: Record<TipoDocumentoComentario, string> = {
  FACTURA: 'facturacion.ver',
  COTIZACION: 'cotizaciones.ver',
};
