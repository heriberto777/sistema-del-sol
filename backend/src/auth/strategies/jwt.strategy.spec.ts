import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayloadUser } from '../../common/types/authenticated-request';

describe('JwtStrategy (Fase 4 — revalidación de Tenant.estado por request)', () => {
  let strategy: JwtStrategy;
  let prisma: { tenant: { findUnique: jest.Mock } };
  const payload: JwtPayloadUser = { userId: 'u1', tenantId: 't1', email: 'a@b.com', roles: [], permisos: [] };

  beforeEach(() => {
    prisma = { tenant: { findUnique: jest.fn() } };
    strategy = new JwtStrategy(prisma as unknown as PrismaService);
  });

  it('devuelve el payload tal cual si el tenant sigue ACTIVO', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ estado: 'ACTIVO' });

    const resultado = await strategy.validate(payload);

    expect(resultado).toBe(payload);
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 't1' }, select: { estado: true } });
  });

  it('rechaza un JWT vigente de un tenant que fue SUSPENDIDO después de emitido', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ estado: 'SUSPENDIDO' });

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza un JWT de un tenant CANCELADO', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ estado: 'CANCELADO' });

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza si el tenant ya no existe (borrado)', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
