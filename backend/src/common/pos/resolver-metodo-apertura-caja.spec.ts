import { resolverMetodoAperturaCaja } from './resolver-metodo-apertura-caja';
import { PrismaService } from '../../prisma/prisma.service';

describe('resolverMetodoAperturaCaja', () => {
  function crearPrismaMock(params: { bodega?: { metodoAperturaCaja: string | null } | null; config?: { valor: string } | null }) {
    return {
      bodega: { findFirst: jest.fn().mockResolvedValue(params.bodega ?? null) },
      configuracion: { findUnique: jest.fn().mockResolvedValue(params.config ?? null) },
    } as unknown as PrismaService;
  }

  it('el override de bodega manda sobre el default de tenant', async () => {
    const prisma = crearPrismaMock({
      bodega: { metodoAperturaCaja: 'AGENTE_LOCAL' },
      config: { valor: 'WEB_SERIAL' },
    });

    const resultado = await resolverMetodoAperturaCaja(prisma, 'tenant-1', 'bodega-1');
    expect(resultado).toBe('AGENTE_LOCAL');
  });

  it('sin override de bodega, usa el default guardado en Configuracion', async () => {
    const prisma = crearPrismaMock({ bodega: { metodoAperturaCaja: null }, config: { valor: 'WEB_SERIAL' } });

    const resultado = await resolverMetodoAperturaCaja(prisma, 'tenant-1', 'bodega-1');
    expect(resultado).toBe('WEB_SERIAL');
  });

  it('sin bodegaId, resuelve directo desde Configuracion', async () => {
    const prisma = crearPrismaMock({ config: { valor: 'AGENTE_LOCAL' } });

    const resultado = await resolverMetodoAperturaCaja(prisma, 'tenant-1', null);
    expect(resultado).toBe('AGENTE_LOCAL');
  });

  it('sin nada configurado (ni bodega ni Configuracion), cae al fallback duro NINGUNO', async () => {
    const prisma = crearPrismaMock({});

    const resultado = await resolverMetodoAperturaCaja(prisma, 'tenant-1', 'bodega-1');
    expect(resultado).toBe('NINGUNO');
  });

  it('ignora un valor guardado en Configuracion que no sea un MetodoAperturaCaja válido', async () => {
    const prisma = crearPrismaMock({ config: { valor: 'valor-invalido-legado' } });

    const resultado = await resolverMetodoAperturaCaja(prisma, 'tenant-1', null);
    expect(resultado).toBe('NINGUNO');
  });
});
