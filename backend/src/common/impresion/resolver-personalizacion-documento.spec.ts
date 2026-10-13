import { resolverPersonalizacionDocumento } from './resolver-personalizacion-documento';
import { PrismaService } from '../../prisma/prisma.service';
import { generarQrDataUri } from '../qr/generar-qr';

jest.mock('../qr/generar-qr');
const generarQrDataUriMock = generarQrDataUri as jest.Mock;

describe('resolverPersonalizacionDocumento', () => {
  beforeEach(() => {
    generarQrDataUriMock.mockReset();
    generarQrDataUriMock.mockResolvedValue('data:image/png;base64,qr');
  });

  function crearPrismaMock(params: {
    logo?: string | null;
    notaPie?: string;
    nombre?: string;
    rnc?: string | null;
    direccion?: string | null;
    telefono?: string | null;
    colorAcentoDocumentos?: string | null;
    configTipo?: Record<string, unknown> | null;
  }) {
    return {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          logo: params.logo ?? null,
          nombre: params.nombre ?? 'Ferretería El Tornillo Feliz, SRL',
          rnc: params.rnc ?? null,
          direccion: params.direccion ?? null,
          telefono: params.telefono ?? null,
          colorAcentoDocumentos: params.colorAcentoDocumentos ?? null,
        }),
      },
      configuracion: {
        findUnique: jest.fn().mockResolvedValue(params.notaPie !== undefined ? { clave: 'DOCUMENTO_NOTA_PIE', valor: params.notaPie } : null),
      },
      personalizacionDocumentoTipo: {
        findUnique: jest.fn().mockResolvedValue(params.configTipo ?? null),
      },
    } as unknown as PrismaService;
  }

  it('devuelve logo (de Tenant.logo) y notaPie (de Configuracion) cuando ambas están configuradas', async () => {
    const prisma = crearPrismaMock({ logo: 'data:image/png;base64,abc', notaPie: 'Gracias por su compra' });

    const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1');

    expect(resultado.logo).toBe('data:image/png;base64,abc');
    expect(resultado.notaPie).toBe('Gracias por su compra');
    expect((prisma.tenant.findUnique as jest.Mock)).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      select: { logo: true, nombre: true, rnc: true, direccion: true, telefono: true, colorAcentoDocumentos: true },
    });
  });

  it('devuelve undefined para lo que el tenant no configuró (logo/notaPie/campos de emisor vacíos)', async () => {
    const prisma = crearPrismaMock({ logo: null });

    const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1');

    expect(resultado.logo).toBeUndefined();
    expect(resultado.notaPie).toBeUndefined();
    expect(resultado.emisor?.rnc).toBeUndefined();
    expect(resultado.emisor?.direccion).toBeUndefined();
    expect(resultado.emisor?.telefono).toBeUndefined();
  });

  it('trata un valor guardado vacío igual que no configurado', async () => {
    const prisma = crearPrismaMock({ logo: '', notaPie: '' });

    const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1');

    expect(resultado.logo).toBeUndefined();
    expect(resultado.notaPie).toBeUndefined();
  });

  it('emisor trae el nombre/RNC/dirección/teléfono del Tenant, para las plantillas nuevas de documento', async () => {
    const prisma = crearPrismaMock({ nombre: 'Ferretería El Tornillo Feliz, SRL', rnc: '130-12345-6', direccion: 'Santiago', telefono: '809-583-0021' });

    const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1');

    expect(resultado.emisor).toEqual({
      nombre: 'Ferretería El Tornillo Feliz, SRL',
      rnc: '130-12345-6',
      direccion: 'Santiago',
      telefono: '809-583-0021',
    });
  });

  describe('"Formato de Documentos" Fase A/B1 (requiere tipoDocumento)', () => {
    it('sin tipoDocumento, nunca consulta PersonalizacionDocumentoTipo — cero cambio para los call sites que no imprimen un documento con tipo', async () => {
      const prisma = crearPrismaMock({});

      await resolverPersonalizacionDocumento(prisma, 'tenant-1');

      expect((prisma as any).personalizacionDocumentoTipo.findUnique).not.toHaveBeenCalled();
    });

    it('con tipoDocumento pero sin fila configurada, todo vuelve undefined (comportamiento de siempre, sin backfill)', async () => {
      const prisma = crearPrismaMock({ configTipo: null });

      const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1', 'FACTURA');

      expect(resultado.colorAcento).toBeUndefined();
      expect(resultado.camposEmisorVisibles).toBeUndefined();
      expect(resultado.camposClienteVisibles).toBeUndefined();
      expect(resultado.columnasLinea).toBeUndefined();
      expect(resultado.totalesVisibles).toBeUndefined();
      expect(resultado.qr).toBeUndefined();
      expect(resultado.firma).toBeUndefined();
    });

    it('con fila configurada, devuelve los campos/columnas/totales elegidos tal cual (incluso vacíos)', async () => {
      const prisma = crearPrismaMock({
        configTipo: {
          camposEmisorVisibles: ['rnc'],
          camposClienteVisibles: [],
          columnasLinea: ['cantidad', 'total'],
          totalesVisibles: ['total'],
          textoLegal: null,
          qrHabilitado: false,
          qrContenido: null,
          qrValor: null,
          firmaHabilitada: false,
          firmaEtiqueta: null,
          firmaImagen: null,
        },
      });

      const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1', 'FACTURA');

      expect(resultado.camposEmisorVisibles).toEqual(['rnc']);
      expect(resultado.camposClienteVisibles).toEqual([]);
      expect(resultado.columnasLinea).toEqual(['cantidad', 'total']);
      expect(resultado.totalesVisibles).toEqual(['total']);
    });

    it('colorAcento sale de Tenant.colorAcentoDocumentos', async () => {
      const prisma = crearPrismaMock({ colorAcentoDocumentos: '#c7922f', configTipo: {} });

      const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1', 'FACTURA');

      expect(resultado.colorAcento).toBe('#c7922f');
    });

    it('el texto legal por tipo gana sobre la nota de pie global', async () => {
      const prisma = crearPrismaMock({ notaPie: 'Nota global', configTipo: { textoLegal: 'Términos de la factura' } });

      const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1', 'FACTURA');

      expect(resultado.notaPie).toBe('Términos de la factura');
    });

    it('sin texto legal propio, cae a la nota de pie global (compatibilidad con tenants que no migraron)', async () => {
      const prisma = crearPrismaMock({ notaPie: 'Nota global', configTipo: { textoLegal: null } });

      const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1', 'FACTURA');

      expect(resultado.notaPie).toBe('Nota global');
    });

    it('genera el QR cuando está habilitado y tiene valor, con la etiqueta de link de pago', async () => {
      const prisma = crearPrismaMock({ configTipo: { qrHabilitado: true, qrValor: 'https://pago.ejemplo.com/factura-1', qrContenido: 'LINK_PAGO' } });

      const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1', 'FACTURA');

      expect(generarQrDataUriMock).toHaveBeenCalledWith('https://pago.ejemplo.com/factura-1');
      expect(resultado.qr).toEqual({ dataUri: 'data:image/png;base64,qr', etiqueta: 'Escanea para pagar' });
    });

    it('no genera el QR si está deshabilitado aunque tenga valor guardado', async () => {
      const prisma = crearPrismaMock({ configTipo: { qrHabilitado: false, qrValor: 'https://pago.ejemplo.com/factura-1' } });

      const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1', 'FACTURA');

      expect(generarQrDataUriMock).not.toHaveBeenCalled();
      expect(resultado.qr).toBeUndefined();
    });

    it('si la librería de QR falla, no rompe y simplemente no hay QR', async () => {
      generarQrDataUriMock.mockResolvedValue(undefined);
      const prisma = crearPrismaMock({ configTipo: { qrHabilitado: true, qrValor: 'texto' } });

      const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1', 'FACTURA');

      expect(resultado.qr).toBeUndefined();
    });

    it('resuelve la firma con etiqueta e imagen cuando está habilitada', async () => {
      const prisma = crearPrismaMock({ configTipo: { firmaHabilitada: true, firmaEtiqueta: 'Autorizado por', firmaImagen: 'data:image/png;base64,firma' } });

      const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1', 'FACTURA');

      expect(resultado.firma).toEqual({ etiqueta: 'Autorizado por', imagen: 'data:image/png;base64,firma' });
    });

    it('sin firmaHabilitada, no devuelve firma aunque haya imagen guardada', async () => {
      const prisma = crearPrismaMock({ configTipo: { firmaHabilitada: false, firmaImagen: 'data:image/png;base64,firma' } });

      const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1', 'FACTURA');

      expect(resultado.firma).toBeUndefined();
    });
  });
});
