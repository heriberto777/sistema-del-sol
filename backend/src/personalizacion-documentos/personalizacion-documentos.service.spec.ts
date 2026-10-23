import { PersonalizacionDocumentosService } from './personalizacion-documentos.service';
import { PersonalizacionDocumentosRepository } from './personalizacion-documentos.repository';
import { PrismaService } from '../prisma/prisma.service';
import { resolverPlantillaDocumento } from '../common/impresion/resolver-plantilla-documento';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { generarDocumentoPdf } from '../common/pdf/documento-pdf';
import { generarDocumentoPdfLayout } from '../common/pdf/documento-pdf-layout';

jest.mock('../common/impresion/resolver-plantilla-documento');
jest.mock('../common/impresion/resolver-personalizacion-documento');
jest.mock('../common/pdf/documento-pdf');
jest.mock('../common/pdf/documento-pdf-layout');

const resolverPlantillaDocumentoMock = resolverPlantillaDocumento as jest.Mock;
const resolverPersonalizacionDocumentoMock = resolverPersonalizacionDocumento as jest.Mock;
const generarDocumentoPdfMock = generarDocumentoPdf as jest.Mock;
const generarDocumentoPdfLayoutMock = generarDocumentoPdfLayout as jest.Mock;

describe('PersonalizacionDocumentosService', () => {
  let repository: jest.Mocked<PersonalizacionDocumentosRepository>;
  let service: PersonalizacionDocumentosService;

  beforeEach(() => {
    repository = {
      obtenerMarca: jest.fn(),
      actualizarMarca: jest.fn(),
      listarTipos: jest.fn(),
      upsertTipo: jest.fn(),
      actualizarLayout: jest.fn(),
    } as unknown as jest.Mocked<PersonalizacionDocumentosRepository>;
    service = new PersonalizacionDocumentosService(repository, {} as PrismaService);
    resolverPlantillaDocumentoMock.mockReset().mockResolvedValue('CLASICO');
    resolverPersonalizacionDocumentoMock.mockReset().mockResolvedValue({ layoutPersonalizado: null });
    generarDocumentoPdfMock.mockReset().mockResolvedValue(Buffer.from('%PDF-fake'));
    generarDocumentoPdfLayoutMock.mockReset().mockResolvedValue(Buffer.from('%PDF-layout'));
  });

  describe('listar', () => {
    it('devuelve los 4 tipos siempre, con defaults vacíos para los que no tienen fila guardada', async () => {
      repository.obtenerMarca.mockResolvedValue({ colorAcentoDocumentos: '#c7922f', logo: null });
      repository.listarTipos.mockResolvedValue([]);

      const resultado = await service.listar('tenant-1');

      expect(resultado.colorAcentoDocumentos).toBe('#c7922f');
      expect(resultado.tipos.map((t) => t.tipoDocumento)).toEqual(['FACTURA', 'COTIZACION', 'REMISION', 'ORDEN_COMPRA']);
      expect(resultado.tipos.every((t) => t.camposEmisorVisibles.length === 0 && !t.qrHabilitado && !t.firmaHabilitada)).toBe(true);
    });

    it('usa los valores guardados para el tipo que sí tiene fila, sin tocar los otros dos', async () => {
      repository.obtenerMarca.mockResolvedValue({ colorAcentoDocumentos: null, logo: null });
      repository.listarTipos.mockResolvedValue([
        {
          id: 'p1',
          tenantId: 'tenant-1',
          tipoDocumento: 'FACTURA',
          camposEmisorVisibles: ['rnc'],
          camposClienteVisibles: ['direccion'],
          columnasLinea: ['cantidad', 'total'],
          totalesVisibles: ['total'],
          textoLegal: 'Términos de la factura',
          qrHabilitado: true,
          qrContenido: 'LINK_PAGO',
          qrValor: 'https://pago.ejemplo.com',
          firmaHabilitada: true,
          firmaEtiqueta: 'Autorizado por',
          firmaImagen: 'data:image/png;base64,abc',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never,
      ]);

      const resultado = await service.listar('tenant-1');

      const factura = resultado.tipos.find((t) => t.tipoDocumento === 'FACTURA')!;
      const cotizacion = resultado.tipos.find((t) => t.tipoDocumento === 'COTIZACION')!;
      expect(factura.camposEmisorVisibles).toEqual(['rnc']);
      expect(factura.qrHabilitado).toBe(true);
      expect(factura.textoLegal).toBe('Términos de la factura');
      expect(cotizacion.camposEmisorVisibles).toEqual([]);
      expect(cotizacion.qrHabilitado).toBe(false);
    });

    it('expone los bloques del layout personalizado cuando hay uno guardado, null si no', async () => {
      repository.obtenerMarca.mockResolvedValue({ colorAcentoDocumentos: null, logo: null });
      repository.listarTipos.mockResolvedValue([
        { tipoDocumento: 'FACTURA', layoutPersonalizado: { bloques: [{ tipo: 'tabla_lineas', x: 5, y: 10, w: 90, h: 40 }] } } as never,
      ]);

      const resultado = await service.listar('tenant-1');

      const factura = resultado.tipos.find((t) => t.tipoDocumento === 'FACTURA')!;
      const remision = resultado.tipos.find((t) => t.tipoDocumento === 'REMISION')!;
      expect(factura.layoutPersonalizado).toEqual([{ tipo: 'tabla_lineas', x: 5, y: 10, w: 90, h: 40 }]);
      expect(remision.layoutPersonalizado).toBeNull();
    });
  });

  describe('actualizarMarca', () => {
    it('pasa el color tal cual cuando viene informado', async () => {
      await service.actualizarMarca('tenant-1', { colorAcentoDocumentos: '#c7922f' });
      expect(repository.actualizarMarca).toHaveBeenCalledWith('tenant-1', '#c7922f');
    });

    it('convierte un string vacío en null (quitar el color)', async () => {
      await service.actualizarMarca('tenant-1', { colorAcentoDocumentos: '' });
      expect(repository.actualizarMarca).toHaveBeenCalledWith('tenant-1', null);
    });
  });

  describe('actualizarTipo', () => {
    it('delega en el repositorio con el tenant y tipo correctos', async () => {
      const dto = { qrHabilitado: true };
      await service.actualizarTipo('tenant-1', 'COTIZACION', dto);
      expect(repository.upsertTipo).toHaveBeenCalledWith('tenant-1', 'COTIZACION', dto);
    });
  });

  describe('actualizarLayout', () => {
    it('delega en el repositorio con los bloques tal cual', async () => {
      const bloques = [{ tipo: 'tabla_lineas', x: 5, y: 10, w: 90, h: 40 }];
      await service.actualizarLayout('tenant-1', 'FACTURA', bloques);
      expect(repository.actualizarLayout).toHaveBeenCalledWith('tenant-1', 'FACTURA', bloques);
    });

    it('sin bloques (undefined), guarda null — vuelve a la plantilla fija', async () => {
      await service.actualizarLayout('tenant-1', 'FACTURA', undefined);
      expect(repository.actualizarLayout).toHaveBeenCalledWith('tenant-1', 'FACTURA', null);
    });
  });

  describe('generarPreview', () => {
    it('genera un PDF de muestra con la plantilla y personalización resueltas', async () => {
      resolverPlantillaDocumentoMock.mockResolvedValue('EDITORIAL');
      resolverPersonalizacionDocumentoMock.mockResolvedValue({ colorAcento: '#c7922f' });

      const resultado = await service.generarPreview('tenant-1', 'FACTURA');

      expect(resolverPersonalizacionDocumentoMock).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'FACTURA');
      expect(generarDocumentoPdfMock).toHaveBeenCalledWith(
        expect.objectContaining({ tipoDocumento: 'Factura de venta', colorAcento: '#c7922f', mostrarPrecios: true }),
        { plantilla: 'EDITORIAL' },
      );
      expect(resultado.buffer.toString('latin1').startsWith('%PDF-')).toBe(true);
      expect(resultado.contentType).toBe('application/pdf');
    });

    it('la vista previa de Remisión no muestra precios (mismo criterio que el documento real)', async () => {
      await service.generarPreview('tenant-1', 'REMISION');

      expect(generarDocumentoPdfMock).toHaveBeenCalledWith(expect.objectContaining({ tipoDocumento: 'Remisión', mostrarPrecios: false }), expect.anything());
    });

    it('con un layout personalizado guardado, usa el motor de layout en vez de la plantilla fija', async () => {
      const layout = { bloques: [{ tipo: 'tabla_lineas', x: 5, y: 10, w: 90, h: 40 }] };
      resolverPersonalizacionDocumentoMock.mockResolvedValue({ colorAcento: '#c7922f', layoutPersonalizado: layout });

      const resultado = await service.generarPreview('tenant-1', 'FACTURA');

      expect(generarDocumentoPdfLayoutMock).toHaveBeenCalledWith(expect.objectContaining({ tipoDocumento: 'Factura de venta', colorAcento: '#c7922f' }), layout);
      expect(generarDocumentoPdfMock).not.toHaveBeenCalled();
      expect(resultado.buffer.toString('latin1')).toBe('%PDF-layout');
    });
  });
});
