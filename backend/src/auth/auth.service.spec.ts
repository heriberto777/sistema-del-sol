import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { hashearTokenReset } from '../common/utils/password-reset-token';
import { resolverModulosActivos } from '../planes/resolver-modulos-activos';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';

jest.mock('../planes/resolver-modulos-activos');
jest.mock('../common/impresion/resolver-personalizacion-documento');

describe('AuthService — recuperación de contraseña', () => {
  let service: AuthService;
  let prisma: { tenant: any; user: any };
  let emailChannel: jest.Mocked<EmailChannel>;

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn() },
      user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
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
      expect(emailChannel.enviar).toHaveBeenCalledWith(dto.email, expect.any(String), expect.stringContaining('http'), undefined, 't1');
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
    it('devuelve una sola empresa (con su logo) si el email pertenece a un único tenant activo', async () => {
      prisma.user.findMany.mockResolvedValue([
        { tenant: { subdominio: 'demo', nombre: 'Empresa Demo', logo: 'data:image/png;base64,abc' } },
      ]);

      const resultado = await service.resolverEmpresas('admin@demo.com');

      expect(resultado.empresas).toEqual([{ subdominio: 'demo', nombre: 'Empresa Demo', logo: 'data:image/png;base64,abc' }]);
    });

    it('devuelve varias empresas si el mismo email existe en más de un tenant', async () => {
      prisma.user.findMany.mockResolvedValue([
        { tenant: { subdominio: 'empresa-a', nombre: 'Empresa A', logo: null } },
        { tenant: { subdominio: 'empresa-b', nombre: 'Empresa B', logo: null } },
      ]);

      const resultado = await service.resolverEmpresas('compartido@ejemplo.com');

      expect(resultado.empresas).toEqual([
        { subdominio: 'empresa-a', nombre: 'Empresa A', logo: null },
        { subdominio: 'empresa-b', nombre: 'Empresa B', logo: null },
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

  describe('PIN de confirmación (Fase 9)', () => {
    const PASSWORD_HASH = bcrypt.hashSync('Admin123!', 10);
    const PIN_HASH = bcrypt.hashSync('1234', 10);

    describe('establecerPin', () => {
      it('rechaza con ForbiddenException (no Unauthorized) si la contraseña actual es incorrecta', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', passwordHash: PASSWORD_HASH });

        await expect(service.establecerPin('u1', { passwordActual: 'mala', pin: '1234' })).rejects.toThrow(ForbiddenException);
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('rechaza un PIN que no tiene entre 4 y 6 dígitos numéricos', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', passwordHash: PASSWORD_HASH });

        await expect(service.establecerPin('u1', { passwordActual: 'Admin123!', pin: '12' })).rejects.toThrow(BadRequestException);
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('guarda el hash del PIN y resetea los contadores de intentos', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', passwordHash: PASSWORD_HASH });

        await service.establecerPin('u1', { passwordActual: 'Admin123!', pin: '1234' });

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'u1' },
          data: expect.objectContaining({ pinHash: expect.any(String), pinIntentosFallidos: 0, pinBloqueadoHasta: null }),
        });
      });
    });

    describe('eliminarPin', () => {
      it('rechaza con ForbiddenException si la contraseña actual es incorrecta', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', passwordHash: PASSWORD_HASH });

        await expect(service.eliminarPin('u1', { passwordActual: 'mala' })).rejects.toThrow(ForbiddenException);
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('pone pinHash en null y resetea los contadores', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', passwordHash: PASSWORD_HASH });

        await service.eliminarPin('u1', { passwordActual: 'Admin123!' });

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'u1' },
          data: { pinHash: null, pinIntentosFallidos: 0, pinBloqueadoHasta: null },
        });
      });
    });

    describe('verificarPin', () => {
      it('no-op (no llama a update ni lanza) si el usuario no tiene PIN configurado — default permisivo', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', pinHash: null });

        await service.verificarPin('u1', undefined);

        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('resetea los intentos fallidos cuando el PIN es correcto', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', pinHash: PIN_HASH, pinIntentosFallidos: 2, pinBloqueadoHasta: null });

        await service.verificarPin('u1', '1234');

        expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { pinIntentosFallidos: 0, pinBloqueadoHasta: null } });
      });

      it('rechaza con ForbiddenException (no Unauthorized) si el PIN es incorrecto, e incrementa los intentos fallidos', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', pinHash: PIN_HASH, pinIntentosFallidos: 1, pinBloqueadoHasta: null });

        await expect(service.verificarPin('u1', '0000')).rejects.toThrow(ForbiddenException);

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'u1' },
          data: { pinIntentosFallidos: 2, pinBloqueadoHasta: null },
        });
      });

      it('rechaza si no se envía ningún PIN', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', pinHash: PIN_HASH, pinIntentosFallidos: 0, pinBloqueadoHasta: null });

        await expect(service.verificarPin('u1', undefined)).rejects.toThrow(ForbiddenException);
      });

      it('bloquea 15 minutos al llegar al 5to intento fallido consecutivo', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', pinHash: PIN_HASH, pinIntentosFallidos: 4, pinBloqueadoHasta: null });

        await expect(service.verificarPin('u1', '0000')).rejects.toThrow(ForbiddenException);

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'u1' },
          data: { pinIntentosFallidos: 5, pinBloqueadoHasta: expect.any(Date) },
        });
      });

      it('rechaza sin volver a comparar el PIN mientras el bloqueo sigue vigente', async () => {
        prisma.user.findUniqueOrThrow.mockResolvedValue({
          id: 'u1',
          pinHash: PIN_HASH,
          pinIntentosFallidos: 5,
          pinBloqueadoHasta: new Date(Date.now() + 10 * 60 * 1000),
        });

        await expect(service.verificarPin('u1', '1234')).rejects.toThrow(ForbiddenException);
        expect(prisma.user.update).not.toHaveBeenCalled();
      });
    });
  });
});

describe('AuthService — login / refrescarSesion', () => {
  let service: AuthService;
  let prisma: { tenant: { findUnique: jest.Mock }; user: { findUnique: jest.Mock } };
  let jwtService: { sign: jest.Mock };
  const resolverModulosActivosMock = resolverModulosActivos as jest.Mock;
  const resolverPersonalizacionDocumentoMock = resolverPersonalizacionDocumento as jest.Mock;

  const TENANT = { id: 't1', subdominio: 'demo', nombre: 'Empresa Demo', estado: 'ACTIVO' };
  const PASSWORD_HASH = bcrypt.hashSync('Admin123!', 10);
  const USER_CON_ROLES = {
    id: 'u1',
    nombre: 'Admin Demo',
    email: 'admin@demo.com',
    activo: true,
    passwordHash: PASSWORD_HASH,
    pinHash: null,
    roles: [
      {
        role: {
          nombre: 'Admin Total',
          rolePermissions: [{ permission: { clave: 'facturacion.ver' } }, { permission: { clave: 'admin.usuarios' } }],
        },
      },
    ],
  };

  beforeEach(() => {
    prisma = { tenant: { findUnique: jest.fn() }, user: { findUnique: jest.fn() } };
    jwtService = { sign: jest.fn().mockReturnValue('jwt-firmado') };
    resolverModulosActivosMock.mockResolvedValue(['facturacion', 'inventario']);
    resolverPersonalizacionDocumentoMock.mockResolvedValue({ logo: undefined });
    (prisma as unknown as { configuracion: { findMany: jest.Mock } }).configuracion = { findMany: jest.fn().mockResolvedValue([]) };
    service = new AuthService(prisma as unknown as PrismaService, jwtService as never, {} as never);
  });

  describe('login', () => {
    it('arma el JWT y el objeto usuario con permisos deduplicados y modulosActivos resuelto en vivo', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(USER_CON_ROLES);

      const resultado = await service.login({ email: 'admin@demo.com', password: 'Admin123!', tenantSubdominio: 'demo' });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', tenantId: 't1', permisos: ['facturacion.ver', 'admin.usuarios'] }),
      );
      expect(resultado.accessToken).toBe('jwt-firmado');
      expect(resultado.usuario.modulosActivos).toEqual(['facturacion', 'inventario']);
      expect(resolverModulosActivosMock).toHaveBeenCalledWith(prisma, 't1');
    });

    it('rechaza con credenciales inválidas si la contraseña no coincide', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(USER_CON_ROLES);

      await expect(service.login({ email: 'admin@demo.com', password: 'mala', tenantSubdominio: 'demo' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refrescarSesion', () => {
    it('reemite accessToken/usuario con datos frescos, sin pedir contraseña', async () => {
      prisma.user.findUnique.mockResolvedValue(USER_CON_ROLES);
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      resolverModulosActivosMock.mockResolvedValue(['facturacion', 'nomina']); // ej. le agregaron un módulo nuevo al plan

      const resultado = await service.refrescarSesion('u1', 't1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }));
      expect(resultado.usuario.modulosActivos).toEqual(['facturacion', 'nomina']);
      expect(resultado.accessToken).toBe('jwt-firmado');
    });

    it('rechaza si el usuario ya no existe o está inactivo', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(TENANT);

      await expect(service.refrescarSesion('u1', 't1')).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza si el tenant ya no existe o quedó suspendido', async () => {
      prisma.user.findUnique.mockResolvedValue(USER_CON_ROLES);
      prisma.tenant.findUnique.mockResolvedValue({ ...TENANT, estado: 'SUSPENDIDO' });

      await expect(service.refrescarSesion('u1', 't1')).rejects.toThrow(UnauthorizedException);
    });
  });
});
