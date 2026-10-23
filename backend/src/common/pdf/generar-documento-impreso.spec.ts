import { generarDocumentoImpreso, generarPdfPersonalizado } from './generar-documento-impreso';
import { PrismaService } from '../../prisma/prisma.service';
import { resolverPlantillaDocumento } from '../impresion/resolver-plantilla-documento';
import { resolverPersonalizacionDocumento } from '../impresion/resolver-personalizacion-documento';
import { generarDocumentoPdf, DocumentoPdfParams } from './documento-pdf';
import { generarDocumentoPdfLayout } from './documento-pdf-layout';
import { generarDocumentoTicketHtml } from './documento-ticket';

jest.mock('../impresion/resolver-plantilla-documento');
jest.mock('../impresion/resolver-personalizacion-documento');
jest.mock('./documento-pdf');
jest.mock('./documento-pdf-layout');
jest.mock('./documento-ticket');

const resolverPlantillaDocumentoMock = resolverPlantillaDocumento as jest.Mock;
const resolverPersonalizacionDocumentoMock = resolverPersonalizacionDocumento as jest.Mock;
const generarDocumentoPdfMock = generarDocumentoPdf as jest.Mock;
const generarDocumentoPdfLayoutMock = generarDocumentoPdfLayout as jest.Mock;
const generarDocumentoTicketHtmlMock = generarDocumentoTicketHtml as jest.Mock;

const PARAMS: DocumentoPdfParams = {
  tipoDocumento: 'Factura de venta',
  numero: 'B0200000001',
  fecha: new Date('2026-01-15'),
  cliente: 'Cliente Demo',
  lineas: [{ concepto: 'Producto A', cantidad: '1' }],
};

describe('generarDocumentoImpreso', () => {
  beforeEach(() => {
    generarDocumentoPdfMock.mockReset().mockResolvedValue(Buffer.from('%PDF-fake'));
    generarDocumentoPdfLayoutMock.mockReset().mockResolvedValue(Buffer.from('%PDF-layout'));
    generarDocumentoTicketHtmlMock.mockReset().mockReturnValue('<html>ticket</html>');
  });

  it('usa el HTML de ticket para formatos térmicos, ignorando plantilla/layout de Carta/A4 (pero pasando el layoutTermico propio)', async () => {
    const layoutTermico = { bloques: [{ tipo: 'encabezado' as const }] };
    const resultado = await generarDocumentoImpreso(PARAMS, 'TERMICA_80MM', 'EDITORIAL', { bloques: [] }, layoutTermico);

    expect(generarDocumentoTicketHtmlMock).toHaveBeenCalledWith(PARAMS, 'TERMICA_80MM', layoutTermico);
    expect(resultado.contentType).toBe('text/html; charset=utf-8');
    expect(generarDocumentoPdfMock).not.toHaveBeenCalled();
    expect(generarDocumentoPdfLayoutMock).not.toHaveBeenCalled();
  });

  it('usa el layout personalizado cuando está presente, para CARTA/A4', async () => {
    const layout = { bloques: [{ tipo: 'tabla_lineas' as const, x: 5, y: 10, w: 90, h: 40 }] };
    const resultado = await generarDocumentoImpreso(PARAMS, 'CARTA', 'EDITORIAL', layout);

    expect(generarDocumentoPdfLayoutMock).toHaveBeenCalledWith(PARAMS, layout, { tamanoPagina: 'letter' });
    expect(generarDocumentoPdfMock).not.toHaveBeenCalled();
    expect(resultado.contentType).toBe('application/pdf');
  });

  it('sin layout personalizado, usa la plantilla fija', async () => {
    const resultado = await generarDocumentoImpreso(PARAMS, 'A4', 'MINIMALISTA', null);

    expect(generarDocumentoPdfMock).toHaveBeenCalledWith(PARAMS, { tamanoPagina: 'a4', plantilla: 'MINIMALISTA' });
    expect(generarDocumentoPdfLayoutMock).not.toHaveBeenCalled();
    expect(resultado.contentType).toBe('application/pdf');
  });
});

describe('generarPdfPersonalizado', () => {
  const prisma = {} as PrismaService;

  beforeEach(() => {
    resolverPlantillaDocumentoMock.mockReset().mockResolvedValue('CLASICO');
    resolverPersonalizacionDocumentoMock.mockReset().mockResolvedValue({ colorAcento: '#c7922f', layoutPersonalizado: null });
    generarDocumentoPdfMock.mockReset().mockResolvedValue(Buffer.from('%PDF-fake'));
    generarDocumentoPdfLayoutMock.mockReset().mockResolvedValue(Buffer.from('%PDF-layout'));
  });

  it('resuelve plantilla y personalización con el tipoDocumento correcto, y genera con la plantilla fija por defecto', async () => {
    const buffer = await generarPdfPersonalizado(prisma, 'tenant-1', 'FACTURA', PARAMS, 'bodega-1');

    expect(resolverPlantillaDocumentoMock).toHaveBeenCalledWith(prisma, 'tenant-1', 'bodega-1');
    expect(resolverPersonalizacionDocumentoMock).toHaveBeenCalledWith(prisma, 'tenant-1', 'FACTURA');
    expect(generarDocumentoPdfMock).toHaveBeenCalledWith(expect.objectContaining({ ...PARAMS, colorAcento: '#c7922f' }), { plantilla: 'CLASICO' });
    expect(buffer.toString('latin1')).toBe('%PDF-fake');
  });

  it('sin bodegaId, resuelve la plantilla con null (no rompe cuando el documento no tiene bodega, ej. cotizaciones)', async () => {
    await generarPdfPersonalizado(prisma, 'tenant-1', 'COTIZACION', PARAMS);

    expect(resolverPlantillaDocumentoMock).toHaveBeenCalledWith(prisma, 'tenant-1', null);
  });

  it('con un layout personalizado guardado, usa el motor de layout en vez de la plantilla fija', async () => {
    const layout = { bloques: [{ tipo: 'tabla_lineas' as const, x: 5, y: 10, w: 90, h: 40 }] };
    resolverPersonalizacionDocumentoMock.mockResolvedValue({ colorAcento: '#c7922f', layoutPersonalizado: layout });

    const buffer = await generarPdfPersonalizado(prisma, 'tenant-1', 'REMISION', PARAMS);

    expect(generarDocumentoPdfLayoutMock).toHaveBeenCalledWith(expect.objectContaining({ ...PARAMS, colorAcento: '#c7922f' }), layout);
    expect(generarDocumentoPdfMock).not.toHaveBeenCalled();
    expect(buffer.toString('latin1')).toBe('%PDF-layout');
  });
});
