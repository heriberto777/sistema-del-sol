import { resolverPersonalizacionDocumento } from './resolver-personalizacion-documento';
import { PrismaService } from '../../prisma/prisma.service';

describe('resolverPersonalizacionDocumento', () => {
  function crearPrismaMock(params: { logo?: string | null; notaPie?: string }) {
    return {
      tenant: { findUnique: jest.fn().mockResolvedValue({ logo: params.logo ?? null }) },
      configuracion: {
        findUnique: jest.fn().mockResolvedValue(params.notaPie !== undefined ? { clave: 'DOCUMENTO_NOTA_PIE', valor: params.notaPie } : null),
      },
    } as unknown as PrismaService;
  }

  it('devuelve logo (de Tenant.logo) y notaPie (de Configuracion) cuando ambas están configuradas', async () => {
    const prisma = crearPrismaMock({ logo: 'data:image/png;base64,abc', notaPie: 'Gracias por su compra' });

    const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1');

    expect(resultado).toEqual({ logo: 'data:image/png;base64,abc', notaPie: 'Gracias por su compra' });
    expect((prisma.tenant.findUnique as jest.Mock)).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, select: { logo: true } });
  });

  it('devuelve undefined para lo que el tenant no configuró', async () => {
    const prisma = crearPrismaMock({ logo: null });

    const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1');

    expect(resultado).toEqual({ logo: undefined, notaPie: undefined });
  });

  it('trata un valor guardado vacío igual que no configurado', async () => {
    const prisma = crearPrismaMock({ logo: '', notaPie: '' });

    const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1');

    expect(resultado.logo).toBeUndefined();
    expect(resultado.notaPie).toBeUndefined();
  });
});
