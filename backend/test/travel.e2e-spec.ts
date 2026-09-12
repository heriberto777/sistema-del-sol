import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { DuffelAdapter } from '../src/travel/providers/duffel.adapter';

/**
 * Doble de prueba de DuffelAdapter — los e2e no pueden depender de la
 * API real de Duffel (necesitaría un token real, sería lento/frágil y
 * gastaría el sandbox). Devuelve siempre lo mismo, determinístico,
 * respetando la forma normalizada de TravelProvider.
 */
const OFERTA_FAKE = {
  id: 'off_fake',
  aerolinea: 'Fake Air',
  montoTotal: '450.00',
  moneda: 'USD',
  expiraEn: new Date(Date.now() + 3600_000).toISOString(),
  tramosCrudo: [],
};
const duffelAdapterFake = {
  clave: 'duffel',
  habilitado: true,
  buscarVuelos: jest.fn().mockResolvedValue({ solicitudId: 'orq_fake', ofertas: [OFERTA_FAKE] }),
  obtenerOferta: jest.fn().mockResolvedValue(OFERTA_FAKE),
  crearOrdenVuelo: jest.fn().mockResolvedValue({ id: 'ord_fake', localizador: 'FAKE123', montoTotal: '450.00', moneda: 'USD' }),
  cotizarCancelacion: jest.fn().mockResolvedValue({ id: 'orc_fake', montoReembolso: '300.00', moneda: 'USD' }),
  confirmarCancelacion: jest.fn().mockResolvedValue({ reembolsado: true, montoReembolso: '300.00', moneda: 'USD' }),
};

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

  const PERMISOS = [
    'travel.ver',
    'travel.crear',
    'travel.editar',
    'travel.eliminar',
    'travel.facturar',
    'travel.buscar',
    'travel.reservar',
    'travel.cancelar',
  ];

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

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DuffelAdapter)
      .useValue(duffelAdapterFake)
      .compile();
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

  it('el tenant A factura una reserva en USD convirtiendo a DOP con la tasa configurada del tenant', async () => {
    const token = await login('admin@e2e-travel-a.com', SUBDOMINIO_A);

    const sucursal = await prisma.sucursal.create({ data: { tenantId: tenantAId, nombre: 'Principal' } });
    await prisma.bodega.create({ data: { tenantId: tenantAId, sucursalId: sucursal.id, nombre: 'Principal', activa: true } });
    await prisma.tasaCambio.create({ data: { tenantId: tenantAId, moneda: 'USD', tasa: 58.5 } });
    // CONTADO + comprobante CONSUMO (default) + modalidad NCF (default del tenant) → TipoNcf 'B02' (ver TIPO_NCF_COMPLETO en facturacion.service.ts).
    await prisma.ncfAsignado.create({
      data: { tenantId: tenantAId, tipoNcf: 'B02', secuenciaActual: 1, secuenciaFinal: 9999, vigenciaHasta: new Date('2030-01-01') },
    });

    const creada = await request(app.getHttpServer())
      .post('/api/admin/travel/reservas')
      .set('Authorization', `Bearer ${token}`)
      .send({ clienteId: clienteAId, tipo: 'VUELO', moneda: 'USD', montoCosto: 250, montoVenta: 320 })
      .expect(201);

    const respuesta = await request(app.getHttpServer())
      .post(`/api/admin/travel/reservas/${creada.body.id}/facturar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const factura = await prisma.factura.findUniqueOrThrow({ where: { id: respuesta.body.facturaId } });
    expect(factura.moneda).toBe('USD');
    // 320 USD * 58.5 = 18720 DOP — el subtotal en DOP siempre es la fuente de verdad (ver CLAUDE.md, ítem C-2).
    expect(Number(factura.subtotal)).toBe(18720);
  });

  it('el tenant A no puede facturar en una moneda sin tasa de cambio configurada', async () => {
    const token = await login('admin@e2e-travel-a.com', SUBDOMINIO_A);

    const creada = await request(app.getHttpServer())
      .post('/api/admin/travel/reservas')
      .set('Authorization', `Bearer ${token}`)
      .send({ clienteId: clienteAId, tipo: 'VUELO', moneda: 'EUR', montoCosto: 100, montoVenta: 120 })
      .expect(201);

    const respuesta = await request(app.getHttpServer())
      .post(`/api/admin/travel/reservas/${creada.body.id}/facturar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(respuesta.body.message).toContain('EUR');
  });

  it('el tenant A elimina su propia reserva', async () => {
    const token = await login('admin@e2e-travel-a.com', SUBDOMINIO_A);

    await request(app.getHttpServer())
      .delete(`/api/admin/travel/reservas/${reservaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  describe('Fase 1b — búsqueda/reserva/cancelación reales (con DuffelAdapter de prueba)', () => {
    let reservaDuffelAId: string;

    it('buscarVuelos delega en el proveedor (activo)', async () => {
      const token = await login('admin@e2e-travel-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/admin/travel/vuelos/buscar')
        .set('Authorization', `Bearer ${token}`)
        .send({ tramos: [{ origen: 'SDQ', destino: 'MAD', fecha: '2026-12-10' }], pasajeros: [{ tipo: 'adult' }] })
        .expect(201);

      expect(respuesta.body.ofertas).toHaveLength(1);
      expect(respuesta.body.ofertas[0].id).toBe('off_fake');
    });

    it('el tenant B no puede reservar contra Duffel usando un cliente de A (IDOR)', async () => {
      const token = await login('admin@e2e-travel-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .post('/api/admin/travel/reservas/duffel')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clienteId: clienteAId,
          ofertaId: 'off_fake',
          montoVenta: 500,
          pasajeros: [{ id: 'pas_1', nombre: 'Juan', apellido: 'Pérez', fechaNacimiento: '1990-01-01', genero: 'm', titulo: 'mr', email: 'j@x.com', telefono: '+18095551234' }],
        })
        .expect(404);
    });

    it('el tenant A reserva de verdad contra Duffel (re-price + Balance) y queda CONFIRMADA con el débito en el ledger', async () => {
      const token = await login('admin@e2e-travel-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/admin/travel/reservas/duffel')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clienteId: clienteAId,
          ofertaId: 'off_fake',
          montoVenta: 500,
          pasajeros: [{ id: 'pas_1', nombre: 'Juan', apellido: 'Pérez', fechaNacimiento: '1990-01-01', genero: 'm', titulo: 'mr', email: 'j@x.com', telefono: '+18095551234' }],
        })
        .expect(201);

      reservaDuffelAId = respuesta.body.id;
      expect(respuesta.body.estado).toBe('CONFIRMADA');
      expect(respuesta.body.proveedor).toBe('duffel');
      expect(respuesta.body.proveedorOrdenId).toBe('ord_fake');
      expect(respuesta.body.localizadorAerolinea).toBe('FAKE123');
      expect(Number(respuesta.body.montoCosto)).toBe(450);

      const ledger = await request(app.getHttpServer()).get('/api/admin/travel/ledger').set('Authorization', `Bearer ${token}`).expect(200);
      expect(ledger.body).toEqual(expect.arrayContaining([{ moneda: 'USD', saldo: -450 }]));
    });

    it('el tenant A reserva contra Duffel con pasaporte y queda persistido en el pasajero', async () => {
      const token = await login('admin@e2e-travel-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/admin/travel/reservas/duffel')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clienteId: clienteAId,
          ofertaId: 'off_fake',
          montoVenta: 500,
          pasajeros: [
            {
              id: 'pas_1',
              nombre: 'María',
              apellido: 'García',
              fechaNacimiento: '1985-05-20',
              genero: 'f',
              titulo: 'mrs',
              email: 'm@x.com',
              telefono: '+18095551234',
              numeroPasaporte: 'AB123456',
              paisEmisionPasaporte: 'DO',
              fechaVencimientoPasaporte: '2030-01-01',
            },
          ],
        })
        .expect(201);

      expect(respuesta.body.pasajeros[0].numeroDocumento).toBe('AB123456');
      expect(respuesta.body.pasajeros[0].paisEmisionDocumento).toBe('DO');
      expect(respuesta.body.pasajeros[0].fechaVencimientoDocumento).toContain('2030-01-01');
    });

    it('el tenant B no ve el ledger de A (aislamiento)', async () => {
      const token = await login('admin@e2e-travel-b.com', SUBDOMINIO_B);
      const ledger = await request(app.getHttpServer()).get('/api/admin/travel/ledger').set('Authorization', `Bearer ${token}`).expect(200);
      expect(ledger.body).toEqual([]);
    });

    it('el tenant B no puede cotizar/confirmar la cancelación de la reserva Duffel de A', async () => {
      const token = await login('admin@e2e-travel-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .post(`/api/admin/travel/reservas/${reservaDuffelAId}/cancelacion/cotizar`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('el tenant A cotiza y confirma la cancelación — pasa a CANCELADA y el ledger acredita el reembolso', async () => {
      const token = await login('admin@e2e-travel-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post(`/api/admin/travel/reservas/${reservaDuffelAId}/cancelacion/cotizar`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/admin/travel/reservas/${reservaDuffelAId}/cancelacion/confirmar`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const reserva = await prisma.travelReserva.findUniqueOrThrow({ where: { id: reservaDuffelAId } });
      expect(reserva.estado).toBe('CANCELADA');

      // Débito de 450 (esta reserva) + débito de 450 (la reserva con pasaporte del test anterior, nunca cancelada)
      // + crédito de 300 al confirmar este reembolso = -600 neto.
      const ledger = await request(app.getHttpServer()).get('/api/admin/travel/ledger').set('Authorization', `Bearer ${token}`).expect(200);
      expect(ledger.body).toEqual(expect.arrayContaining([{ moneda: 'USD', saldo: -600 }]));
    });
  });
});
