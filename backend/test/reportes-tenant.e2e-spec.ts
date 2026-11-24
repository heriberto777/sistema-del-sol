import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

const DOC = (texto: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }] });

/**
 * Soporte Técnico (rediseño v2 — hilo de mensajes): el riesgo real es el
 * mismo de siempre con `ReporteTenant` — un id de ticket en manos de otro
 * tenant no debe filtrar nada (ni la lectura de mensajes ni poder
 * responder). `ReporteTenantMensaje` es hija sin tenantId propio (ver
 * CLAUDE.md), así que su aislamiento depende 100% de que el repositorio
 * resuelva primero el ticket padre contra el tenant — exactamente el tipo
 * de bug que este test existe para atrapar.
 */
describe('Soporte Técnico — hilo de mensajes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const SUBDOMINIO_A = 'e2e-soporte-a';
  const SUBDOMINIO_B = 'e2e-soporte-b';
  const PASSWORD = 'Test1234!';
  const ADMIN_EMAIL = 'e2e-soporte-admin@sistemadelsol.com';
  const ADMIN_PASSWORD = 'PlatformTest123!';

  let tenantAId: string;
  let tenantBId: string;
  let reporteId: string;

  async function loginTenant(email: string, subdominio: string) {
    const respuesta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD, tenantSubdominio: subdominio });
    return respuesta.body.accessToken as string;
  }

  async function loginPlataforma() {
    const respuesta = await request(app.getHttpServer())
      .post('/api/platform/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    return respuesta.body.accessToken as string;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();

    const plan = await prisma.plan.upsert({
      where: { nombre: 'E2E Soporte' },
      update: {},
      create: { nombre: 'E2E Soporte' },
    });

    const tenantA = await prisma.tenant.create({ data: { nombre: 'E2E Soporte A', subdominio: SUBDOMINIO_A, planId: plan.id } });
    tenantAId = tenantA.id;
    const tenantB = await prisma.tenant.create({ data: { nombre: 'E2E Soporte B', subdominio: SUBDOMINIO_B, planId: plan.id } });
    tenantBId = tenantB.id;

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const rolA = await prisma.role.create({ data: { tenantId: tenantAId, nombre: 'Cualquiera' } });
    await prisma.user.create({
      data: { tenantId: tenantAId, email: 'usuario@e2e-soporte-a.com', nombre: 'Usuario A', passwordHash, roles: { create: { roleId: rolA.id } } },
    });
    const rolB = await prisma.role.create({ data: { tenantId: tenantBId, nombre: 'Cualquiera' } });
    await prisma.user.create({
      data: { tenantId: tenantBId, email: 'usuario@e2e-soporte-b.com', nombre: 'Usuario B', passwordHash, roles: { create: { roleId: rolB.id } } },
    });

    // Admin de plataforma con el único permiso que necesita este módulo.
    const permiso = await prisma.platformPermission
      .upsert({ where: { clave: 'platform.soporte.gestionar' }, update: {}, create: { clave: 'platform.soporte.gestionar' } })
      .catch(async (error) => {
        if (error?.code !== 'P2002') throw error;
        return prisma.platformPermission.findUniqueOrThrow({ where: { clave: 'platform.soporte.gestionar' } });
      });
    const rolPlataforma = await prisma.platformRole.upsert({
      where: { nombre: 'E2E Soporte Admin' },
      update: {},
      create: { nombre: 'E2E Soporte Admin' },
    });
    await prisma.platformRolePermission.upsert({
      where: { roleId_permissionId: { roleId: rolPlataforma.id, permissionId: permiso.id } },
      update: {},
      create: { roleId: rolPlataforma.id, permissionId: permiso.id },
    });
    const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.platformAdmin.upsert({
      where: { email: ADMIN_EMAIL },
      update: { roleId: rolPlataforma.id },
      create: { email: ADMIN_EMAIL, passwordHash: adminPasswordHash, nombre: 'E2E Soporte Admin', roleId: rolPlataforma.id },
    });

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
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    await prisma.$disconnect();
  });

  it('el usuario de A crea un ticket (ticket + mensaje #1 en una sola operación)', async () => {
    const token = await loginTenant('usuario@e2e-soporte-a.com', SUBDOMINIO_A);

    const respuesta = await request(app.getHttpServer())
      .post('/api/reportes-tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ asunto: 'Rechazar cotización se queda en Aceptada', categoria: 'BUG', cuerpo: DOC('Al rechazar, el estado no cambia.') })
      .expect(201);

    reporteId = respuesta.body.id;
    expect(respuesta.body.estado).toBe('NUEVO');
    expect(respuesta.body.mensajes).toHaveLength(1);
    expect(respuesta.body.mensajes[0].autorTipo).toBe('TENANT');
  });

  it('rechaza un cuerpo con un nodo fuera de la lista blanca de Tiptap (400)', async () => {
    const token = await loginTenant('usuario@e2e-soporte-a.com', SUBDOMINIO_A);

    await request(app.getHttpServer())
      .post('/api/reportes-tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ asunto: 'Otro', categoria: 'DUDA', cuerpo: { type: 'doc', content: [{ type: 'image' }] } })
      .expect(400);
  });

  it('el usuario de B (otro tenant) NO puede leer los mensajes del ticket de A', async () => {
    const token = await loginTenant('usuario@e2e-soporte-b.com', SUBDOMINIO_B);

    await request(app.getHttpServer())
      .get(`/api/reportes-tenant/${reporteId}/mensajes`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('el usuario de B NO puede responder al ticket de A', async () => {
    const token = await loginTenant('usuario@e2e-soporte-b.com', SUBDOMINIO_B);

    await request(app.getHttpServer())
      .post(`/api/reportes-tenant/${reporteId}/mensajes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cuerpo: DOC('Intento de B') })
      .expect(404);

    const mensajes = await prisma.reporteTenantMensaje.findMany({ where: { reporteId } });
    expect(mensajes).toHaveLength(1);
  });

  it('plataforma ve el ticket y responde — pasa de NUEVO a EN_REVISION automático', async () => {
    const token = await loginPlataforma();

    const respuesta = await request(app.getHttpServer())
      .post(`/api/platform/reportes-tenant/${reporteId}/mensajes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cuerpo: DOC('Ya lo estamos revisando.') })
      .expect(201);
    expect(respuesta.body.autorTipo).toBe('SOPORTE');

    const ticket = await prisma.reporteTenant.findUniqueOrThrow({ where: { id: reporteId } });
    expect(ticket.estado).toBe('EN_REVISION');
  });

  it('plataforma marca el ticket como RESUELTO (acción separada de enviar mensaje)', async () => {
    const token = await loginPlataforma();

    await request(app.getHttpServer())
      .patch(`/api/platform/reportes-tenant/${reporteId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'RESUELTO' })
      .expect(200);

    const ticket = await prisma.reporteTenant.findUniqueOrThrow({ where: { id: reporteId } });
    expect(ticket.estado).toBe('RESUELTO');
  });

  it('el tenant A responde después de RESUELTO — el ticket se reabre a EN_REVISION', async () => {
    const token = await loginTenant('usuario@e2e-soporte-a.com', SUBDOMINIO_A);

    await request(app.getHttpServer())
      .post(`/api/reportes-tenant/${reporteId}/mensajes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cuerpo: DOC('Sigue sin funcionar.') })
      .expect(201);

    const ticket = await prisma.reporteTenant.findUniqueOrThrow({ where: { id: reporteId } });
    expect(ticket.estado).toBe('EN_REVISION');

    const mensajes = await prisma.reporteTenantMensaje.findMany({ where: { reporteId } });
    expect(mensajes).toHaveLength(3);
  });
});
