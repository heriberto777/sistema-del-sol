import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { DuffelAdapter } from '../src/travel/providers/duffel.adapter';
import { cifrar } from '../src/common/utils/encriptado.util';

process.env.ENCRYPTION_KEY ??= 'clave-de-prueba-e2e-64-caracteres-para-scrypt-1234567890abcdef';

/**
 * Reconciliación de la cuenta de Duffel PROPIA de cada tenant — ya NO es
 * un endpoint de Plataforma (esa cuenta compartida se retiró). Mismo
 * criterio de doble de prueba de DuffelAdapter que travel.e2e-spec.ts —
 * nunca contra la API real.
 */
const duffelAdapterFake = {
  clave: 'duffel',
  listarOrdenes: jest.fn(),
};

describe('Reconciliación de Travel (e2e, por tenant)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const SUBDOMINIO_A = 'e2e-reconciliacion-a';
  const SUBDOMINIO_B = 'e2e-reconciliacion-b';
  const PASSWORD = 'Test1234!';

  let tenantAId: string;
  let tenantBId: string;
  let clienteAId: string;

  const PERMISOS = ['admin.configuracion'];

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
    const plan = await prisma.plan.upsert({ where: { nombre: 'E2E Reconciliación' }, update: {}, create: { nombre: 'E2E Reconciliación' } });
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

    const tenantA = await crearTenantConUsuario(SUBDOMINIO_A, 'admin@e2e-reconciliacion-a.com');
    tenantAId = tenantA.id;
    const tenantB = await crearTenantConUsuario(SUBDOMINIO_B, 'admin@e2e-reconciliacion-b.com');
    tenantBId = tenantB.id;

    const clienteA = await prisma.cliente.create({ data: { tenantId: tenantAId, nombre: 'Cliente Reconciliación A' } });
    clienteAId = clienteA.id;

    // Solo el tenant A trae cuenta de Duffel — B existe nada más para el
    // test de aislamiento (nunca ve nada de la reconciliación de A).
    await prisma.travelConfigTenant.create({ data: { tenantId: tenantAId, duffelApiTokenCifrado: cifrar('duffel_test_fake_e2e') } });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DuffelAdapter).useValue(duffelAdapterFake).compile();
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

  afterEach(() => {
    duffelAdapterFake.listarOrdenes.mockReset();
  });

  it('sin token no puede usar la ruta', async () => {
    await request(app.getHttpServer()).get('/api/admin/travel/reconciliacion').expect(401);
  });

  it('rechaza (503) si el tenant no configuró su cuenta de Duffel — sin fallback a ninguna cuenta compartida', async () => {
    const token = await login('admin@e2e-reconciliacion-b.com', SUBDOMINIO_B);
    await request(app.getHttpServer()).get('/api/admin/travel/reconciliacion').set('Authorization', `Bearer ${token}`).expect(503);
    expect(duffelAdapterFake.listarOrdenes).not.toHaveBeenCalled();
  });

  it('detecta una orden huérfana (sin ninguna TravelReserva asociada)', async () => {
    duffelAdapterFake.listarOrdenes.mockResolvedValueOnce({
      ordenes: [{ id: 'ord_huerfana', localizador: 'XYZ999', montoTotal: '300.00', moneda: 'USD', creadaEn: '2026-01-01T00:00:00Z', canceladaEn: null }],
      cursorSiguiente: null,
    });

    const token = await login('admin@e2e-reconciliacion-a.com', SUBDOMINIO_A);
    const respuesta = await request(app.getHttpServer()).get('/api/admin/travel/reconciliacion').set('Authorization', `Bearer ${token}`).expect(200);

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

    const token = await login('admin@e2e-reconciliacion-a.com', SUBDOMINIO_A);
    const respuesta = await request(app.getHttpServer()).get('/api/admin/travel/reconciliacion').set('Authorization', `Bearer ${token}`).expect(200);

    expect(respuesta.body.cancelacionesNoReflejadas).toEqual([
      { ordenId: 'ord_cancelada_en_duffel', reservaId: reserva.id, codigoInterno: 'TRV-2026-999999', canceladaEn: '2026-01-05T00:00:00Z' },
    ]);
  });

  it('el tenant B no ve las órdenes/reservas de A aunque tuviera su propia cuenta (aislamiento)', async () => {
    // Le damos a B su propia cuenta recién acá, para no interferir con el
    // test de "503 sin cuenta" de arriba — `upsert`, no `create`: el test
    // anterior ya hizo que `TravelConfigService.obtenerCredencialesDuffel`
    // creara la fila vacía de B vía `obtenerOCrear` (upsert interno).
    await prisma.travelConfigTenant.upsert({
      where: { tenantId: tenantBId },
      create: { tenantId: tenantBId, duffelApiTokenCifrado: cifrar('duffel_test_fake_e2e_b') },
      update: { duffelApiTokenCifrado: cifrar('duffel_test_fake_e2e_b') },
    });

    duffelAdapterFake.listarOrdenes.mockResolvedValueOnce({
      ordenes: [{ id: 'ord_cancelada_en_duffel', localizador: 'ABC111', montoTotal: '100.00', moneda: 'USD', creadaEn: '2026-01-01T00:00:00Z', canceladaEn: '2026-01-05T00:00:00Z' }],
      cursorSiguiente: null,
    });

    const token = await login('admin@e2e-reconciliacion-b.com', SUBDOMINIO_B);
    const respuesta = await request(app.getHttpServer()).get('/api/admin/travel/reconciliacion').set('Authorization', `Bearer ${token}`).expect(200);

    // Misma orden que ya tiene una TravelReserva real, pero de OTRO tenant — para B, su propio listado (vacío) la ve como huérfana.
    expect(respuesta.body.ordenesHuerfanas).toHaveLength(1);
    expect(respuesta.body.cancelacionesNoReflejadas).toEqual([]);
  });
});
