import { FormatoImpresion, PlantillaDocumento } from '@prisma/client';
import { DocumentoPdfParams, generarDocumentoPdf } from './documento-pdf';
import { LayoutDocumento, generarDocumentoPdfLayout } from './documento-pdf-layout';
import { generarDocumentoTicketHtml } from './documento-ticket';

/**
 * Punto único donde Facturación/Cotizaciones/Remisiones deciden CÓMO
 * imprimir — antes repetido 3 veces en cada `generarImpreso()`. "Formato
 * de Documentos" Fase C agrega una tercera rama (layout de bloques
 * libres) a las dos que ya existían (térmico vs. una de las 5
 * `PlantillaDocumento` fijas); `layoutPersonalizado` SIEMPRE gana sobre
 * `plantilla` cuando está presente, salvo en térmico — los tickets
 * angostos siguen con su único layout fijo a propósito (ver
 * documento-ticket.ts).
 */
export async function generarDocumentoImpreso(
  params: DocumentoPdfParams,
  formato: FormatoImpresion,
  plantilla: PlantillaDocumento,
  layoutPersonalizado?: LayoutDocumento | null,
): Promise<{ buffer: Buffer; contentType: string }> {
  if (formato === 'TERMICA_80MM' || formato === 'TERMICA_58MM') {
    return { buffer: Buffer.from(generarDocumentoTicketHtml(params, formato), 'utf-8'), contentType: 'text/html; charset=utf-8' };
  }

  const tamanoPagina = formato === 'A4' ? 'a4' : 'letter';
  const buffer = layoutPersonalizado
    ? await generarDocumentoPdfLayout(params, layoutPersonalizado, { tamanoPagina })
    : await generarDocumentoPdf(params, { tamanoPagina, plantilla });
  return { buffer, contentType: 'application/pdf' };
}
