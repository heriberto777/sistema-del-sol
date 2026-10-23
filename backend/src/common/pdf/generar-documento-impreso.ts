import { FormatoImpresion, PlantillaDocumento, TipoDocumentoImpreso } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentoPdfParams, generarDocumentoPdf } from './documento-pdf';
import { LayoutDocumento, generarDocumentoPdfLayout } from './documento-pdf-layout';
import { LayoutTermico, generarDocumentoTicketHtml } from './documento-ticket';
import { resolverPlantillaDocumento } from '../impresion/resolver-plantilla-documento';
import { resolverPersonalizacionDocumento } from '../impresion/resolver-personalizacion-documento';

/**
 * Punto único donde Facturación/Cotizaciones/Remisiones/Compras deciden
 * CÓMO imprimir — antes repetido en cada `generarImpreso()`. "Formato de
 * Documentos" Fase C agrega una rama de layout de bloques libres para
 * Carta/A4 (`layoutPersonalizado`, SIEMPRE gana sobre `plantilla` cuando
 * está presente); Fase G agrega el equivalente para térmico
 * (`layoutTermico`, lista ordenada de bloques apilados — ver
 * documento-ticket.ts, un paradigma distinto del canvas x/y porque un
 * ticket es un rollo continuo sin alto fijo).
 */
export async function generarDocumentoImpreso(
  params: DocumentoPdfParams,
  formato: FormatoImpresion,
  plantilla: PlantillaDocumento,
  layoutPersonalizado?: LayoutDocumento | null,
  layoutTermico?: LayoutTermico | null,
): Promise<{ buffer: Buffer; contentType: string }> {
  if (formato === 'TERMICA_80MM' || formato === 'TERMICA_58MM') {
    return { buffer: Buffer.from(generarDocumentoTicketHtml(params, formato, layoutTermico), 'utf-8'), contentType: 'text/html; charset=utf-8' };
  }

  const tamanoPagina = formato === 'A4' ? 'a4' : 'letter';
  const buffer = layoutPersonalizado
    ? await generarDocumentoPdfLayout(params, layoutPersonalizado, { tamanoPagina })
    : await generarDocumentoPdf(params, { tamanoPagina, plantilla });
  return { buffer, contentType: 'application/pdf' };
}

/**
 * Para los casos que SIEMPRE son PDF (nunca térmico) y no pasan por
 * `/imprimir`: adjuntos de email (notificaciones, "enviar recibo"), el
 * link público del cliente, y las rutas `/pdf` viejas mantenidas por
 * compatibilidad. Resuelve plantilla + personalización (color de marca,
 * campos/columnas/totales, QR/firma, layout de bloques libres) de la
 * misma forma que `generarImpreso()` — antes cada uno de estos
 * call sites llamaba a `generarDocumentoPdf()` pelado, así que cambiar
 * `PLANTILLA_DOCUMENTO_DEFAULT` o el color de marca no se reflejaba ahí
 * (hallazgo real, reportado por el usuario: "todo el sistema está
 * desvinculado" de la plantilla configurada salvo la impresión directa).
 */
export async function generarPdfPersonalizado(
  prisma: PrismaService,
  tenantId: string,
  tipoDocumento: TipoDocumentoImpreso,
  paramsBase: DocumentoPdfParams,
  bodegaId?: string | null,
): Promise<Buffer> {
  const [plantilla, personalizacion] = await Promise.all([
    resolverPlantillaDocumento(prisma, tenantId, bodegaId ?? null),
    resolverPersonalizacionDocumento(prisma, tenantId, tipoDocumento),
  ]);
  const { layoutPersonalizado, observacionesVisibles, ...resto } = personalizacion;
  const params = { ...paramsBase, ...resto, notas: observacionesVisibles ? paramsBase.notas : undefined };
  return layoutPersonalizado ? generarDocumentoPdfLayout(params, layoutPersonalizado) : generarDocumentoPdf(params, { plantilla });
}
