import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PERMISOS_BASE, ROLES_BASE } from '../src/tenants/roles-base';
import { PERMISOS_PLATAFORMA_BASE, ROLES_PLATAFORMA_BASE } from '../src/platform-auth/platform-roles-base';
import { EmailChannel } from '../src/notificaciones/canales/email.channel';

function extraerTokenDeReset(cuerpoHtml: string): string {
  const href = cuerpoHtml.match(/href="([^"]+)"/)?.[1];
  if (!href) throw new Error('El correo de reset no contenía un link');
  return new URL(href).searchParams.get('token')!;
}

/**
 * Sistema de plataforma (super admin, separado del login de tenants):
 * login propio, provisioning automático al crear un tenant, y que un
 * token de plataforma y uno de tenant nunca sirvan para el sistema del otro.
 */
describe('Plataforma (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const ADMIN_EMAIL = 'e2e-platform-admin@sistemadelsol.com';
  const ADMIN_PASSWORD = 'PlatformTest123!';
  const SUBDOMINIO_NUEVO = 'e2e-provisioned-tenant';

  let tenantCreadoId: string | undefined;
  let tenantExistenteId: string;
  let planId: string;
  let adminPrincipalId: string;

  async function loginPlataforma() {
    const respuesta = await request(app.getHttpServer())
      .post('/api/platform/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    return respuesta.body.accessToken as string;
  }

  // Cacheado como idPlanTodoIncluido()/idPlanTodoIncluido en los otros e2e:
  // PlatformPermissionsGuard (global) deniega toda ruta con
  // @PlatformPermissions(...) a un admin sin rol, así que cualquier admin
  // de fixture de este archivo necesita un rol con TODO el catálogo.
  let rolSuperAdminId: string | undefined;
  async function idRolSuperAdmin(): Promise<string> {
    if (rolSuperAdminId) return rolSuperAdminId;
    for (const clave of PERMISOS_PLATAFORMA_BASE) {
      await prisma.platformPermission.upsert({ where: { clave }, update: {}, create: { clave } }).catch((error) => {
        if (error?.code !== 'P2002') throw error;
      });
    }
    const permisos = await prisma.platformPermission.findMany();
    const rol = await prisma.platformRole.upsert({
      where: { nombre: 'E2E Super Admin' },
      update: {},
      create: { nombre: 'E2E Super Admin' },
    });
    await prisma.platformRolePermission.deleteMany({ where: { roleId: rol.id } });
    await prisma.platformRolePermission.createMany({
      data: permisos.map((p) => ({ roleId: rol.id, permissionId: p.id })),
    });
    rolSuperAdminId = rol.id;
    return rol.id;
  }

  async function crearAdminConRol(params: { email: string; nombreRol: string; permisos: string[] }) {
    for (const clave of params.permisos) {
      await prisma.platformPermission.upsert({ where: { clave }, update: {}, create: { clave } }).catch((error) => {
        if (error?.code !== 'P2002') throw error;
      });
    }
    const rol = await prisma.platformRole.upsert({
      where: { nombre: params.nombreRol },
      update: {},
      create: { nombre: params.nombreRol },
    });
    const permisosDb = await prisma.platformPermission.findMany({ where: { clave: { in: params.permisos } } });
    await prisma.platformRolePermission.deleteMany({ where: { roleId: rol.id } });
    await prisma.platformRolePermission.createMany({
      data: permisosDb.map((p) => ({ roleId: rol.id, permissionId: p.id })),
    });

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const admin = await prisma.platformAdmin.upsert({
      where: { email: params.email },
      update: { passwordHash, activo: true, roleId: rol.id },
      create: { email: params.email, passwordHash, nombre: params.email, roleId: rol.id },
    });
    return admin;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Ver comentario equivalente en app.e2e-spec.ts: limpia el rate-limiter
    // de Redis (persistente entre corridas) antes de los tests de reset.
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
    await redis.flushdb();
    await redis.quit();

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const adminPrincipal = await prisma.platformAdmin.upsert({
      where: { email: ADMIN_EMAIL },
      update: { passwordHash, activo: true, roleId: await idRolSuperAdmin() },
      create: { email: ADMIN_EMAIL, passwordHash, nombre: 'E2E Platform Admin', roleId: await idRolSuperAdmin() },
    });
    adminPrincipalId = adminPrincipal.id;

    // Plan global mínimo para poder crear tenants vía POST /platform/tenants
    // (CrearTenantDto exige planId) — el catálogo de Planes/Modulo no es por
    // tenant, ver comentario equivalente en app.e2e-spec.ts.
    const plan = await prisma.plan.upsert({
      where: { nombre: 'E2E Plataforma Default' },
      update: {},
      create: { nombre: 'E2E Plataforma Default' },
    });
    planId = plan.id;

    // Tenant + usuario normal, para probar que su token NO sirve en /platform.
    const tenantExistente = await prisma.tenant.create({
      data: { nombre: 'E2E Tenant Existente', subdominio: 'e2e-tenant-existente', planId },
    });
    tenantExistenteId = tenantExistente.id;
    for (const clave of PERMISOS_BASE) {
      // Permission es global; ver comentario equivalente en app.e2e-spec.ts
      // sobre la carrera con este mismo catálogo corriendo en paralelo.
      await prisma.permission.upsert({ where: { clave }, update: {}, create: { clave } }).catch((error) => {
        if (error?.code !== 'P2002') throw error;
      });
    }
    const rol = await prisma.role.create({ data: { tenantId: tenantExistente.id, nombre: 'Admin Total' } });
    for (const clave of ROLES_BASE['Admin Total']) {
      const permiso = await prisma.permission.findUniqueOrThrow({ where: { clave } });
      await prisma.rolePermission.create({ data: { roleId: rol.id, permissionId: permiso.id } });
    }
    const usuarioHash = await bcrypt.hash('TenantUser123!', 10);
    const usuario = await prisma.user.create({
      data: { tenantId: tenantExistente.id, email: 'admin@e2e-tenant-existente.com', nombre: 'Admin', passwordHash: usuarioHash },
    });
    await prisma.userRole.create({ data: { userId: usuario.id, roleId: rol.id } });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await prisma.platformAdmin.deleteMany({ where: { email: ADMIN_EMAIL } });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantExistenteId, tenantCreadoId].filter(Boolean) as string[] } },
    });
    await prisma.$disconnect();
  });

  describe('Auth de plataforma', () => {
    it('rechaza credenciales inválidas', async () => {
      await request(app.getHttpServer())
        .post('/api/platform/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'incorrecta' })
        .expect(401);
    });

    it('acepta credenciales válidas', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/platform/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(201);

      expect(respuesta.body.accessToken).toEqual(expect.any(String));
    });
  });

  describe('Aislamiento entre el sistema de plataforma y el de tenants', () => {
    it('un token de tenant normal NO puede usar rutas de plataforma', async () => {
      const loginTenant = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@e2e-tenant-existente.com', password: 'TenantUser123!', tenantSubdominio: 'e2e-tenant-existente' });
      const tokenTenant = loginTenant.body.accessToken;

      await request(app.getHttpServer())
        .get('/api/platform/tenants')
        .set('Authorization', `Bearer ${tokenTenant}`)
        .expect(401);
    });

    it('un token de plataforma NO puede usar rutas normales de tenant', async () => {
      const tokenPlataforma = await loginPlataforma();

      await request(app.getHttpServer())
        .get('/api/clientes')
        .set('Authorization', `Bearer ${tokenPlataforma}`)
        .expect(401);
    });

    it('sin token, /platform/tenants responde 401', async () => {
      await request(app.getHttpServer()).get('/api/platform/tenants').expect(401);
    });
  });

  describe('Provisioning de un tenant nuevo', () => {
    it('crea el tenant con roles, permisos y usuario admin listos para usarse', async () => {
      const tokenPlataforma = await loginPlataforma();

      const respuesta = await request(app.getHttpServer())
        .post('/api/platform/tenants')
        .set('Authorization', `Bearer ${tokenPlataforma}`)
        .send({
          nombre: 'E2E Tenant Provisionado',
          subdominio: SUBDOMINIO_NUEVO,
          planId,
          adminEmail: 'admin@e2e-provisioned.com',
          adminNombre: 'Admin Provisionado',
          adminPassword: 'Provisionado123!',
        })
        .expect(201);

      tenantCreadoId = respuesta.body.id;
      expect(respuesta.body.subdominio).toBe(SUBDOMINIO_NUEVO);
      expect(respuesta.body.estado).toBe('ACTIVO');

      const roles = await prisma.role.findMany({ where: { tenantId: tenantCreadoId } });
      expect(roles.map((r) => r.nombre).sort()).toEqual(Object.keys(ROLES_BASE).sort());

      const configuraciones = await prisma.configuracion.findMany({ where: { tenantId: tenantCreadoId } });
      expect(configuraciones.find((c) => c.clave === 'ITBIS_GENERAL')?.valor).toBe('18');
    });

    it('el usuario admin del tenant recién creado puede hacer login normal', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@e2e-provisioned.com', password: 'Provisionado123!', tenantSubdominio: SUBDOMINIO_NUEVO })
        .expect(201);

      expect(respuesta.body.usuario.roles).toContain('Admin Total');
      expect(respuesta.body.accessToken).toEqual(expect.any(String));
    });

    it('el admin del tenant nuevo puede configurar su propia secuencia de NCF', async () => {
      const loginTenant = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@e2e-provisioned.com', password: 'Provisionado123!', tenantSubdominio: SUBDOMINIO_NUEVO });
      const tokenTenant = loginTenant.body.accessToken;

      await request(app.getHttpServer())
        .post('/api/admin/ncf')
        .set('Authorization', `Bearer ${tokenTenant}`)
        .send({ tipoNcf: 'B02', secuenciaFinal: 5000, vigenciaHasta: '2027-12-31' })
        .expect(201);

      const listado = await request(app.getHttpServer())
        .get('/api/admin/ncf')
        .set('Authorization', `Bearer ${tokenTenant}`)
        .expect(200);

      expect(listado.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ tipoNcf: 'B02', secuenciaFinal: 5000 })]),
      );
    });
  });

  describe('RBAC de plataforma (PlatformPermissionsGuard)', () => {
    const EMAIL_VENTAS = 'e2e-platform-ventas@sistemadelsol.com';
    const EMAIL_SOPORTE = 'e2e-platform-soporte@sistemadelsol.com';
    let adminVentasId: string;
    let adminSoporteId: string;

    beforeAll(async () => {
      // Por si una corrida previa falló antes de llegar a su propio afterAll.
      await prisma.platformRole.deleteMany({ where: { nombre: 'E2E Rol Temporal' } });

      const adminVentas = await crearAdminConRol({
        email: EMAIL_VENTAS,
        nombreRol: 'E2E Ventas',
        permisos: ROLES_PLATAFORMA_BASE.Ventas,
      });
      adminVentasId = adminVentas.id;

      const adminSoporte = await crearAdminConRol({
        email: EMAIL_SOPORTE,
        nombreRol: 'E2E Soporte',
        permisos: ROLES_PLATAFORMA_BASE.Soporte,
      });
      adminSoporteId = adminSoporte.id;
    });

    afterAll(async () => {
      await prisma.platformAdmin.deleteMany({ where: { id: { in: [adminVentasId, adminSoporteId] } } });
      // Rol creado por el propio test de "crear rol" — se limpia acá para
      // que una corrida siguiente no choque contra el nombre único.
      await prisma.platformRole.deleteMany({ where: { nombre: 'E2E Rol Temporal' } });
    });

    async function loginComo(email: string) {
      const respuesta = await request(app.getHttpServer())
        .post('/api/platform/auth/login')
        .send({ email, password: ADMIN_PASSWORD });
      return respuesta.body.accessToken as string;
    }

    it('un admin con rol "Soporte" recibe 403 al crear un tenant (le falta platform.tenants.crear)', async () => {
      const token = await loginComo(EMAIL_SOPORTE);

      await request(app.getHttpServer())
        .post('/api/platform/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'E2E Rechazado Por RBAC',
          subdominio: 'e2e-rechazado-rbac',
          planId,
          adminEmail: 'admin@e2e-rechazado-rbac.com',
          adminNombre: 'Admin',
          adminPassword: 'Rechazado123!',
        })
        .expect(403);
    });

    it('un admin con rol "Ventas" sí puede crear un tenant', async () => {
      const token = await loginComo(EMAIL_VENTAS);

      const respuesta = await request(app.getHttpServer())
        .post('/api/platform/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'E2E Creado Por Ventas',
          subdominio: 'e2e-creado-por-ventas',
          planId,
          adminEmail: 'admin@e2e-creado-por-ventas.com',
          adminNombre: 'Admin',
          adminPassword: 'CreadoVentas123!',
        })
        .expect(201);

      await prisma.tenant.delete({ where: { id: respuesta.body.id } });
    });

    it('un admin con rol "Soporte" recibe 403 al leer /platform/admins (le falta platform.admins.ver)', async () => {
      const token = await loginComo(EMAIL_SOPORTE);

      await request(app.getHttpServer())
        .get('/api/platform/admins')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('un admin no puede desactivarse a sí mismo (aunque tenga permiso para gestionar admins)', async () => {
      const tokenPlataforma = await loginPlataforma();

      await request(app.getHttpServer())
        .patch(`/api/platform/admins/${adminPrincipalId}`)
        .set('Authorization', `Bearer ${tokenPlataforma}`)
        .send({ activo: false })
        .expect(400);
    });

    it('Super Admin puede crear un rol de plataforma nuevo y luego editarlo', async () => {
      const tokenPlataforma = await loginPlataforma();

      const creado = await request(app.getHttpServer())
        .post('/api/platform/roles')
        .set('Authorization', `Bearer ${tokenPlataforma}`)
        .send({ nombre: 'E2E Rol Temporal', permisos: ['platform.tenants.ver'] })
        .expect(201);

      expect(creado.body.permisos.map((p: { permission: { clave: string } }) => p.permission.clave)).toEqual([
        'platform.tenants.ver',
      ]);

      const editado = await request(app.getHttpServer())
        .patch(`/api/platform/roles/${creado.body.id}`)
        .set('Authorization', `Bearer ${tokenPlataforma}`)
        .send({ permisos: ['platform.tenants.ver', 'platform.planes.ver'] })
        .expect(200);

      expect(editado.body.permisos.map((p: { permission: { clave: string } }) => p.permission.clave).sort()).toEqual([
        'platform.planes.ver',
        'platform.tenants.ver',
      ]);
    });

    it('Super Admin puede crear otro admin de plataforma y asignarle un rol', async () => {
      const tokenPlataforma = await loginPlataforma();

      const respuesta = await request(app.getHttpServer())
        .post('/api/platform/admins')
        .set('Authorization', `Bearer ${tokenPlataforma}`)
        .send({
          email: 'e2e-nuevo-admin@sistemadelsol.com',
          password: 'NuevoAdmin123!',
          nombre: 'Nuevo Admin',
          roleId: rolSuperAdminId,
        })
        .expect(201);

      expect(respuesta.body.email).toBe('e2e-nuevo-admin@sistemadelsol.com');
      await prisma.platformAdmin.delete({ where: { id: respuesta.body.id } });
    });
  });

  describe('Gestión de tenants desde plataforma', () => {
    it('puede suspender un tenant existente', async () => {
      const tokenPlataforma = await loginPlataforma();

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/platform/tenants/${tenantExistenteId}`)
        .set('Authorization', `Bearer ${tokenPlataforma}`)
        .send({ estado: 'SUSPENDIDO' })
        .expect(200);

      expect(respuesta.body.estado).toBe('SUSPENDIDO');
    });

    it('un tenant suspendido no puede hacer login', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@e2e-tenant-existente.com', password: 'TenantUser123!', tenantSubdominio: 'e2e-tenant-existente' })
        .expect(401);
    });
  });

  describe('Auditoría de plataforma', () => {
    it('registra las acciones de creación y suspensión de tenants hechas más arriba', async () => {
      const tokenPlataforma = await loginPlataforma();

      const respuesta = await request(app.getHttpServer())
        .get('/api/platform/audit-log')
        .set('Authorization', `Bearer ${tokenPlataforma}`)
        .expect(200);

      expect(respuesta.body.total).toBeGreaterThanOrEqual(2);
      const acciones = respuesta.body.datos.map((r: { accion: string }) => r.accion);
      expect(acciones.some((a: string) => a.startsWith('POST') && a.includes('tenants'))).toBe(true);
      expect(acciones.some((a: string) => a.startsWith('PATCH') && a.includes('tenants'))).toBe(true);
      expect(respuesta.body.datos[0].admin?.email).toBe(ADMIN_EMAIL);
    });

    it('un token de tenant normal no puede leer el audit log de plataforma', async () => {
      const loginTenant = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@e2e-tenant-existente.com', password: 'TenantUser123!', tenantSubdominio: 'e2e-tenant-existente' });
      const tokenTenant = loginTenant.body.accessToken;

      await request(app.getHttpServer())
        .get('/api/platform/audit-log')
        .set('Authorization', `Bearer ${tokenTenant}`)
        .expect(401);
    });

    it('sin token, /platform/audit-log responde 401', async () => {
      await request(app.getHttpServer()).get('/api/platform/audit-log').expect(401);
    });
  });

  // Cambia la contraseña del admin de plataforma — debe ir al final: cualquier
  // describe posterior que use loginPlataforma() con ADMIN_PASSWORD fallaría.
  describe('Recuperación de contraseña de plataforma', () => {
    it('el flujo completo: solicitar reset, canjear el token, loguear con la nueva contraseña', async () => {
      const emailChannel = app.get(EmailChannel);
      const spy = jest.spyOn(emailChannel, 'enviar').mockResolvedValue(true);

      await request(app.getHttpServer())
        .post('/api/platform/auth/password/olvide')
        .send({ email: ADMIN_EMAIL })
        .expect(201);

      const cuerpoHtml = spy.mock.calls[0][2] as string;
      const token = extraerTokenDeReset(cuerpoHtml);
      const nuevaPassword = 'NuevaPlatform456!';

      await request(app.getHttpServer())
        .post('/api/platform/auth/password/restablecer')
        .send({ token, password: nuevaPassword })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/platform/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/platform/auth/login')
        .send({ email: ADMIN_EMAIL, password: nuevaPassword })
        .expect(201);

      spy.mockRestore();
    });

    it('rechaza un token ya canjeado (de un solo uso)', async () => {
      const emailChannel = app.get(EmailChannel);
      const spy = jest.spyOn(emailChannel, 'enviar').mockResolvedValue(true);

      await request(app.getHttpServer())
        .post('/api/platform/auth/password/olvide')
        .send({ email: ADMIN_EMAIL })
        .expect(201);
      const token = extraerTokenDeReset(spy.mock.calls[spy.mock.calls.length - 1][2] as string);
      spy.mockRestore();

      await request(app.getHttpServer())
        .post('/api/platform/auth/password/restablecer')
        .send({ token, password: 'OtraClave789!' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/platform/auth/password/restablecer')
        .send({ token, password: 'Intento2Clave!' })
        .expect(400);
    });

    it('responde 201 genérico aunque el email no exista (no filtra qué admins están registrados)', async () => {
      await request(app.getHttpServer())
        .post('/api/platform/auth/password/olvide')
        .send({ email: 'no-existe@sistemadelsol.com' })
        .expect(201);
    });
  });
});
