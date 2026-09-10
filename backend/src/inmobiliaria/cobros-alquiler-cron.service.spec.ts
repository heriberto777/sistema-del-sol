import { CobrosAlquilerCronService } from './cobros-alquiler-cron.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CobrosAlquilerCronService', () => {
  let service: CobrosAlquilerCronService;
  let prisma: { contratoPropiedad: { findMany: jest.Mock; update: jest.Mock }; cobroAlquiler: { create: jest.Mock } };

  const contratoBase = {
    id: 'c1',
    tenantId: 't1',
    monto: 20000,
    porcentajeComisionAdministracion: 10,
    proximoCobroAlquilerEn: new Date('2026-09-15T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      contratoPropiedad: { findMany: jest.fn(), update: jest.fn() },
      cobroAlquiler: { create: jest.fn() },
    };
    service = new CobrosAlquilerCronService(prisma as unknown as PrismaService);
  });

  it('genera un CobroAlquiler con la comisión calculada y avanza un mes la próxima fecha de cobro', async () => {
    prisma.contratoPropiedad.findMany.mockResolvedValue([contratoBase]);

    const cantidad = await service.generarCobrosDelDia();

    expect(cantidad).toBe(1);
    expect(prisma.cobroAlquiler.create).toHaveBeenCalledWith({
      data: {
        tenantId: 't1',
        contratoPropiedadId: 'c1',
        periodo: '2026-09',
        montoAlquiler: 20000,
        porcentajeComisionAdmin: 10,
        montoComisionAdmin: 2000,
        montoPropietario: 18000,
      },
    });
    expect(prisma.contratoPropiedad.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { proximoCobroAlquilerEn: new Date('2026-10-15T00:00:00Z') },
    });
  });

  it('sin porcentaje de comisión, la comisión queda en 0 y el propietario recibe el monto completo', async () => {
    prisma.contratoPropiedad.findMany.mockResolvedValue([{ ...contratoBase, porcentajeComisionAdministracion: null }]);

    await service.generarCobrosDelDia();

    expect(prisma.cobroAlquiler.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ montoComisionAdmin: 0, montoPropietario: 20000 }) }),
    );
  });

  it('si el cobro de este período ya existe (P2002), no lanza y de todas formas avanza la fecha (no reintenta infinito)', async () => {
    prisma.contratoPropiedad.findMany.mockResolvedValue([contratoBase]);
    prisma.cobroAlquiler.create.mockRejectedValue({ code: 'P2002' });

    const cantidad = await service.generarCobrosDelDia();

    expect(cantidad).toBe(0);
    expect(prisma.contratoPropiedad.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { proximoCobroAlquilerEn: new Date('2026-10-15T00:00:00Z') },
    });
  });

  it('un error real (no P2002) sí se propaga', async () => {
    prisma.contratoPropiedad.findMany.mockResolvedValue([contratoBase]);
    prisma.cobroAlquiler.create.mockRejectedValue(new Error('fallo real de DB'));

    await expect(service.generarCobrosDelDia()).rejects.toThrow('fallo real de DB');
  });

  it('sin contratos bajo administración con cobro vencido, no crea nada', async () => {
    prisma.contratoPropiedad.findMany.mockResolvedValue([]);

    const cantidad = await service.generarCobrosDelDia();

    expect(cantidad).toBe(0);
    expect(prisma.cobroAlquiler.create).not.toHaveBeenCalled();
  });
});
