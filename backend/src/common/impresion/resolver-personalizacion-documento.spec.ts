import { resolverPersonalizacionDocumento } from './resolver-personalizacion-documento';
import { PrismaService } from '../../prisma/prisma.service';

describe('resolverPersonalizacionDocumento', () => {
  function crearPrismaMock(filas: { clave: string; valor: string }[]) {
    return { configuracion: { findMany: jest.fn().mockResolvedValue(filas) } } as unknown as PrismaService;
  }

  it('devuelve logo y notaPie cuando ambas están configuradas', async () => {
    const prisma = crearPrismaMock([
      { clave: 'DOCUMENTO_LOGO', valor: 'data:image/png;base64,abc' },
      { clave: 'DOCUMENTO_NOTA_PIE', valor: 'Gracias por su compra' },
    ]);

    const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1');

    expect(resultado).toEqual({ logo: 'data:image/png;base64,abc', notaPie: 'Gracias por su compra' });
  });

  it('devuelve undefined para lo que el tenant no configuró', async () => {
    const prisma = crearPrismaMock([]);

    const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1');

    expect(resultado).toEqual({ logo: undefined, notaPie: undefined });
  });

  it('trata un valor guardado vacío igual que no configurado', async () => {
    const prisma = crearPrismaMock([{ clave: 'DOCUMENTO_NOTA_PIE', valor: '' }]);

    const resultado = await resolverPersonalizacionDocumento(prisma, 'tenant-1');

    expect(resultado.notaPie).toBeUndefined();
  });
});
