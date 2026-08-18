import { resolverFormatoImpresion } from './resolver-formato-impresion';
import { PrismaService } from '../../prisma/prisma.service';

describe('resolverFormatoImpresion', () => {
  function crearPrismaMock(params: { bodega?: { formatoImpresion: string | null } | null; config?: { valor: string } | null }) {
    return {
      bodega: { findFirst: jest.fn().mockResolvedValue(params.bodega ?? null) },
      configuracion: { findUnique: jest.fn().mockResolvedValue(params.config ?? null) },
    } as unknown as PrismaService;
  }

  it('el override de bodega manda sobre el default de tenant', async () => {
    const prisma = crearPrismaMock({
      bodega: { formatoImpresion: 'TERMICA_80MM' },
      config: { valor: 'A4' },
    });

    const resultado = await resolverFormatoImpresion(prisma, 'tenant-1', 'bodega-1');
    expect(resultado).toBe('TERMICA_80MM');
  });

  it('sin override de bodega, usa el default guardado en Configuracion', async () => {
    const prisma = crearPrismaMock({ bodega: { formatoImpresion: null }, config: { valor: 'A4' } });

    const resultado = await resolverFormatoImpresion(prisma, 'tenant-1', 'bodega-1');
    expect(resultado).toBe('A4');
  });

  it('sin bodegaId, resuelve directo desde Configuracion', async () => {
    const prisma = crearPrismaMock({ config: { valor: 'TERMICA_58MM' } });

    const resultado = await resolverFormatoImpresion(prisma, 'tenant-1', null);
    expect(resultado).toBe('TERMICA_58MM');
  });

  it('sin nada configurado (ni bodega ni Configuracion), cae al fallback duro CARTA', async () => {
    const prisma = crearPrismaMock({});

    const resultado = await resolverFormatoImpresion(prisma, 'tenant-1', 'bodega-1');
    expect(resultado).toBe('CARTA');
  });

  it('ignora un valor guardado en Configuracion que no sea un FormatoImpresion válido', async () => {
    const prisma = crearPrismaMock({ config: { valor: 'valor-invalido-legado' } });

    const resultado = await resolverFormatoImpresion(prisma, 'tenant-1', null);
    expect(resultado).toBe('CARTA');
  });
});
