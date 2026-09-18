import { resolverPlantillaDocumento } from './resolver-plantilla-documento';
import { PrismaService } from '../../prisma/prisma.service';

describe('resolverPlantillaDocumento', () => {
  function crearPrismaMock(params: { bodega?: { plantillaDocumento: string | null } | null; config?: { valor: string } | null }) {
    return {
      bodega: { findFirst: jest.fn().mockResolvedValue(params.bodega ?? null) },
      configuracion: { findUnique: jest.fn().mockResolvedValue(params.config ?? null) },
    } as unknown as PrismaService;
  }

  it('el override de bodega manda sobre el default de tenant', async () => {
    const prisma = crearPrismaMock({
      bodega: { plantillaDocumento: 'EDITORIAL' },
      config: { valor: 'MINIMALISTA' },
    });

    const resultado = await resolverPlantillaDocumento(prisma, 'tenant-1', 'bodega-1');
    expect(resultado).toBe('EDITORIAL');
  });

  it('sin override de bodega, usa el default guardado en Configuracion', async () => {
    const prisma = crearPrismaMock({ bodega: { plantillaDocumento: null }, config: { valor: 'MINIMALISTA' } });

    const resultado = await resolverPlantillaDocumento(prisma, 'tenant-1', 'bodega-1');
    expect(resultado).toBe('MINIMALISTA');
  });

  it('sin bodegaId, resuelve directo desde Configuracion', async () => {
    const prisma = crearPrismaMock({ config: { valor: 'COMPACTO' } });

    const resultado = await resolverPlantillaDocumento(prisma, 'tenant-1', null);
    expect(resultado).toBe('COMPACTO');
  });

  it('sin nada configurado (ni bodega ni Configuracion), cae al fallback duro CLASICO', async () => {
    const prisma = crearPrismaMock({});

    const resultado = await resolverPlantillaDocumento(prisma, 'tenant-1', 'bodega-1');
    expect(resultado).toBe('CLASICO');
  });

  it('ignora un valor guardado en Configuracion que no sea un PlantillaDocumento válido', async () => {
    const prisma = crearPrismaMock({ config: { valor: 'valor-invalido-legado' } });

    const resultado = await resolverPlantillaDocumento(prisma, 'tenant-1', null);
    expect(resultado).toBe('CLASICO');
  });
});
