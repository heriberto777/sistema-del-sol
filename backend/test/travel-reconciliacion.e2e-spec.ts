import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PERMISOS_PLATAFORMA_BASE } from '../src/platform-auth/platform-roles-base';
import { DuffelAdapter } from '../src/travel/providers/duffel.adapter';

/**
 * Reconciliación de la cuenta compartida de Duffel — endpoint de
 * PLATAFORMA (no de tenant, la cuenta es una sola para todos). Mismo
 * criterio de doble de prueba de DuffelAdapter que travel.e2e-spec.ts —
 * nunca contra la API real.
 */
const duffelAdapterFake = {
  clave: 'duffel',
  habilitado: true,
  listarOrdenes: jest.fn(),
};

describe('Reconciliación de Travel (e2e, plataforma)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const ADMIN_EMAIL = 'e2e-reconciliacion-admin@sistemadelsol.com';
  const ADMIN_PASSWORD = 'PlatformTest123!';

  let tenantAId: string;
  let clienteAId: string;

  async function loginPlataforma() {
    const respuesta = await request(app.getHttpServer()).post('/api/platform/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    return respuesta.body.accessToken as string;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();

    for (const clave of PERMISOS_PLATAFORMA_BASE) {
      await prisma.platformPermission.upsert({ where: { clave }, update: {}, create: { clave } }).catch((error) => {
        if (error?.code !== 'P2002') throw error;
      });
    }
    const permisos = await prisma.platformPermission.findMany({ where: { clave: { in: PERMISOS_PLATAFORMA_BASE } } });
    const rol = await prisma.platformRole.upsert({ where: { nombre: 'E2E Reconciliación' }, update: {}, create: { nombre: 'E2E Reconciliación' } });
    await prisma.platformRolePermission.deleteMany({ where: { roleId: rol.id } });
    await prisma.platformRolePermission.createMany({ data: permisos.map((p) => ({ roleId: rol.id, permissionId: p.id })) });

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.platformAdmin.upsert({
      where: { email: ADMIN_EMAIL },
      update: { passwordHash, activo: true, roleId: rol.id },
      create: { email: ADMIN_EMAIL, passwordHash, nombre: 'E2E Reconciliación', roleId: rol.id },
    });

    const plan = await prisma.plan.upsert({ where: { nombre: 'E2E Reconciliación Plan' }, update: {}, create: { nombre: 'E2E Reconciliación Plan' } });
    const tenant = await prisma.tenant.create({ data: { nombre: 'E2E Reconciliación Tenant', subdominio: 'e2e-reconciliacion', planId: plan.id } });
    tenantAId = tenant.id;
    const cliente = await prisma.cliente.create({ data: { tenantId: tenantAId, nombre: 'Cliente Reconciliación' } });
    clienteAId = cliente.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DuffelAdapter).useValue(duffelAdapterFake).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await prisma.tenant.deleteMany({ where: { id: tenantAId } });
    await prisma.platformAdmin.deleteMany({ where: { email: ADMIN_EMAIL } });
    await prisma.$disconnect();
  });

  afterEach(() => {
    duffelAdapterFake.listarOrdenes.mockReset();
  });

  it('un token de tenant normal no puede usar la ruta de plataforma', async () => {
    await request(app.getHttpServer()).get('/api/platform/travel/reconciliacion').expect(401);
  });

  it('detecta una orden huérfana (sin ninguna TravelReserva asociada)', async () => {
    duffelAdapterFake.listarOrdenes.mockResolvedValueOnce({
      ordenes: [{ id: 'ord_huerfana', localizador: 'XYZ999', montoTotal: '300.00', moneda: 'USD', creadaEn: '2026-01-01T00:00:00Z', canceladaEn: null }],
      cursorSiguiente: null,
    });

    const token = await loginPlataforma();
    const respuesta = await request(app.getHttpServer()).get('/api/platform/travel/reconciliacion').set('Authorization', `Bearer ${token}`).expect(200);

    expect(respuesta.body.totalOrdenesRevisadas).toBe(1);
    expect(respuesta.body.ordenesHuerfanas).toEqual([
      { id: 'ord_huerfana', localizador: 'XYZ999', montoTotal: '300.00', moneda: 'USD', creadaEn: '2026-01-01T00:00:00Z', canceladaEn: null },
    ]);
    expect(respuesta.body.cancelacionesNoReflejadas).toEqual([]);
  });

  it('detecta una cancelación no reflejada cuando la reserva interna existe pero sigue sin CANCELADA', async () => {
    const reserva = await prisma.travelReserva.create({
      data: {
        tenantId: tenantAId,
        codigoInterno: 'TRV-2026-999999',
        clienteId: clienteAId,
        tipo: 'VUELO',
        estado: 'CONFIRMADA',
        moneda: 'USD',
        montoCosto: 100,
        montoVenta: 130,
        proveedor: 'duffel',
        proveedorOrdenId: 'ord_cancelada_en_duffel',
      },
    });

    duffelAdapterFake.listarOrdenes.mockResolvedValueOnce({
      ordenes: [{ id: 'ord_cancelada_en_duffel', localizador: 'ABC111', montoTotal: '100.00', moneda: 'USD', creadaEn: '2026-01-01T00:00:00Z', canceladaEn: '2026-01-05T00:00:00Z' }],
      cursorSiguiente: null,
    });

    const token = await loginPlataforma();
    const respuesta = await request(app.getHttpServer()).get('/api/platform/travel/reconciliacion').set('Authorization', `Bearer ${token}`).expect(200);

    expect(respuesta.body.cancelacionesNoReflejadas).toEqual([
      { ordenId: 'ord_cancelada_en_duffel', reservaId: reserva.id, tenantId: tenantAId, codigoInterno: 'TRV-2026-999999', canceladaEn: '2026-01-05T00:00:00Z' },
    ]);
  });
});
