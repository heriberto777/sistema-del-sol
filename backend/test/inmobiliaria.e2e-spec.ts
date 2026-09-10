import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * Aislamiento real entre tenants para el plugin Inmobiliaria, contra
 * Postgres real — cubre tanto el panel admin (`TenantPrismaService`,
 * auto-inyecta tenantId) como el catálogo público (`PrismaService`
 * global + tenantId resuelto a mano por subdominio, ver
 * `resolver-tenant-publico-inmobiliaria.ts`), que son dos mecanismos de
 * scoping distintos y cada uno puede fallar por separado.
 */
describe('Inmobiliaria (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const SUBDOMINIO_A = 'e2e-inmobiliaria-a';
  const SUBDOMINIO_B = 'e2e-inmobiliaria-b';
  const PASSWORD = 'Test1234!';

  let tenantAId: string;
  let tenantBId: string;
  let clienteAId: string;
  let clienteBId: string;
  let agenteAId: string;
  let propiedadAId: string;
  let propiedadBId: string;
  let contratoAId: string;
  let propietarioAId: string;
  let propiedadAlquilerAId: string;
  let contratoAlquilerAId: string;
  let cobroAlquilerAId: string;
  let propiedadPreventaAId: string;

  async function crearPermisos(claves: string[]) {
    for (const clave of claves) {
      await prisma.permission.upsert({ where: { clave }, update: {}, create: { clave } }).catch((error) => {
        if (error?.code !== 'P2002') throw error;
      });
    }
  }

  const PERMISOS = [
    'inmobiliaria.propiedades.ver',
    'inmobiliaria.propiedades.crear',
    'inmobiliaria.propiedades.editar',
    'inmobiliaria.propiedades.eliminar',
    'inmobiliaria.contratos.ver',
    'inmobiliaria.contratos.crear',
    'inmobiliaria.contratos.anular',
    'inmobiliaria.alquileres.ver',
    'inmobiliaria.alquileres.gestionar',
    'inmobiliaria.preventas.crear',
  ];

  async function crearTenantConUsuario(subdominio: string, email: string) {
    const modulo = await prisma.modulo.upsert({
      where: { clave: 'inmobiliaria' },
      update: {},
      create: { clave: 'inmobiliaria', nombre: 'Inmobiliaria (plugin)' },
    });
    const plan = await prisma.plan.upsert({
      where: { nombre: 'E2E Inmobiliaria' },
      update: {},
      create: { nombre: 'E2E Inmobiliaria' },
    });
    await prisma.planModulo.upsert({
      where: { planId_moduloId: { planId: plan.id, moduloId: modulo.id } },
      update: {},
      create: { planId: plan.id, moduloId: modulo.id },
    });

    const tenant = await prisma.tenant.create({
      data: { nombre: `E2E ${subdominio}`, subdominio, planId: plan.id },
    });
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
    const respuesta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD, tenantSubdominio });
    return respuesta.body.accessToken as string;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();

    await crearPermisos(PERMISOS);

    const tenantA = await crearTenantConUsuario(SUBDOMINIO_A, 'admin@e2e-inmo-a.com');
    tenantAId = tenantA.id;
    const tenantB = await crearTenantConUsuario(SUBDOMINIO_B, 'admin@e2e-inmo-b.com');
    tenantBId = tenantB.id;

    const clienteA = await prisma.cliente.create({ data: { tenantId: tenantAId, nombre: 'Cliente Inmo A' } });
    clienteAId = clienteA.id;
    const clienteB = await prisma.cliente.create({ data: { tenantId: tenantBId, nombre: 'Cliente Inmo B' } });
    clienteBId = clienteB.id;

    const agenteA = await prisma.empleado.create({
      data: {
        tenantId: tenantAId,
        nombre: 'Agente A',
        cedula: '001-0000001-1',
        cargo: 'Agente inmobiliario',
        fechaIngreso: new Date(),
        salarioBrutoMensual: 30000,
        telefono: '8095551234',
      },
    });
    agenteAId = agenteA.id;

    const propiedadA = await prisma.propiedad.create({
      data: {
        tenantId: tenantAId,
        codigo: 'PROP-A-001',
        titulo: 'Apartamento exclusivo de A',
        tipo: 'APARTAMENTO',
        operacion: 'VENTA',
        precio: 150000,
        ubicacion: 'Piantini, Santo Domingo',
        agenteId: agenteAId,
      },
    });
    propiedadAId = propiedadA.id;

    const propiedadB = await prisma.propiedad.create({
      data: {
        tenantId: tenantBId,
        codigo: 'PROP-B-001',
        titulo: 'Villa exclusiva de B',
        tipo: 'VILLA',
        operacion: 'ALQUILER',
        precio: 2000,
        ubicacion: 'Punta Cana',
      },
    });
    propiedadBId = propiedadB.id;

    // ---- Modelo 2 (administración de alquileres) — fixtures propias de A ----
    const propietarioA = await prisma.cliente.create({ data: { tenantId: tenantAId, nombre: 'Propietario A' } });
    propietarioAId = propietarioA.id;

    const propiedadAlquilerA = await prisma.propiedad.create({
      data: {
        tenantId: tenantAId,
        codigo: 'PROP-A-ALQ',
        titulo: 'Local en alquiler de A',
        tipo: 'LOCAL_COMERCIAL',
        operacion: 'ALQUILER',
        precio: 1500,
        ubicacion: 'Naco, Santo Domingo',
        propietarioId: propietarioAId,
      },
    });
    propiedadAlquilerAId = propiedadAlquilerA.id;

    // Se crea directo por Prisma (no vía /contratos) para no depender del
    // flujo completo de "cerrar negocio" — acá solo importa que el cobro
    // y el contrato administrado existan para probar el aislamiento.
    const contratoAlquilerA = await prisma.contratoPropiedad.create({
      data: {
        tenantId: tenantAId,
        propiedadId: propiedadAlquilerAId,
        clienteId: clienteAId,
        tipo: 'ALQUILER',
        monto: 1500,
        administracionActiva: true,
        porcentajeComisionAdministracion: 10,
        proximoCobroAlquilerEn: new Date('2026-10-15T00:00:00Z'),
      },
    });
    contratoAlquilerAId = contratoAlquilerA.id;

    const cobroAlquilerA = await prisma.cobroAlquiler.create({
      data: {
        tenantId: tenantAId,
        contratoPropiedadId: contratoAlquilerAId,
        periodo: '2026-09',
        montoAlquiler: 1500,
        porcentajeComisionAdmin: 10,
        montoComisionAdmin: 150,
        montoPropietario: 1350,
      },
    });
    cobroAlquilerAId = cobroAlquilerA.id;

    // ---- Modelo 3 (preventa) — módulo "proyectos" activo SOLO para A (override puntual, mismo mecanismo que usa Plataforma) ----
    const moduloProyectos = await prisma.modulo.upsert({
      where: { clave: 'proyectos' },
      update: {},
      create: { clave: 'proyectos', nombre: 'Proyectos (plugin)' },
    });
    await prisma.tenantModuloOverride.upsert({
      where: { tenantId_moduloId: { tenantId: tenantAId, moduloId: moduloProyectos.id } },
      update: { activo: true },
      create: { tenantId: tenantAId, moduloId: moduloProyectos.id, activo: true },
    });

    const propiedadPreventaA = await prisma.propiedad.create({
      data: {
        tenantId: tenantAId,
        codigo: 'PROP-A-PREVENTA',
        titulo: 'Torre en construcción de A',
        tipo: 'APARTAMENTO',
        operacion: 'VENTA',
        precio: 200000,
        ubicacion: 'Bella Vista, Santo Domingo',
      },
    });
    propiedadPreventaAId = propiedadPreventaA.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
    // onDelete: Cascade en Propiedad/ContratoPropiedad/AlertaBusquedaPropiedad
    // (vía Tenant) limpia todo lo demás; ContratoPropiedad no tiene cascada
    // desde Propiedad/Cliente a propósito (ver schema.prisma), pero sí desde Tenant.
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    await prisma.$disconnect();
  });

  describe('Admin — Propiedades', () => {
    it('el tenant A ve su propia propiedad', async () => {
      const token = await login('admin@e2e-inmo-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/admin/inmobiliaria/propiedades')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = respuesta.body.datos.map((p: { id: string }) => p.id);
      expect(ids).toContain(propiedadAId);
      expect(ids).not.toContain(propiedadBId);
    });

    it('el tenant B no ve la propiedad de A en el listado', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      const respuesta = await request(app.getHttpServer())
        .get('/api/admin/inmobiliaria/propiedades')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = respuesta.body.datos.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(propiedadAId);
    });

    it('el tenant B no puede leer la propiedad de A pidiéndola por id directo', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .get(`/api/admin/inmobiliaria/propiedades/${propiedadAId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('el tenant B no puede editar la propiedad de A (y no queda modificada)', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .patch(`/api/admin/inmobiliaria/propiedades/${propiedadAId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ titulo: 'Secuestrada por B' })
        .expect(404);

      const propiedad = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadAId } });
      expect(propiedad.titulo).toBe('Apartamento exclusivo de A');
    });

    it('el tenant B no puede eliminar la propiedad de A (y sigue existiendo)', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .delete(`/api/admin/inmobiliaria/propiedades/${propiedadAId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadAId } });
    });

    it('el tenant B no puede asignar como agente a un empleado de A (IDOR)', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .post('/api/admin/inmobiliaria/propiedades')
        .set('Authorization', `Bearer ${token}`)
        .send({
          codigo: 'PROP-B-IDOR',
          titulo: 'Intento de IDOR',
          tipo: 'CASA',
          operacion: 'VENTA',
          precio: 1000,
          ubicacion: 'Cualquier lugar',
          agenteId: agenteAId,
        })
        .expect(404);
    });

    it('el tenant B no ve al agente de A en "agentes disponibles"', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      const respuesta = await request(app.getHttpServer())
        .get('/api/admin/inmobiliaria/propiedades/agentes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = (respuesta.body as { id: string }[]).map((e) => e.id);
      expect(ids).not.toContain(agenteAId);
    });
  });

  describe('Admin — Contratos', () => {
    it('el tenant B no puede cerrar un negocio sobre la propiedad de A', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .post(`/api/admin/inmobiliaria/propiedades/${propiedadAId}/contratos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteBId, monto: 150000 })
        .expect(404);
    });

    it('el tenant A no puede cerrar un negocio usando un cliente del tenant B (IDOR)', async () => {
      const token = await login('admin@e2e-inmo-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post(`/api/admin/inmobiliaria/propiedades/${propiedadAId}/contratos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteBId, monto: 150000 })
        .expect(404);
    });

    it('el tenant A cierra el negocio con su propio cliente y queda con comisión calculada', async () => {
      const token = await login('admin@e2e-inmo-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post(`/api/admin/inmobiliaria/propiedades/${propiedadAId}/contratos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, monto: 150000, porcentajeComision: 5 })
        .expect(201);

      contratoAId = respuesta.body.id;
      expect(Number(respuesta.body.montoComision)).toBe(7500);

      const propiedad = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadAId } });
      expect(propiedad.estado).toBe('VENDIDA');
    });

    it('el tenant B no ve el contrato de A en el listado de contratos', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      const respuesta = await request(app.getHttpServer())
        .get('/api/admin/inmobiliaria/contratos')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = respuesta.body.datos.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(contratoAId);
    });

    it('el tenant B no puede leer el contrato de A por id directo', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .get(`/api/admin/inmobiliaria/contratos/${contratoAId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('el tenant B no puede anular el contrato de A (y sigue ACTIVO)', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .patch(`/api/admin/inmobiliaria/contratos/${contratoAId}/anular`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      const contrato = await prisma.contratoPropiedad.findUniqueOrThrow({ where: { id: contratoAId } });
      expect(contrato.estado).toBe('ACTIVO');
    });

    it('el tenant B no puede marcar como pagada la comisión del contrato de A', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .patch(`/api/admin/inmobiliaria/contratos/${contratoAId}/comision-pagada`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      const contrato = await prisma.contratoPropiedad.findUniqueOrThrow({ where: { id: contratoAId } });
      expect(contrato.comisionPagada).toBe(false);
    });
  });

  describe('Catálogo público', () => {
    it('responde 404 para un subdominio inexistente', async () => {
      await request(app.getHttpServer()).get('/api/inmobiliaria/e2e-no-existe/config').expect(404);
    });

    it('el catálogo del subdominio A no incluye la propiedad de B', async () => {
      const respuesta = await request(app.getHttpServer()).get(`/api/inmobiliaria/${SUBDOMINIO_A}/propiedades`).expect(200);

      const ids = respuesta.body.datos.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(propiedadBId);
    });

    it('el filtro ?ids= no permite traer una propiedad de otro tenant (regresión: ids es de cara pública, sin cuenta)', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(`/api/inmobiliaria/${SUBDOMINIO_A}/propiedades`)
        .query({ ids: propiedadBId })
        .expect(200);

      expect(respuesta.body.datos).toEqual([]);
      expect(respuesta.body.total).toBe(0);
    });

    it('la ficha pública de A por id devuelve 404 si se pide con el subdominio de B', async () => {
      await request(app.getHttpServer()).get(`/api/inmobiliaria/${SUBDOMINIO_B}/propiedades/${propiedadAId}`).expect(404);
    });

    it('la propiedad de A ya no aparece en su propio catálogo público tras venderse (solo ACTIVA es pública)', async () => {
      const respuesta = await request(app.getHttpServer()).get(`/api/inmobiliaria/${SUBDOMINIO_A}/propiedades`).expect(200);

      const ids = respuesta.body.datos.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(propiedadAId);
    });

    it('crea una alerta de búsqueda guardada quedando asociada al tenant correcto por subdominio', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(`/api/inmobiliaria/${SUBDOMINIO_B}/alertas`)
        .send({ email: 'interesado@e2e.com', operacion: 'ALQUILER' })
        .expect(201);

      const alerta = await prisma.alertaBusquedaPropiedad.findUniqueOrThrow({ where: { id: respuesta.body.id } });
      expect(alerta.tenantId).toBe(tenantBId);
    });
  });

  describe('Modelo 2 — Alquileres administrados', () => {
    it('el tenant A ve su propio cobro de alquiler', async () => {
      const token = await login('admin@e2e-inmo-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/admin/inmobiliaria/alquileres')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = respuesta.body.datos.map((c: { id: string }) => c.id);
      expect(ids).toContain(cobroAlquilerAId);
    });

    it('el tenant B no ve el cobro de alquiler de A en el listado', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      const respuesta = await request(app.getHttpServer())
        .get('/api/admin/inmobiliaria/alquileres')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = respuesta.body.datos.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(cobroAlquilerAId);
    });

    it('el tenant B no puede leer el cobro de A por id directo', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .get(`/api/admin/inmobiliaria/alquileres/${cobroAlquilerAId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('el tenant B no puede marcar cobrado el cobro de A (y sigue PENDIENTE)', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .patch(`/api/admin/inmobiliaria/alquileres/${cobroAlquilerAId}/cobrado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ generarFactura: false })
        .expect(404);

      const cobro = await prisma.cobroAlquiler.findUniqueOrThrow({ where: { id: cobroAlquilerAId } });
      expect(cobro.estado).toBe('PENDIENTE');
    });

    it('el tenant B no puede liquidar el cobro de A', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .patch(`/api/admin/inmobiliaria/alquileres/${cobroAlquilerAId}/liquidar`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('el tenant B no puede activar/tocar la administración de alquiler del contrato de A', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .patch(`/api/admin/inmobiliaria/contratos/${contratoAlquilerAId}/administracion-alquiler`)
        .set('Authorization', `Bearer ${token}`)
        .send({ porcentajeComisionAdministracion: 50 })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/api/admin/inmobiliaria/contratos/${contratoAlquilerAId}/administracion-alquiler`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      const contrato = await prisma.contratoPropiedad.findUniqueOrThrow({ where: { id: contratoAlquilerAId } });
      expect(contrato.administracionActiva).toBe(true);
      expect(Number(contrato.porcentajeComisionAdministracion)).toBe(10);
    });
  });

  describe('Modelo 3 — Preventa', () => {
    it('el tenant B (sin el módulo Proyectos activo) no puede iniciar una preventa, ni siquiera sobre su propia propiedad', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      const respuesta = await request(app.getHttpServer())
        .post(`/api/admin/inmobiliaria/propiedades/${propiedadBId}/preventa`)
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteBId })
        .expect(400);

      expect(respuesta.body.message).toContain('módulo de Proyectos');
    });

    it('el tenant B no puede iniciar una preventa sobre la propiedad de A', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      // Rechaza en el guard de módulo (B no tiene "proyectos" activo) antes
      // de siquiera resolver la propiedad — igual, nunca debe crear nada.
      await request(app.getHttpServer())
        .post(`/api/admin/inmobiliaria/propiedades/${propiedadPreventaAId}/preventa`)
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteBId })
        .expect(400);

      const propiedad = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadPreventaAId } });
      expect(propiedad.proyectoPreventaId).toBeNull();
    });

    let proyectoPreventaId: string;

    it('el tenant A (con Proyectos activo) inicia la preventa: crea el Proyecto y la propiedad queda RESERVADA', async () => {
      const token = await login('admin@e2e-inmo-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post(`/api/admin/inmobiliaria/propiedades/${propiedadPreventaAId}/preventa`)
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId })
        .expect(201);

      proyectoPreventaId = respuesta.body.id;

      const proyecto = await prisma.proyecto.findUniqueOrThrow({ where: { id: proyectoPreventaId } });
      expect(proyecto.tenantId).toBe(tenantAId);
      expect(proyecto.modoFacturacion).toBe('PRECIO_FIJO');

      const propiedad = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadPreventaAId } });
      expect(propiedad.proyectoPreventaId).toBe(proyectoPreventaId);
      expect(propiedad.estado).toBe('RESERVADA');
    });

    it('el tenant B no puede desvincular la preventa de la propiedad de A (y sigue vinculada)', async () => {
      const token = await login('admin@e2e-inmo-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .delete(`/api/admin/inmobiliaria/propiedades/${propiedadPreventaAId}/preventa`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      const propiedad = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadPreventaAId } });
      expect(propiedad.proyectoPreventaId).toBe(proyectoPreventaId);
    });
  });
});
