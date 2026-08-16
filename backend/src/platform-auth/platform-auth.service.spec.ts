import { BadRequestException } from '@nestjs/common';
import { PlatformAuthService } from './platform-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { hashearTokenReset } from '../common/utils/password-reset-token';

describe('PlatformAuthService — recuperación de contraseña', () => {
  let service: PlatformAuthService;
  let prisma: { platformAdmin: any };
  let emailChannel: jest.Mocked<EmailChannel>;

  beforeEach(() => {
    prisma = {
      platformAdmin: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    };
    emailChannel = { enviar: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<EmailChannel>;
    service = new PlatformAuthService(prisma as unknown as PrismaService, {} as never, emailChannel);
  });

  describe('olvidePassword', () => {
    const dto = { email: 'super@admin.com' };

    it('responde el mensaje genérico sin enviar correo si el admin no existe', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(null);

      const resultado = await service.olvidePassword(dto);

      expect(resultado.mensaje).toContain('Si el correo existe');
      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('responde el mensaje genérico sin enviar correo si el admin está inactivo', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'a1', activo: false, email: dto.email });

      await service.olvidePassword(dto);

      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('guarda el hash del token y envía el correo cuando el admin existe y está activo', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'a1', activo: true, email: dto.email });

      await service.olvidePassword(dto);

      expect(prisma.platformAdmin.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: expect.objectContaining({
          resetPasswordTokenHash: expect.any(String),
          resetPasswordExpiraEn: expect.any(Date),
        }),
      });
      expect(emailChannel.enviar).toHaveBeenCalledWith(dto.email, expect.any(String), expect.stringContaining('http'));
    });
  });

  describe('restablecerPassword', () => {
    const dto = { token: 'token-plano', password: 'NuevaClave123!' };

    it('rechaza si no hay ningún admin con ese hash de token vigente', async () => {
      prisma.platformAdmin.findFirst.mockResolvedValue(null);

      await expect(service.restablecerPassword(dto)).rejects.toThrow(BadRequestException);
    });

    it('busca por el hash SHA-256 del token, no por el token plano', async () => {
      prisma.platformAdmin.findFirst.mockResolvedValue({ id: 'a1' });

      await service.restablecerPassword(dto);

      const [{ where }] = prisma.platformAdmin.findFirst.mock.calls[0];
      expect(where.resetPasswordTokenHash).toBe(hashearTokenReset(dto.token));
    });

    it('actualiza el passwordHash y limpia los campos de reset', async () => {
      prisma.platformAdmin.findFirst.mockResolvedValue({ id: 'a1' });

      const resultado = await service.restablecerPassword(dto);

      expect(prisma.platformAdmin.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          resetPasswordTokenHash: null,
          resetPasswordExpiraEn: null,
        }),
      });
      expect(resultado.mensaje).toContain('actualizada');
    });
  });
});
