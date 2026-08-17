import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { hashearTokenReset } from '../common/utils/password-reset-token';

describe('AuthService — recuperación de contraseña', () => {
  let service: AuthService;
  let prisma: { tenant: any; user: any };
  let emailChannel: jest.Mocked<EmailChannel>;

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn() },
      user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    };
    emailChannel = { enviar: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<EmailChannel>;
    service = new AuthService(prisma as unknown as PrismaService, {} as never, emailChannel);
  });

  describe('olvidePassword', () => {
    const dto = { email: 'admin@demo.com', tenantSubdominio: 'demo' };

    it('responde el mensaje genérico sin enviar correo si el tenant no existe', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      const resultado = await service.olvidePassword(dto);

      expect(resultado.mensaje).toContain('Si el correo existe');
      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('responde el mensaje genérico sin enviar correo si el tenant está suspendido', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', estado: 'SUSPENDIDO' });

      await service.olvidePassword(dto);

      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('responde el mensaje genérico sin enviar correo si el usuario no existe', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', estado: 'ACTIVO' });
      prisma.user.findUnique.mockResolvedValue(null);

      await service.olvidePassword(dto);

      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('responde el mensaje genérico sin enviar correo si el usuario está inactivo', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', estado: 'ACTIVO' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', activo: false, email: dto.email });

      await service.olvidePassword(dto);

      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('guarda el hash del token con expiración y envía el correo cuando el usuario existe y está activo', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', estado: 'ACTIVO', subdominio: 'demo' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', activo: true, email: dto.email });

      await service.olvidePassword(dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: expect.objectContaining({
          resetPasswordTokenHash: expect.any(String),
          resetPasswordExpiraEn: expect.any(Date),
        }),
      });
      expect(emailChannel.enviar).toHaveBeenCalledWith(dto.email, expect.any(String), expect.stringContaining('http'));
    });
  });

  describe('restablecerPassword', () => {
    const dto = { token: 'token-plano', tenantSubdominio: 'demo', password: 'NuevaClave123!' };

    it('rechaza si el tenant no existe', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.restablecerPassword(dto)).rejects.toThrow(BadRequestException);
    });

    it('rechaza si no hay ningún usuario con ese hash de token vigente', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1' });
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.restablecerPassword(dto)).rejects.toThrow(BadRequestException);
    });

    it('busca por el hash SHA-256 del token, no por el token plano', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1' });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });

      await service.restablecerPassword(dto);

      const [{ where }] = prisma.user.findFirst.mock.calls[0];
      expect(where.resetPasswordTokenHash).toBe(hashearTokenReset(dto.token));
      expect(where.resetPasswordTokenHash).not.toBe(dto.token);
    });

    it('actualiza el passwordHash y limpia los campos de reset', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1' });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });

      const resultado = await service.restablecerPassword(dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          resetPasswordTokenHash: null,
          resetPasswordExpiraEn: null,
        }),
      });
      expect(resultado.mensaje).toContain('actualizada');
    });
  });

  describe('resolverEmpresas', () => {
    it('devuelve una sola empresa si el email pertenece a un único tenant activo', async () => {
      prisma.user.findMany.mockResolvedValue([
        { tenant: { subdominio: 'demo', nombre: 'Empresa Demo' } },
      ]);

      const resultado = await service.resolverEmpresas('admin@demo.com');

      expect(resultado.empresas).toEqual([{ subdominio: 'demo', nombre: 'Empresa Demo' }]);
    });

    it('devuelve varias empresas si el mismo email existe en más de un tenant', async () => {
      prisma.user.findMany.mockResolvedValue([
        { tenant: { subdominio: 'empresa-a', nombre: 'Empresa A' } },
        { tenant: { subdominio: 'empresa-b', nombre: 'Empresa B' } },
      ]);

      const resultado = await service.resolverEmpresas('compartido@ejemplo.com');

      expect(resultado.empresas).toEqual([
        { subdominio: 'empresa-a', nombre: 'Empresa A' },
        { subdominio: 'empresa-b', nombre: 'Empresa B' },
      ]);
    });

    it('devuelve una lista vacía si el email no pertenece a ningún tenant activo', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const resultado = await service.resolverEmpresas('desconocido@ejemplo.com');

      expect(resultado.empresas).toEqual([]);
    });

    it('filtra por usuario activo y tenant activo en la consulta', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.resolverEmpresas('admin@demo.com');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { email: 'admin@demo.com', activo: true, tenant: { estado: 'ACTIVO' } },
        include: { tenant: true },
      });
    });
  });
});
