import { resolverPersonalizacionDocumento } from './resolver-personalizacion-documento';
import { PrismaService } from '../../prisma/prisma.service';

describe('resolverPersonalizacionDocumento', () => {
  function crearPrismaMock(params: { logo?: string | null; notaPie?: string; nombre?: string; rnc?: string | null; direccion?: string | null; telefono?: string | null }) {
    return {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          logo: params.logo ?? null,
          nombre: params.nombre ?? 'Ferretería El Tornillo Feliz, SRL',
          rnc: params.rnc ?? null,
          direccion: params.direccion ?? null,
          telefono: params.telefono ?? null,
        }),
      },
      configuracion: {
        findUnique: jest.fn().mockResolvedValue(params.notaPie !== undefined ? { clave: 'DOCUMENTO_NOTA_PIE', valor: params.notaPie } : null),
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
      select: { logo: true, nombre: true, rnc: true, direccion: true, telefono: true },
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
});
