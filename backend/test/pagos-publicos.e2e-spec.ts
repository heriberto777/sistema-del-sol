import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * Rutas públicas (sin autenticación) por donde el admin de un tenant
 * paga en línea la factura de su suscripción — llega desde un link de
 * email, no tiene sesión de plataforma ni de tenant. No se prueba acá
 * el checkout exitoso contra la API real de Stripe (requeriría
 * credenciales reales); STRIPE_SECRET_KEY no está seteada en el
 * entorno de test a propósito, así que el camino de degradación (503)
 * es justo lo que se verifica.
 */
describe('Pagos públicos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  let facturaPendienteId: string;
  let facturaPagadaId: string;
  let tenantId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();

    const plan = await prisma.plan.upsert({
      where: { nombre: 'E2E Pagos Publicos' },
      update: { precio: 1000 },
      create: { nombre: 'E2E Pagos Publicos', precio: 1000 },
    });

    const tenant = await prisma.tenant.create({
      data: { nombre: 'E2E Pagos Publicos', subdominio: 'e2e-pagos-publicos', planId: plan.id },
    });
    tenantId = tenant.id;

    const suscripcion = await prisma.suscripcion.create({
      data: { tenantId: tenant.id, planId: plan.id, fechaProximoCorte: new Date() },
    });

    const facturaPendiente = await prisma.facturaPlataforma.create({
      data: {
        tenantId: tenant.id,
        suscripcionId: suscripcion.id,
        concepto: 'Suscripción E2E',
        monto: 1000,
        total: 1000,
        fechaVencimiento: new Date(),
      },
    });
    facturaPendienteId = facturaPendiente.id;

    const facturaPagada = await prisma.facturaPlataforma.create({
      data: {
        tenantId: tenant.id,
        suscripcionId: suscripcion.id,
        concepto: 'Suscripción E2E (ya pagada)',
        monto: 1000,
        total: 1000,
        estado: 'PAGADA',
        fechaVencimiento: new Date(),
        fechaPago: new Date(),
      },
    });
    facturaPagadaId = facturaPagada.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  describe('GET /pagos-publicos/facturas/:facturaId', () => {
    it('responde 404 para una factura que no existe', async () => {
      await request(app.getHttpServer()).get('/api/pagos-publicos/facturas/00000000-0000-0000-0000-000000000000').expect(404);
    });

    it('responde 200 con los datos seguros de una factura pendiente, sin autenticación', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(`/api/pagos-publicos/facturas/${facturaPendienteId}`)
        .expect(200);

      expect(respuesta.body).toEqual(
        expect.objectContaining({
          tenant: { nombre: 'E2E Pagos Publicos' },
          concepto: 'Suscripción E2E',
          estado: 'PENDIENTE',
          pendiente: 1000,
        }),
      );
    });
  });

  describe('POST /pagos-publicos/facturas/:facturaId/checkout', () => {
    it('responde 503 sin STRIPE_SECRET_KEY configurada (degradación con gracia, sin credenciales reales)', async () => {
      await request(app.getHttpServer()).post(`/api/pagos-publicos/facturas/${facturaPendienteId}/checkout`).expect(503);
    });

    it('rechaza intentar pagar una factura ya PAGADA', async () => {
      await request(app.getHttpServer()).post(`/api/pagos-publicos/facturas/${facturaPagadaId}/checkout`).expect(400);
    });

    it('responde 404 para una factura que no existe', async () => {
      await request(app.getHttpServer())
        .post('/api/pagos-publicos/facturas/00000000-0000-0000-0000-000000000000/checkout')
        .expect(404);
    });
  });

  describe('POST /pagos-publicos/webhook/stripe', () => {
    it('rechaza sin STRIPE_WEBHOOK_SECRET configurada (firma nunca puede verificarse)', async () => {
      await request(app.getHttpServer())
        .post('/api/pagos-publicos/webhook/stripe')
        .set('stripe-signature', 't=123,v1=firma-invalida')
        .send({ type: 'checkout.session.completed' })
        .expect(400);
    });

    it('rechaza sin header de firma', async () => {
      await request(app.getHttpServer())
        .post('/api/pagos-publicos/webhook/stripe')
        .send({ type: 'checkout.session.completed' })
        .expect(400);
    });
  });
});
