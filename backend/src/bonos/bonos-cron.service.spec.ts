import { BonosCronService } from './bonos-cron.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BonosCronService', () => {
  let service: BonosCronService;
  let prisma: { bono: { updateMany: jest.Mock } };

  beforeEach(() => {
    prisma = { bono: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) } };
    service = new BonosCronService(prisma as unknown as PrismaService);
  });

  it('marca VENCIDO cruzando todos los tenants con el PrismaService global (no BonosRepository, ver comentario del constructor)', async () => {
    const cantidad = await service.marcarVencidos();

    expect(prisma.bono.updateMany).toHaveBeenCalledWith({
      where: { estado: 'ACTIVO', fechaVencimiento: { lt: expect.any(Date) } },
      data: { estado: 'VENCIDO' },
    });
    expect(cantidad).toBe(2);
  });
});
