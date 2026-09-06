import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ClienteTiendaAuthService } from './cliente-tienda-auth.service';
import { CLIENTE_TIENDA_JWT_SECRET } from './cliente-tienda-jwt.constants';

const TENANT_ACTIVO = { id: 't1', nombre: 'Tenant Demo', estado: 'ACTIVO', plan: { modulos: [{ modulo: { clave: 'ecommerce' } }] } };

describe('ClienteTiendaAuthService', () => {
  let service: ClienteTiendaAuthService;
  let prisma: {
    tenant: { findUnique: jest.Mock };
    tenantModuloOverride: { findFirst: jest.Mock };
    configuracion: { findMany: jest.Mock };
    cliente: { findFirst: jest.Mock; create: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
  };
  let redis: { client: { get: jest.Mock; set: jest.Mock } };

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue(TENANT_ACTIVO) },
      tenantModuloOverride: { findFirst: jest.fn().mockResolvedValue(null) },
      configuracion: { findMany: jest.fn().mockResolvedValue([{ clave: 'TIENDA_ACTIVA', valor: 'true' }]) },
      cliente: { findFirst: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    };
    redis = { client: { get: jest.fn(), set: jest.fn() } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new ClienteTiendaAuthService(prisma as any, new JwtService(), redis as any);
  });

  describe('registro', () => {
    const dto = { nombre: 'Ana Torres', email: 'ana@ejemplo.com', password: 'clave1234', telefono: '8095551234' };

    it('rechaza si ya existe un cliente de este tenant con ese email Y contraseña (cuenta de tienda)', async () => {
      prisma.cliente.findFirst.mockResolvedValue({ id: 'existente' });
      await expect(service.registro('demo', dto)).rejects.toThrow(ConflictException);
      expect(prisma.cliente.create).not.toHaveBeenCalled();
    });

    it('crea el Cliente con la contraseña hasheada (bcrypt) y devuelve un accessToken', async () => {
      prisma.cliente.findFirst.mockResolvedValue(null);
      prisma.cliente.create.mockResolvedValue({ id: 'c1', nombre: dto.nombre, email: dto.email, telefono: dto.telefono });

      const resultado = await service.registro('demo', dto);

      const [{ data }] = prisma.cliente.create.mock.calls[0];
      expect(data.tenantId).toBe('t1');
      expect(data.passwordHash).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, data.passwordHash)).toBe(true);
      expect(resultado.accessToken).toEqual(expect.any(String));
      expect(resultado.cliente).toEqual({ id: 'c1', nombre: dto.nombre, email: dto.email, telefono: dto.telefono });
    });

    it('el token emitido trae clienteId/tenantId/email y verifica contra CLIENTE_TIENDA_JWT_SECRET', async () => {
      prisma.cliente.findFirst.mockResolvedValue(null);
      prisma.cliente.create.mockResolvedValue({ id: 'c1', nombre: dto.nombre, email: dto.email, telefono: dto.telefono });

      const { accessToken } = await service.registro('demo', dto);

      const payload = new JwtService().verify(accessToken, { secret: CLIENTE_TIENDA_JWT_SECRET });
      expect(payload).toEqual(expect.objectContaining({ clienteId: 'c1', tenantId: 't1', email: dto.email }));
    });

    it('un cliente SIN contraseña (ej. "Consumidor Final" o uno cargado a mano) con el mismo email no bloquea el registro', async () => {
      // buscarFirst con passwordHash: {not: null} — un cliente sin contraseña simplemente no matchea, así que Prisma real devolvería null acá.
      prisma.cliente.findFirst.mockResolvedValue(null);
      prisma.cliente.create.mockResolvedValue({ id: 'c2', nombre: dto.nombre, email: dto.email, telefono: dto.telefono });

      await expect(service.registro('demo', dto)).resolves.toBeDefined();
      expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ passwordHash: { not: null } }) }),
      );
    });
  });

  describe('login', () => {
    const dto = { email: 'ana@ejemplo.com', password: 'clave1234' };

    it('rechaza si no existe un cliente con ese email y contraseña en este tenant', async () => {
      prisma.cliente.findFirst.mockResolvedValue(null);
      await expect(service.login('demo', dto)).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza si la contraseña no coincide', async () => {
      const passwordHash = await bcrypt.hash('otra-clave', 10);
      prisma.cliente.findFirst.mockResolvedValue({ id: 'c1', passwordHash, nombre: 'Ana', email: dto.email, telefono: null });
      await expect(service.login('demo', dto)).rejects.toThrow(UnauthorizedException);
    });

    it('devuelve un accessToken válido cuando las credenciales son correctas', async () => {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      prisma.cliente.findFirst.mockResolvedValue({ id: 'c1', passwordHash, nombre: 'Ana', email: dto.email, telefono: null });

      const resultado = await service.login('demo', dto);

      expect(resultado.cliente).toEqual({ id: 'c1', nombre: 'Ana', email: dto.email, telefono: null });
      const payload = new JwtService().verify(resultado.accessToken, { secret: CLIENTE_TIENDA_JWT_SECRET });
      expect(payload).toEqual(expect.objectContaining({ clienteId: 'c1', tenantId: 't1' }));
    });
  });

  describe('tienda inexistente/inactiva', () => {
    it('registro y login fallan igual que cualquier otra ruta pública si la tienda no existe', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.login('no-existe', { email: 'a@a.com', password: 'clave1234' })).rejects.toThrow();
    });
  });

  describe('cambiarPassword', () => {
    const CLIENTE = { clienteId: 'c1', tenantId: 't1', email: 'ana@ejemplo.com' };
    const dto = { passwordActual: 'clave1234', passwordNueva: 'claveNueva123' };

    it('rechaza (403, no 401) si la contraseña actual no coincide', async () => {
      const passwordHash = await bcrypt.hash('otra-clave', 10);
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', passwordHash });
      await expect(service.cambiarPassword('demo', CLIENTE, dto)).rejects.toThrow(ForbiddenException);
      expect(prisma.cliente.update).not.toHaveBeenCalled();
    });

    it('actualiza el passwordHash (bcrypt) cuando la actual coincide', async () => {
      const passwordHash = await bcrypt.hash(dto.passwordActual, 10);
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', passwordHash });

      await service.cambiarPassword('demo', CLIENTE, dto);

      const [{ data }] = prisma.cliente.update.mock.calls[0];
      expect(await bcrypt.compare(dto.passwordNueva, data.passwordHash)).toBe(true);
    });

    it('rechaza si el token es de un tenant distinto al del subdominio pedido', async () => {
      await expect(service.cambiarPassword('demo', { ...CLIENTE, tenantId: 'otro-tenant' }, dto)).rejects.toThrow(UnauthorizedException);
      expect(prisma.cliente.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('guarda el token en Redis con el TTL que le queda hasta expirar (exp del propio JWT)', async () => {
      const dentroDe10Min = Math.floor(Date.now() / 1000) + 600;
      const payload = Buffer.from(JSON.stringify({ exp: dentroDe10Min })).toString('base64url');
      const token = `header.${payload}.firma`;

      await service.logout(token);

      expect(redis.client.set).toHaveBeenCalledTimes(1);
      const [clave, valor, modo, ttl] = redis.client.set.mock.calls[0];
      expect(clave).toMatch(/^cliente-tienda-token-revocado:[0-9a-f]{64}$/);
      expect(valor).toBe('1');
      expect(modo).toBe('EX');
      expect(ttl).toBeGreaterThan(590);
      expect(ttl).toBeLessThanOrEqual(600);
    });

    it('no hace nada si el token no trae un exp parseable', async () => {
      await service.logout('esto-no-es-un-jwt');
      expect(redis.client.set).not.toHaveBeenCalled();
    });
  });
});
