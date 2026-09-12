import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * Aislamiento entre tenants para el plugin Travel Management (Fase 0 —
 * CRUD manual de reservas, sin proveedor todavía). Mismo patrón que
 * inmobiliaria.e2e-spec.ts: TenantPrismaService inyecta tenantId
 * automáticamente, pero cualquier "buscarPorId" nuevo necesita su propio
 * caso de aislamiento — es la red que atrapa ese tipo de bug.
 */
describe('Travel Management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const SUBDOMINIO_A = 'e2e-travel-a';
  const SUBDOMINIO_B = 'e2e-travel-b';
  const PASSWORD = 'Test1234!';

  let tenantAId: string;
  let tenantBId: string;
  let clienteAId: string;
  let reservaAId: string;

  const PERMISOS = ['travel.ver', 'travel.crear', 'travel.editar', 'travel.eliminar', 'travel.facturar'];

  async function crearPermisos(claves: string[]) {
    for (const clave of claves) {
      await prisma.permission.upsert({ where: { clave }, update: {}, create: { clave } }).catch((error) => {
        if (error?.code !== 'P2002') throw error;
      });
    }
  }

  async function crearTenantConUsuario(subdominio: string, email: string) {
    const modulo = await prisma.modulo.upsert({
      where: { clave: 'travel' },
      update: {},
      create: { clave: 'travel', nombre: 'Travel Management (plugin)' },
    });
    const plan = await prisma.plan.upsert({
      where: { nombre: 'E2E Travel' },
      update: {},
      create: { nombre: 'E2E Travel' },
    });
    await prisma.planModulo.upsert({
      where: { planId_moduloId: { planId: plan.id, moduloId: modulo.id } },
      update: {},
      create: { planId: plan.id, moduloId: modulo.id },
    });

    const tenant = await prisma.tenant.create({ data: { nombre: `E2E ${subdominio}`, subdominio, planId: plan.id } });
    const rol = await prisma.role.create({ data: { tenantId: tenant.id, nombre: `Completo ${subdominio}` } });
    for (const clave of PERMISOS) {
      const permiso = await prisma.permission.findUniqueOrThrow({ where: { clave } });
      await prisma.rolePermission.create({ data: { roleId: rol.id, permissionId: permiso.id } });
    }
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const usuario = await prisma.user.create({ data: { tenantId: tenant.id, email, nombre: email, passwordHash } });
    await prisma.userRole.create({ data: { userId: usuario.id, roleId: rol.id } });
    return tenant;
  }

  async function login(email: string, tenantSubdominio: string) {
    const respuesta = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD, tenantSubdominio });
    return respuesta.body.accessToken as string;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();
    await crearPermisos(PERMISOS);

    const tenantA = await crearTenantConUsuario(SUBDOMINIO_A, 'admin@e2e-travel-a.com');
    tenantAId = tenantA.id;
    const tenantB = await crearTenantConUsuario(SUBDOMINIO_B, 'admin@e2e-travel-b.com');
    tenantBId = tenantB.id;

    const clienteA = await prisma.cliente.create({ data: { tenantId: tenantAId, nombre: 'Cliente Travel A' } });
    clienteAId = clienteA.id;
    await prisma.cliente.create({ data: { tenantId: tenantBId, nombre: 'Cliente Travel B' } });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    await prisma.$disconnect();
  });

  it('el tenant A crea una reserva con un pasajero y le arma el código interno', async () => {
    const token = await login('admin@e2e-travel-a.com', SUBDOMINIO_A);

    const respuesta = await request(app.getHttpServer())
      .post('/api/admin/travel/reservas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clienteId: clienteAId,
        tipo: 'VUELO',
        moneda: 'DOP',
        montoCosto: 25000,
        montoVenta: 32000,
        pasajeros: [{ nombre: 'Juan', apellido: 'Pérez' }],
      })
      .expect(201);

    reservaAId = respuesta.body.id;
    expect(respuesta.body.codigoInterno).toMatch(/^TRV-\d{4}-\d+$/);
    expect(respuesta.body.pasajeros).toHaveLength(1);
  });

  it('el tenant B no puede crear una reserva para un cliente de A (IDOR)', async () => {
    const token = await login('admin@e2e-travel-b.com', SUBDOMINIO_B);

    await request(app.getHttpServer())
      .post('/api/admin/travel/reservas')
      .set('Authorization', `Bearer ${token}`)
      .send({ clienteId: clienteAId, tipo: 'VUELO', montoCosto: 100, montoVenta: 120 })
      .expect(404);
  });

  it('el tenant B no ve la reserva de A en el listado', async () => {
    const token = await login('admin@e2e-travel-b.com', SUBDOMINIO_B);

    const respuesta = await request(app.getHttpServer()).get('/api/admin/travel/reservas').set('Authorization', `Bearer ${token}`).expect(200);

    expect(respuesta.body.map((r: { id: string }) => r.id)).not.toContain(reservaAId);
  });

  it('el tenant B no puede leer la reserva de A por id directo', async () => {
    const token = await login('admin@e2e-travel-b.com', SUBDOMINIO_B);

    await request(app.getHttpServer())
      .get(`/api/admin/travel/reservas/${reservaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('el tenant B no puede editar la reserva de A (y no queda modificada)', async () => {
    const token = await login('admin@e2e-travel-b.com', SUBDOMINIO_B);

    await request(app.getHttpServer())
      .patch(`/api/admin/travel/reservas/${reservaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notas: 'Secuestrada por B' })
      .expect(404);

    const reserva = await prisma.travelReserva.findUniqueOrThrow({ where: { id: reservaAId } });
    expect(reserva.notas).toBeNull();
  });

  it('el tenant B no puede facturar la reserva de A', async () => {
    const token = await login('admin@e2e-travel-b.com', SUBDOMINIO_B);

    await request(app.getHttpServer())
      .post(`/api/admin/travel/reservas/${reservaAId}/facturar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('el tenant B no puede eliminar la reserva de A (y sigue existiendo)', async () => {
    const token = await login('admin@e2e-travel-b.com', SUBDOMINIO_B);

    await request(app.getHttpServer())
      .delete(`/api/admin/travel/reservas/${reservaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    await prisma.travelReserva.findUniqueOrThrow({ where: { id: reservaAId } });
  });

  it('el tenant A factura su propia reserva (sin bodega activa configurada, falla con 400 claro)', async () => {
    const token = await login('admin@e2e-travel-a.com', SUBDOMINIO_A);

    const respuesta = await request(app.getHttpServer())
      .post(`/api/admin/travel/reservas/${reservaAId}/facturar`)
      .set('Authorization', `Bearer ${token}`);

    // Este tenant E2E no tiene ninguna Bodega sembrada — confirma que el
    // guard de TravelService.facturar responde con un error de negocio
    // claro (400) en vez de reventar con un 500 al llamar FacturacionService.
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toContain('bodega activa');
  });

  it('el tenant A elimina su propia reserva', async () => {
    const token = await login('admin@e2e-travel-a.com', SUBDOMINIO_A);

    await request(app.getHttpServer())
      .delete(`/api/admin/travel/reservas/${reservaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
