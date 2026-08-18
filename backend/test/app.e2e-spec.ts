import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { EmailChannel } from '../src/notificaciones/canales/email.channel';
import { CUENTAS_BASE } from '../src/contabilidad/cuentas-base';
import { MODULOS_BASE } from '../src/tenants/modulos-base';

function extraerTokenDeReset(cuerpoHtml: string): string {
  const href = cuerpoHtml.match(/href="([^"]+)"/)?.[1];
  if (!href) throw new Error('El correo de reset no contenía un link');
  return new URL(href).searchParams.get('token')!;
}

/**
 * Cubre el aislamiento real por tenant (regresión del bug encontrado en
 * TenantPrismaService: tenantId capturado antes de que el guard poblara
 * request.user), el enforcement de permisos, y el flujo de facturación
 * (NCF + ITBIS + descuento de stock) de punta a punta contra Postgres.
 */
describe('App (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const SUBDOMINIO_A = 'e2e-tenant-a';
  const SUBDOMINIO_B = 'e2e-tenant-b';
  const PASSWORD = 'Test1234!';

  let tenantAId: string;
  let tenantBId: string;
  let clienteAId: string;
  let productoAId: string;
  let bodegaAId: string;

  async function crearPermisos(claves: string[]) {
    for (const clave of claves) {
      // Permission es global (sin tenantId) y este archivo corre en paralelo
      // con platform.e2e-spec.ts, que siembra el mismo catálogo — si ambos
      // procesos insertan una clave nueva a la vez, uno de los dos puede
      // perder la carrera contra el propio upsert del otro (P2002). Eso ya
      // significa que la clave existe, que es justo la postcondición que
      // upsert busca garantizar, así que se ignora.
      await prisma.permission.upsert({ where: { clave }, update: {}, create: { clave } }).catch((error) => {
        if (error?.code !== 'P2002') throw error;
      });
    }
  }

  // Cacheado para que las dos veces que se llama a crearTenantConUsuario
  // (tenant A y B) reutilicen el mismo Plan en vez de crear uno cada vez —
  // ModuloActivoGuard (global) deniega TODO módulo gateable a un tenant sin
  // plan asignado, así que los fixtures de este archivo (que ejercitan
  // Facturación/Compras/POS/Nómina/etc. de punta a punta) necesitan un plan
  // con el catálogo completo, no el flujo real de "elegir un plan chico".
  let planTodoIncluidoId: string | undefined;
  async function idPlanTodoIncluido(): Promise<string> {
    if (planTodoIncluidoId) return planTodoIncluidoId;
    for (const modulo of MODULOS_BASE) {
      await prisma.modulo.upsert({ where: { clave: modulo.clave }, update: {}, create: { clave: modulo.clave, nombre: modulo.nombre } });
    }
    const modulos = await prisma.modulo.findMany();
    const plan = await prisma.plan.upsert({
      where: { nombre: 'E2E Todo Incluido' },
      update: {},
      create: { nombre: 'E2E Todo Incluido' },
    });
    await prisma.planModulo.deleteMany({ where: { planId: plan.id } });
    await prisma.planModulo.createMany({ data: modulos.map((m) => ({ planId: plan.id, moduloId: m.id })) });
    planTodoIncluidoId = plan.id;
    return plan.id;
  }

  async function crearTenantConUsuario(params: {
    subdominio: string;
    nombreRol: string;
    permisos: string[];
    email: string;
  }) {
    const tenant = await prisma.tenant.create({
      data: { nombre: `E2E ${params.subdominio}`, subdominio: params.subdominio, planId: await idPlanTodoIncluido() },
    });
    const rol = await prisma.role.create({
      data: { tenantId: tenant.id, nombre: params.nombreRol },
    });
    for (const clave of params.permisos) {
      const permiso = await prisma.permission.findUniqueOrThrow({ where: { clave } });
      await prisma.rolePermission.create({ data: { roleId: rol.id, permissionId: permiso.id } });
    }
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const usuario = await prisma.user.create({
      data: { tenantId: tenant.id, email: params.email, nombre: params.email, passwordHash },
    });
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

    // Limpia los contadores del rate-limiter (Redis real, persistente entre
    // corridas) para que intentos manuales/de una corrida previa dentro de
    // la misma hora no hagan fallar los tests de "olvidé mi contraseña" con 429.
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
    await redis.flushdb();
    await redis.quit();

    await crearPermisos([
      'clientes.crear',
      'clientes.ver',
      'facturacion.crear',
      'facturacion.ver',
      'facturacion.anular',
      'facturacion.cobrar',
      'facturacion.imprimir',
      'cotizaciones.crear',
      'cotizaciones.editar',
      'cotizaciones.ver',
      'remisiones.crear',
      'remisiones.editar',
      'remisiones.ver',
      'contabilidad.ver',
      'contabilidad.editar',
      'contabilidad.anular',
      'contabilidad.cerrarperiodo',
      'contabilidad.conciliar',
      'nomina.ver',
      'nomina.editar',
      'pos.ver',
      'pos.editar',
      'pos.supervisar',
      'ia.usar',
      'notificaciones.ver',
      'inventario.ver',
      'inventario.ajustar',
      'inventario.transferir',
      'precios.ver',
      'precios.editar',
      'compras.crear',
      'compras.recibir',
      'compras.ver',
      'reportes.ver',
      'bancos.ver',
      'bancos.editar',
      'gastosmenores.ver',
      'gastosmenores.crear',
    ]);

    const tenantA = await crearTenantConUsuario({
      subdominio: SUBDOMINIO_A,
      nombreRol: 'CompletoA',
      permisos: [
        'clientes.crear', 'clientes.ver', 'facturacion.crear', 'facturacion.ver', 'facturacion.anular', 'facturacion.cobrar', 'facturacion.imprimir',
        'cotizaciones.crear', 'cotizaciones.editar', 'cotizaciones.ver',
        'remisiones.crear', 'remisiones.editar', 'remisiones.ver',
        'contabilidad.ver', 'contabilidad.editar', 'contabilidad.anular', 'contabilidad.cerrarperiodo', 'contabilidad.conciliar',
        'bancos.ver', 'bancos.editar',
        'gastosmenores.ver', 'gastosmenores.crear',
        'nomina.ver', 'nomina.editar',
        'pos.ver', 'pos.editar', 'pos.supervisar',
        'ia.usar',
        'notificaciones.ver',
        'compras.crear', 'compras.recibir', 'compras.pagar', 'compras.ver',
        'precios.ver', 'precios.editar',
        'reportes.ver',
        'admin.configuracion', 'admin.usuarios',
      ],
      email: 'admin@e2e-a.com',
    });
    tenantAId = tenantA.id;
    await prisma.cuentaContable.createMany({
      data: CUENTAS_BASE.map((c) => ({ tenantId: tenantAId, codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, naturaleza: c.naturaleza })),
    });

    const tenantB = await crearTenantConUsuario({
      subdominio: SUBDOMINIO_B,
      nombreRol: 'CompletoB',
      permisos: [
        'clientes.crear', 'clientes.ver', 'facturacion.crear', 'facturacion.ver', 'nomina.ver', 'pos.ver',
        'inventario.ver', 'inventario.ajustar', 'inventario.transferir', 'precios.ver', 'precios.editar',
        'admin.configuracion', 'contabilidad.ver', 'contabilidad.conciliar',
      ],
      email: 'admin@e2e-b.com',
    });
    tenantBId = tenantB.id;

    // Usuario de tenant A con un rol que NO tiene clientes.crear (para probar 403).
    const rolSoloLectura = await prisma.role.create({
      data: { tenantId: tenantAId, nombre: 'SoloLecturaA' },
    });
    const permisoVer = await prisma.permission.findUniqueOrThrow({ where: { clave: 'clientes.ver' } });
    await prisma.rolePermission.create({ data: { roleId: rolSoloLectura.id, permissionId: permisoVer.id } });
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const usuarioSoloLectura = await prisma.user.create({
      data: { tenantId: tenantAId, email: 'lectura@e2e-a.com', nombre: 'Solo Lectura', passwordHash },
    });
    await prisma.userRole.create({ data: { userId: usuarioSoloLectura.id, roleId: rolSoloLectura.id } });

    // Cliente que pertenece SOLO al tenant A.
    const cliente = await prisma.cliente.create({
      data: { tenantId: tenantAId, nombre: 'Cliente exclusivo de A' },
    });
    clienteAId = cliente.id;

    // Fixtures para el flujo de facturación del tenant A.
    const bodega = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega E2E' } });
    bodegaAId = bodega.id;
    const producto = await prisma.producto.create({
      data: { tenantId: tenantAId, codigo: 'E2E-001', nombre: 'Producto E2E', porcentajeItbis: 18 },
    });
    productoAId = producto.id;
    await prisma.precio.create({
      data: { productoId: producto.id, listaPrecio: 'GENERAL', costo: 50, margenPct: 100, precioVenta: 100 },
    });
    await prisma.stock.create({
      data: { productoId: producto.id, bodegaId: bodega.id, cantidadActual: 20, stockMinimo: 5 },
    });
    const unAnio = new Date();
    unAnio.setFullYear(unAnio.getFullYear() + 1);
    await prisma.ncfAsignado.create({
      data: { tenantId: tenantAId, tipoNcf: 'B02', secuenciaActual: 1, secuenciaFinal: 1000, vigenciaHasta: unAnio },
    });
    await prisma.ncfAsignado.create({
      data: { tenantId: tenantAId, tipoNcf: 'B11', secuenciaActual: 1, secuenciaFinal: 1000, vigenciaHasta: unAnio },
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
    // onDelete: Cascade en todas las tablas tenant-scoped limpia todo lo demás.
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    await prisma.$disconnect();
  });

  describe('Auth', () => {
    it('rechaza credenciales inválidas', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@e2e-a.com', password: 'incorrecta', tenantSubdominio: SUBDOMINIO_A })
        .expect(401);
    });

    it('rechaza un tenantSubdominio inexistente', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@e2e-a.com', password: PASSWORD, tenantSubdominio: 'no-existe' })
        .expect(401);
    });

    it('acepta credenciales válidas y devuelve un accessToken', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@e2e-a.com', password: PASSWORD, tenantSubdominio: SUBDOMINIO_A })
        .expect(201);

      expect(respuesta.body.accessToken).toEqual(expect.any(String));
      expect(respuesta.body.usuario.email).toBe('admin@e2e-a.com');
    });

    it('el login expone los permisos aplanados del rol (para que el frontend pueda ocultar rutas/botones)', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'lectura@e2e-a.com', password: PASSWORD, tenantSubdominio: SUBDOMINIO_A })
        .expect(201);

      // El rol "SoloLecturaA" (ver beforeAll) solo tiene clientes.ver.
      expect(respuesta.body.usuario.permisos).toEqual(['clientes.ver']);
    });

    it('el login expone también el subdominio y nombre del tenant', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@e2e-a.com', password: PASSWORD, tenantSubdominio: SUBDOMINIO_A })
        .expect(201);

      expect(respuesta.body.usuario.tenant).toEqual({ subdominio: SUBDOMINIO_A, nombre: `E2E ${SUBDOMINIO_A}` });
    });

    it('resolver-empresas devuelve la empresa de un email conocido', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/resolver-empresas')
        .send({ email: 'admin@e2e-a.com' })
        .expect(201);

      expect(respuesta.body.empresas).toEqual([{ subdominio: SUBDOMINIO_A, nombre: `E2E ${SUBDOMINIO_A}` }]);
    });

    it('resolver-empresas devuelve una lista vacía para un email desconocido, sin filtrar información', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/resolver-empresas')
        .send({ email: 'no-existe@e2e.com' })
        .expect(201);

      expect(respuesta.body.empresas).toEqual([]);
    });
  });

  describe('Aislamiento de tenant', () => {
    it('el tenant A ve su propio cliente', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/clientes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.datos).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: clienteAId, nombre: 'Cliente exclusivo de A' })]),
      );
    });

    it('el tenant B NO ve el cliente del tenant A (regresión del bug de tenantId)', async () => {
      const token = await login('admin@e2e-b.com', SUBDOMINIO_B);

      const respuesta = await request(app.getHttpServer())
        .get('/api/clientes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = respuesta.body.datos.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(clienteAId);
    });

    it('el tenant B no puede leer el cliente de A ni siquiera pidiéndolo por id directo', async () => {
      const token = await login('admin@e2e-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .get(`/api/clientes/${clienteAId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    // Stock y Precio no tienen columna tenantId propia (dependen de Bodega/
    // Producto) — regresión del IDOR donde cualquier bodegaId/productoId
    // adivinado de otro tenant filtraba/permitía corromper sus datos.
    it('el tenant B no puede leer el stock de la bodega de A pidiéndolo por id directo', async () => {
      const token = await login('admin@e2e-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .get(`/api/inventario/stock/${bodegaAId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('el tenant B no puede ajustar stock en la bodega/producto de A', async () => {
      const token = await login('admin@e2e-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .post('/api/inventario/ajustar')
        .set('Authorization', `Bearer ${token}`)
        .send({ productoId: productoAId, bodegaId: bodegaAId, cantidad: 1000, motivo: 'Intento de corrupción cross-tenant' })
        .expect(404);
    });

    it('el tenant B no puede leer ni crear precios para el producto de A', async () => {
      const token = await login('admin@e2e-b.com', SUBDOMINIO_B);

      await request(app.getHttpServer())
        .get(`/api/precios/${productoAId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      await request(app.getHttpServer())
        .post('/api/precios')
        .set('Authorization', `Bearer ${token}`)
        .send({ productoId: productoAId, costo: 1, margenPct: 1 })
        .expect(404);
    });
  });

  describe('Permisos', () => {
    it('403 si al usuario le falta el permiso requerido por el endpoint', async () => {
      const token = await login('lectura@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/clientes')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Intento sin permiso', tipo: 'PERSONA_FISICA' })
        .expect(403);
    });

    it('401 sin token', async () => {
      await request(app.getHttpServer()).get('/api/clientes').expect(401);
    });
  });

  describe('Roles y permisos personalizados', () => {
    it('crea un rol personalizado con un subconjunto de permisos y lo puede asignar a un usuario', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const rol = await request(app.getHttpServer())
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Supervisor Sucursal E2E', descripcion: 'Solo inventario', permisos: ['inventario.ver', 'inventario.ajustar'] })
        .expect(201);

      expect(rol.body.esSistema).toBe(false);
      expect(rol.body.rolePermissions).toHaveLength(2);

      const usuario = await request(app.getHttpServer())
        .post('/api/admin/usuarios')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'supervisor-e2e@example.com', nombre: 'Supervisor E2E', password: PASSWORD, rolIds: [rol.body.id] })
        .expect(201);

      const tokenSupervisor = await login('supervisor-e2e@example.com', SUBDOMINIO_A);
      await request(app.getHttpServer())
        .get('/api/inventario/bodegas')
        .set('Authorization', `Bearer ${tokenSupervisor}`)
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/clientes')
        .set('Authorization', `Bearer ${tokenSupervisor}`)
        .expect(403);

      expect(usuario.body.roles[0].role.nombre).toBe('Supervisor Sucursal E2E');
    });

    it('permite editar los permisos de un rol existente (reemplazo completo)', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const rol = await request(app.getHttpServer())
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Rol Editable E2E', permisos: ['inventario.ver'] })
        .expect(201);

      const editado = await request(app.getHttpServer())
        .patch(`/api/admin/roles/${rol.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ permisos: ['reportes.ver'] })
        .expect(200);

      expect(editado.body.rolePermissions).toHaveLength(1);
      expect(editado.body.rolePermissions[0].permission.clave).toBe('reportes.ver');
    });

    it('rechaza eliminar un rol del sistema (esSistema)', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      // El fixture de este archivo (`crearTenantConUsuario`) crea un único
      // rol no-sistema para el tenant de prueba — se marca uno como
      // esSistema directamente para poder probar la protección.
      const rolSistema = await prisma.role.create({
        data: { tenantId: tenantAId, nombre: 'Rol Sistema E2E', esSistema: true },
      });

      await request(app.getHttpServer())
        .delete(`/api/admin/roles/${rolSistema.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('rechaza eliminar un rol personalizado que tiene usuarios asignados, y permite eliminarlo tras reasignarlos', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const roles = await request(app.getHttpServer())
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const rolExistente = roles.body.find((r: { nombre: string }) => r.nombre === 'CompletoA');

      const rol = await request(app.getHttpServer())
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Rol Con Usuario E2E', permisos: ['inventario.ver'] })
        .expect(201);

      const usuario = await request(app.getHttpServer())
        .post('/api/admin/usuarios')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'con-rol-e2e@example.com', nombre: 'Con Rol E2E', password: PASSWORD, rolIds: [rol.body.id] })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/admin/roles/${rol.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      // No se puede vaciar rolIds a [] (ArrayMinSize(1) en el DTO) — hay que
      // reasignar el usuario a otro rol existente en vez de dejarlo sin ninguno.
      await request(app.getHttpServer())
        .patch(`/api/admin/usuarios/${usuario.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rolIds: [rolExistente.id] })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/admin/roles/${rol.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('Webhooks', () => {
    it('crea un webhook, lo lista, y ve su historial de entregas vacío', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const webhook = await request(app.getHttpServer())
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://example.com/hook-e2e', eventos: ['factura.creada'] })
        .expect(201);

      expect(webhook.body.secret).toBeTruthy();

      const listado = await request(app.getHttpServer())
        .get('/api/webhooks')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(listado.body.some((w: { id: string }) => w.id === webhook.body.id)).toBe(true);

      const entregas = await request(app.getHttpServer())
        .get(`/api/webhooks/${webhook.body.id}/deliveries`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(entregas.body).toEqual({ datos: [], total: 0, pagina: 1, tamanoPagina: 20 });

      await request(app.getHttpServer())
        .delete(`/api/webhooks/${webhook.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('rechaza una URL que no sea http/https válida', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'no-es-una-url', eventos: ['factura.creada'] })
        .expect(400);
    });

    it('el tenant B no puede ver el historial de entregas de un webhook del tenant A (aislamiento)', async () => {
      const tokenA = await login('admin@e2e-a.com', SUBDOMINIO_A);
      const tokenB = await login('admin@e2e-b.com', SUBDOMINIO_B);

      const webhook = await request(app.getHttpServer())
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ url: 'https://example.com/hook-aislamiento-e2e', eventos: ['factura.creada'] })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/webhooks/${webhook.body.id}/deliveries`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);

      // Se elimina de inmediato: si quedara activo, cada factura creada por
      // el resto de la suite dispararía un despacho real (con reintentos y
      // backoff de hasta ~10s) contra example.com, aunque no afecte el
      // resultado de ningún test — solo ensucia el log y alenta la corrida.
      await request(app.getHttpServer())
        .delete(`/api/webhooks/${webhook.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
    });
  });

  describe('Notificaciones', () => {
    it('un usuario con permiso puede listar las notificaciones del tenant', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .get('/api/notificaciones')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('notificaciones.ver es obligatorio (regresión: antes este endpoint no exigía ningún permiso)', async () => {
      const token = await login('lectura@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .get('/api/notificaciones')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('permite crear y desactivar una plantilla (el upsert respeta el campo activa en updates)', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/notificaciones/plantillas')
        .set('Authorization', `Bearer ${token}`)
        .send({ canal: 'EMAIL', clave: 'e2e_prueba', asunto: 'Hola {{cliente_nombre}}', cuerpo: 'Cuerpo {{cliente_nombre}}' })
        .expect(201);

      const listado1 = await request(app.getHttpServer())
        .get('/api/notificaciones/plantillas')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const plantilla = listado1.body.find((p: { clave: string }) => p.clave === 'e2e_prueba');
      expect(plantilla.activa).toBe(true);

      await request(app.getHttpServer())
        .post('/api/notificaciones/plantillas')
        .set('Authorization', `Bearer ${token}`)
        .send({ canal: 'EMAIL', clave: 'e2e_prueba', asunto: 'Hola', cuerpo: 'Cuerpo', activa: false })
        .expect(201);

      const listado2 = await request(app.getHttpServer())
        .get('/api/notificaciones/plantillas')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(listado2.body.find((p: { clave: string }) => p.clave === 'e2e_prueba').activa).toBe(false);
    });

    it('admin.configuracion es obligatorio para gestionar plantillas', async () => {
      const token = await login('lectura@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .get('/api/notificaciones/plantillas')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Flujo de facturación', () => {
    it('crea una factura con NCF asignado, ITBIS calculado y descuenta el stock', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/facturas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clienteId: clienteAId,
          bodegaId: bodegaAId,
          tipoFactura: 'CONTADO',
          lineas: [{ productoId: productoAId, cantidad: 3 }],
        })
        .expect(201);

      expect(respuesta.body.ncf).toBe('B0200000001');
      expect(respuesta.body.tipoNcf).toBe('B02');
      // 3 * 100 = 300 subtotal; 18% itbis = 54; total 354
      expect(Number(respuesta.body.subtotal)).toBe(300);
      expect(Number(respuesta.body.itbis)).toBe(54);
      expect(Number(respuesta.body.total)).toBe(354);

      const stock = await prisma.stock.findUniqueOrThrow({
        where: { productoId_bodegaId: { productoId: productoAId, bodegaId: bodegaAId } },
      });
      expect(Number(stock.cantidadActual)).toBe(17); // 20 - 3
    });

    it('rechaza la venta si no hay stock suficiente', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/facturas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clienteId: clienteAId,
          bodegaId: bodegaAId,
          tipoFactura: 'CONTADO',
          lineas: [{ productoId: productoAId, cantidad: 9999 }],
        })
        .expect(400);
    });
  });

  describe('Impresión multi-formato', () => {
    // Un solo login reusado en todo el bloque, Y un flushdb extra acá mismo:
    // /auth/login no tiene @Throttle propio (hereda el default global,
    // 120/60s) y este archivo ya hace ~114 llamadas a login() en total —
    // ese conteo acumulado deja a los describe blocks de MÁS ADELANTE sin
    // margen (un login de cualquier bloque anterior alcanza a tumbar un
    // token de un bloque posterior con 401, ya que comparten el mismo
    // bucket por IP). Mismo criterio que el flushdb del beforeAll de todo
    // el archivo, solo que repetido acá para darle presupuesto fresco al
    // resto del archivo que corre después de este bloque.
    let token: string;
    let facturaImpresionId: string;

    beforeAll(async () => {
      const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
      await redis.flushdb();
      await redis.quit();

      token = await login('admin@e2e-a.com', SUBDOMINIO_A);
      const respuesta = await request(app.getHttpServer())
        .post('/api/facturas')
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, bodegaId: bodegaAId, tipoFactura: 'CONTADO', lineas: [{ productoId: productoAId, cantidad: 1 }] })
        .expect(201);
      facturaImpresionId = respuesta.body.id;
    });

    afterAll(async () => {
      // Revertir el default de tenant y el override de bodega para no
      // afectar otros describe blocks de este mismo archivo.
      await prisma.configuracion.deleteMany({ where: { tenantId: tenantAId, clave: 'FORMATO_IMPRESION_DEFAULT' } });
      await prisma.bodega.update({ where: { id: bodegaAId }, data: { formatoImpresion: null } });
    });

    it('sin ninguna configuración, /imprimir devuelve un PDF (fallback CARTA)', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(`/api/facturas/${facturaImpresionId}/imprimir`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.headers['content-type']).toBe('application/pdf');
    });

    it('con el default de tenant en térmica, /imprimir sin formato devuelve HTML', async () => {
      await request(app.getHttpServer())
        .put('/api/admin/configuraciones/FORMATO_IMPRESION_DEFAULT')
        .set('Authorization', `Bearer ${token}`)
        .send({ valor: 'TERMICA_80MM' })
        .expect(200);

      const respuesta = await request(app.getHttpServer())
        .get(`/api/facturas/${facturaImpresionId}/imprimir`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.headers['content-type']).toContain('text/html');
      expect(respuesta.text).toContain('80mm auto');
    });

    it('un ?formato= explícito manda sobre el default guardado', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(`/api/facturas/${facturaImpresionId}/imprimir`)
        .query({ formato: 'CARTA' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.headers['content-type']).toBe('application/pdf');
    });

    it('el override de bodega manda sobre el default de tenant', async () => {
      await request(app.getHttpServer())
        .patch(`/api/inventario/bodegas/${bodegaAId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ formatoImpresion: 'TERMICA_58MM' })
        .expect(200);

      const respuesta = await request(app.getHttpServer())
        .get(`/api/facturas/${facturaImpresionId}/imprimir`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.headers['content-type']).toContain('text/html');
      expect(respuesta.text).toContain('58mm auto');
    });

    it('un tenant no puede anular el override de formato de una bodega de otro tenant', async () => {
      const bodegaTenantB = await prisma.bodega.create({ data: { tenantId: tenantBId, nombre: 'Bodega B — impresión' } });

      // El PATCH "funciona" (200) porque TenantPrismaService inyecta el
      // tenantId de quien llama en el `where` — el resultado real es que
      // no encuentra la fila (pertenece a otro tenant) y Prisma lanza
      // "Record not found", que el filtro de excepciones traduce a 404/400.
      await request(app.getHttpServer())
        .patch(`/api/inventario/bodegas/${bodegaTenantB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ formatoImpresion: 'TERMICA_58MM' })
        .expect((res) => expect(res.status).toBeGreaterThanOrEqual(400));

      const bodegaSinTocar = await prisma.bodega.findUniqueOrThrow({ where: { id: bodegaTenantB.id } });
      expect(bodegaSinTocar.formatoImpresion).toBeNull();
    });
  });

  describe('Producto tipo Servicio/Combo', () => {
    let componenteXId: string;
    let componenteYId: string;
    let comboId: string;
    let servicioId: string;

    beforeAll(async () => {
      const componenteX = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-COMP-X', nombre: 'Componente X', porcentajeItbis: 18 },
      });
      componenteXId = componenteX.id;
      await prisma.stock.create({ data: { productoId: componenteXId, bodegaId: bodegaAId, cantidadActual: 100, stockMinimo: 5 } });

      const componenteY = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-COMP-Y', nombre: 'Componente Y', porcentajeItbis: 18 },
      });
      componenteYId = componenteY.id;
      await prisma.stock.create({ data: { productoId: componenteYId, bodegaId: bodegaAId, cantidadActual: 100, stockMinimo: 5 } });

      const combo = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-COMBO', nombre: 'Combo E2E', porcentajeItbis: 18, tipo: 'COMBO' },
      });
      comboId = combo.id;
      await prisma.precio.create({
        data: { productoId: comboId, listaPrecio: 'GENERAL', costo: 100, margenPct: 100, precioVenta: 200 },
      });
      await prisma.componenteCombo.createMany({
        data: [
          { comboId, componenteId: componenteXId, cantidad: 2 },
          { comboId, componenteId: componenteYId, cantidad: 1 },
        ],
      });

      const servicio = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-SERVICIO', nombre: 'Servicio E2E', porcentajeItbis: 18, tipo: 'SERVICIO' },
      });
      servicioId = servicio.id;
      await prisma.precio.create({
        data: { productoId: servicioId, listaPrecio: 'GENERAL', costo: 0, margenPct: 100, precioVenta: 500 },
      });
    });

    it('facturar un SERVICIO no toca inventario (no tiene fila en Stock)', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/facturas')
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, bodegaId: bodegaAId, tipoFactura: 'CONTADO', lineas: [{ productoId: servicioId, cantidad: 1 }] })
        .expect(201);

      const stock = await prisma.stock.findUnique({ where: { productoId_bodegaId: { productoId: servicioId, bodegaId: bodegaAId } } });
      expect(stock).toBeNull();
    });

    it('facturar un COMBO descuenta stock de cada componente (cantidad de la línea × cantidad del componente), nunca del combo', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const factura = await request(app.getHttpServer())
        .post('/api/facturas')
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, bodegaId: bodegaAId, tipoFactura: 'CONTADO', lineas: [{ productoId: comboId, cantidad: 3 }] })
        .expect(201);

      const stockX = await prisma.stock.findUniqueOrThrow({ where: { productoId_bodegaId: { productoId: componenteXId, bodegaId: bodegaAId } } });
      const stockY = await prisma.stock.findUniqueOrThrow({ where: { productoId_bodegaId: { productoId: componenteYId, bodegaId: bodegaAId } } });
      expect(Number(stockX.cantidadActual)).toBe(94); // 100 - 3*2
      expect(Number(stockY.cantidadActual)).toBe(97); // 100 - 3*1
      const stockCombo = await prisma.stock.findUnique({ where: { productoId_bodegaId: { productoId: comboId, bodegaId: bodegaAId } } });
      expect(stockCombo).toBeNull();

      // Anular la factura reintegra el stock de cada componente.
      await request(app.getHttpServer())
        .post(`/api/facturas/${factura.body.id}/anular`)
        .set('Authorization', `Bearer ${token}`)
        .send({ motivo: 'Reversa de prueba e2e' })
        .expect(201);

      const stockXTrasAnular = await prisma.stock.findUniqueOrThrow({ where: { productoId_bodegaId: { productoId: componenteXId, bodegaId: bodegaAId } } });
      const stockYTrasAnular = await prisma.stock.findUniqueOrThrow({ where: { productoId_bodegaId: { productoId: componenteYId, bodegaId: bodegaAId } } });
      expect(Number(stockXTrasAnular.cantidadActual)).toBe(100);
      expect(Number(stockYTrasAnular.cantidadActual)).toBe(100);
    });
  });

  describe('Reportes', () => {
    it('el dashboard refleja la factura creada más arriba', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/reportes/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.facturasHoyCantidad).toBeGreaterThanOrEqual(1);
      expect(respuesta.body.ventasHoyTotal).toBeGreaterThanOrEqual(354);
    });

    it('el reporte de ventas incluye la factura y su resumen suma correctamente', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/reportes/ventas')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.facturas.length).toBeGreaterThanOrEqual(1);
      expect(respuesta.body.resumen.total).toBeGreaterThanOrEqual(354);
    });

    it('exportar ventas a xlsx devuelve un binario real, no JSON', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/reportes/ventas/exportar')
        .query({ formato: 'xlsx' })
        .set('Authorization', `Bearer ${token}`)
        .buffer() // el MIME de xlsx no es uno que supertest bufferice por defecto
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(respuesta.headers['content-type']).toContain('spreadsheet');
      expect(respuesta.headers['content-disposition']).toContain('reporte-ventas.xlsx');
      expect((respuesta.body as Buffer).length).toBeGreaterThan(100);
    });

    it('exportar inventario a pdf devuelve un PDF real', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/reportes/inventario/exportar')
        .query({ formato: 'pdf' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.headers['content-type']).toBe('application/pdf');
      const buffer = respuesta.body as Buffer;
      expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('reportes.ver es obligatorio: el usuario de solo-lectura de clientes no puede ver reportes', async () => {
      const token = await login('lectura@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .get('/api/reportes/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Reportes fiscales DGII', () => {
    it('607 incluye la factura del flujo de facturación con su NCF y monto', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/reportes-fiscales/607')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.filas).toEqual(
        expect.arrayContaining([expect.objectContaining({ ncf: 'B0200000001', montoFacturado: 300, itbisFacturado: 54 })]),
      );
    });

    it('607/exportar en txt devuelve pipes delimitados con fecha AAAAMMDD', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/reportes-fiscales/607/exportar')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.headers['content-type']).toContain('text/plain');
      expect(respuesta.headers['content-disposition']).toContain('DGII_607.txt');
      const lineas = (respuesta.text as string).split('\r\n');
      expect(lineas.some((l) => l.includes('B0200000001') && /\|\d{8}\|/.test(l))).toBe(true);
    });

    it('itbis-resumen calcula el neto de ventas menos compras', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/reportes-fiscales/itbis-resumen')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.itbisEnVentas).toBeGreaterThanOrEqual(54);
      expect(respuesta.body.itbisNetoAPagar).toBe(respuesta.body.itbisEnVentas - respuesta.body.itbisEnCompras);
    });

    it('it-1 clasifica el neto de itbis-resumen como a pagar o a favor', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const [resumen, it1] = await Promise.all([
        request(app.getHttpServer()).get('/api/reportes-fiscales/itbis-resumen').set('Authorization', `Bearer ${token}`).expect(200),
        request(app.getHttpServer()).get('/api/reportes-fiscales/it-1').set('Authorization', `Bearer ${token}`).expect(200),
      ]);

      expect(it1.body.itbisEnVentas).toBe(resumen.body.itbisEnVentas);
      expect(it1.body.itbisEnCompras).toBe(resumen.body.itbisEnCompras);
      if (resumen.body.itbisNetoAPagar >= 0) {
        expect(it1.body.itbisAPagar).toBe(resumen.body.itbisNetoAPagar);
        expect(it1.body.itbisSaldoAFavor).toBe(0);
      } else {
        expect(it1.body.itbisSaldoAFavor).toBe(-resumen.body.itbisNetoAPagar);
        expect(it1.body.itbisAPagar).toBe(0);
      }
    });

    it('reportes.ver es obligatorio para los reportes fiscales', async () => {
      const token = await login('lectura@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .get('/api/reportes-fiscales/607')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Notas de crédito/débito y anulación', () => {
    // Bodega/producto propios (no productoAId/bodegaAId) para no interferir
    // con los totales que ya verificó el describe "Reportes" más arriba.
    let bodegaNotasId: string;
    let productoNotasId: string;
    let facturaContadoId: string;

    beforeAll(async () => {
      const bodega = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega Notas E2E' } });
      bodegaNotasId = bodega.id;
      const producto = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-NOTAS', nombre: 'Producto Notas E2E', porcentajeItbis: 18 },
      });
      productoNotasId = producto.id;
      await prisma.precio.create({
        data: { productoId: producto.id, listaPrecio: 'GENERAL', costo: 50, margenPct: 100, precioVenta: 100 },
      });
      await prisma.stock.create({
        data: { productoId: producto.id, bodegaId: bodega.id, cantidadActual: 20, stockMinimo: 5 },
      });
      const unAnio = new Date();
      unAnio.setFullYear(unAnio.getFullYear() + 1);
      await prisma.ncfAsignado.create({
        data: { tenantId: tenantAId, tipoNcf: 'B01', secuenciaActual: 1, secuenciaFinal: 1000, vigenciaHasta: unAnio },
      });
      await prisma.ncfAsignado.create({
        data: { tenantId: tenantAId, tipoNcf: 'B04', secuenciaActual: 1, secuenciaFinal: 1000, vigenciaHasta: unAnio },
      });
    });

    it('crea la venta original', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/facturas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clienteId: clienteAId,
          bodegaId: bodegaNotasId,
          tipoFactura: 'CONTADO',
          lineas: [{ productoId: productoNotasId, cantidad: 3 }],
        })
        .expect(201);

      facturaContadoId = respuesta.body.id;
      expect(Number(respuesta.body.total)).toBe(354);

      const stock = await prisma.stock.findUniqueOrThrow({
        where: { productoId_bodegaId: { productoId: productoNotasId, bodegaId: bodegaNotasId } },
      });
      expect(Number(stock.cantidadActual)).toBe(17); // 20 - 3
    });

    it('una nota de crédito contra esa factura devuelve el stock y guarda montos en negativo', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/facturas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clienteId: clienteAId,
          bodegaId: bodegaNotasId,
          tipoFactura: 'NOTA_CREDITO',
          facturaOrigenId: facturaContadoId,
          lineas: [{ productoId: productoNotasId, cantidad: 1 }],
        })
        .expect(201);

      expect(respuesta.body.tipoNcf).toBe('B04');
      // 1 * 100 = 100 subtotal; itbis 18% = 18; total 118 -> negativo
      expect(Number(respuesta.body.subtotal)).toBe(-100);
      expect(Number(respuesta.body.itbis)).toBe(-18);
      expect(Number(respuesta.body.total)).toBe(-118);

      const stock = await prisma.stock.findUniqueOrThrow({
        where: { productoId_bodegaId: { productoId: productoNotasId, bodegaId: bodegaNotasId } },
      });
      expect(Number(stock.cantidadActual)).toBe(18); // 17 + 1 devuelto
    });

    it('rechaza anular sin un motivo', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post(`/api/facturas/${facturaContadoId}/anular`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('anular la factura de CONTADO devuelve el stock restante a la bodega', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post(`/api/facturas/${facturaContadoId}/anular`)
        .set('Authorization', `Bearer ${token}`)
        .send({ motivo: 'Cliente cambió de opinión' })
        .expect(201);

      const stock = await prisma.stock.findUniqueOrThrow({
        where: { productoId_bodegaId: { productoId: productoNotasId, bodegaId: bodegaNotasId } },
      });
      // 18 (tras la nota de crédito) + (3 originales - 1 ya devuelto por la nota) = 20
      expect(Number(stock.cantidadActual)).toBe(20);

      const facturaAnulada = await prisma.factura.findUniqueOrThrow({ where: { id: facturaContadoId } });
      expect(facturaAnulada.motivoAnulacion).toBe('Cliente cambió de opinión');
    });

    it('no se puede anular dos veces la misma factura', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post(`/api/facturas/${facturaContadoId}/anular`)
        .set('Authorization', `Bearer ${token}`)
        .send({ motivo: 'Intento de anular dos veces' })
        .expect(400);
    });

    it('registra el pago completo de una factura a crédito y rechaza un pago adicional una vez saldada', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const factura = await request(app.getHttpServer())
        .post('/api/facturas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clienteId: clienteAId,
          bodegaId: bodegaNotasId,
          tipoFactura: 'CREDITO',
          lineas: [{ productoId: productoNotasId, cantidad: 1 }],
        })
        .expect(201);
      // precio vigente 100 + 18% itbis = 118 de total

      await request(app.getHttpServer())
        .post(`/api/facturas/${factura.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monto: 118, metodoPago: 'EFECTIVO' })
        .expect(201);

      const actualizada = await prisma.factura.findUniqueOrThrow({ where: { id: factura.body.id } });
      expect(actualizada.pagada).toBe(true);
      expect(actualizada.fechaPago).not.toBeNull();

      await request(app.getHttpServer())
        .post(`/api/facturas/${factura.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monto: 1, metodoPago: 'EFECTIVO' })
        .expect(400);
    });
  });

  describe('Cotizaciones y Remisiones', () => {
    let bodegaId: string;
    let productoId: string;

    beforeAll(async () => {
      const bodega = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega Cotiz E2E' } });
      bodegaId = bodega.id;
      const producto = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-COTIZ', nombre: 'Producto Cotiz E2E', porcentajeItbis: 18 },
      });
      productoId = producto.id;
      await prisma.precio.create({
        data: { productoId: producto.id, listaPrecio: 'GENERAL', costo: 50, margenPct: 100, precioVenta: 100 },
      });
      await prisma.stock.create({
        data: { productoId: producto.id, bodegaId: bodega.id, cantidadActual: 50, stockMinimo: 5 },
      });
      // La secuencia B02 de tenantA ya existe (creada en el beforeAll principal)
      // y se comparte entre describes — solo sigue incrementando.
    });

    it('crea una cotización, la acepta y la convierte en factura descontando stock', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const cotizacion = await request(app.getHttpServer())
        .post('/api/cotizaciones')
        .set('Authorization', `Bearer ${token}`)
        .send({
          numero: 'COT-E2E-001',
          clienteId: clienteAId,
          fechaVigenciaHasta: '2099-01-01',
          lineas: [{ productoId, cantidad: 4 }],
        })
        .expect(201);

      expect(Number(cotizacion.body.total)).toBe(472); // 4*100=400 + 18% = 472
      expect(cotizacion.body.estado).toBe('BORRADOR');

      await request(app.getHttpServer())
        .patch(`/api/cotizaciones/${cotizacion.body.id}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ estado: 'ACEPTADA' })
        .expect(200);

      const factura = await request(app.getHttpServer())
        .post(`/api/cotizaciones/${cotizacion.body.id}/convertir`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bodegaId, tipoFactura: 'CONTADO' })
        .expect(201);

      expect(Number(factura.body.total)).toBe(472);

      const stock = await prisma.stock.findUniqueOrThrow({
        where: { productoId_bodegaId: { productoId, bodegaId } },
      });
      expect(Number(stock.cantidadActual)).toBe(46); // 50 - 4

      // no se puede convertir dos veces
      await request(app.getHttpServer())
        .post(`/api/cotizaciones/${cotizacion.body.id}/convertir`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bodegaId, tipoFactura: 'CONTADO' })
        .expect(400);
    });

    it('rechaza convertir una cotización rechazada', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const cotizacion = await request(app.getHttpServer())
        .post('/api/cotizaciones')
        .set('Authorization', `Bearer ${token}`)
        .send({ numero: 'COT-E2E-002', clienteId: clienteAId, fechaVigenciaHasta: '2099-01-01', lineas: [{ productoId, cantidad: 1 }] })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/cotizaciones/${cotizacion.body.id}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ estado: 'RECHAZADA' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/cotizaciones/${cotizacion.body.id}/convertir`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bodegaId, tipoFactura: 'CONTADO' })
        .expect(400);
    });

    it('crea una remisión (sin mover stock) y al convertirla en factura recién ahí descuenta inventario', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const stockAntes = await prisma.stock.findUniqueOrThrow({ where: { productoId_bodegaId: { productoId, bodegaId } } });

      const remision = await request(app.getHttpServer())
        .post('/api/remisiones')
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, bodegaId, numero: 'REM-E2E-001', lineas: [{ productoId, cantidad: 2 }] })
        .expect(201);

      expect(remision.body.estado).toBe('BORRADOR');

      const stockTrasRemision = await prisma.stock.findUniqueOrThrow({ where: { productoId_bodegaId: { productoId, bodegaId } } });
      expect(Number(stockTrasRemision.cantidadActual)).toBe(Number(stockAntes.cantidadActual)); // sin cambios

      await request(app.getHttpServer())
        .patch(`/api/remisiones/${remision.body.id}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ estado: 'ENTREGADA' })
        .expect(200);

      const factura = await request(app.getHttpServer())
        .post(`/api/remisiones/${remision.body.id}/convertir`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tipoFactura: 'CONTADO' })
        .expect(201);

      // precio se resuelve al vigente (100) ya que la remisión no guarda precio
      expect(Number(factura.body.total)).toBe(236); // 2*100=200 + 18% = 236

      const stockTrasFactura = await prisma.stock.findUniqueOrThrow({ where: { productoId_bodegaId: { productoId, bodegaId } } });
      expect(Number(stockTrasFactura.cantidadActual)).toBe(Number(stockAntes.cantidadActual) - 2);

      await request(app.getHttpServer())
        .post(`/api/remisiones/${remision.body.id}/convertir`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tipoFactura: 'CONTADO' })
        .expect(400);
    });

    it('permite editar una cotización mientras esté en BORRADOR, y lo rechaza una vez aceptada', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const cotizacion = await request(app.getHttpServer())
        .post('/api/cotizaciones')
        .set('Authorization', `Bearer ${token}`)
        .send({ numero: 'COT-E2E-003', clienteId: clienteAId, fechaVigenciaHasta: '2099-01-01', lineas: [{ productoId, cantidad: 1 }] })
        .expect(201);

      const editada = await request(app.getHttpServer())
        .patch(`/api/cotizaciones/${cotizacion.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ numero: 'COT-E2E-003-B', clienteId: clienteAId, fechaVigenciaHasta: '2099-01-01', lineas: [{ productoId, cantidad: 5 }] })
        .expect(200);

      expect(editada.body.numero).toBe('COT-E2E-003-B');
      expect(Number(editada.body.total)).toBe(590); // 5*100=500 + 18% = 590

      await request(app.getHttpServer())
        .patch(`/api/cotizaciones/${cotizacion.body.id}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ estado: 'ACEPTADA' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/cotizaciones/${cotizacion.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ numero: 'COT-E2E-003-C', clienteId: clienteAId, fechaVigenciaHasta: '2099-01-01', lineas: [{ productoId, cantidad: 1 }] })
        .expect(400);
    });

    it('permite editar una remisión mientras esté en BORRADOR, y lo rechaza una vez entregada', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const remision = await request(app.getHttpServer())
        .post('/api/remisiones')
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, bodegaId, numero: 'REM-E2E-002', lineas: [{ productoId, cantidad: 1 }] })
        .expect(201);

      const editada = await request(app.getHttpServer())
        .patch(`/api/remisiones/${remision.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, bodegaId, numero: 'REM-E2E-002-B', lineas: [{ productoId, cantidad: 3 }] })
        .expect(200);

      expect(editada.body.numero).toBe('REM-E2E-002-B');
      expect(editada.body.lineas).toHaveLength(1);
      expect(Number(editada.body.lineas[0].cantidad)).toBe(3);

      await request(app.getHttpServer())
        .patch(`/api/remisiones/${remision.body.id}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ estado: 'ENTREGADA' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/remisiones/${remision.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, bodegaId, numero: 'REM-E2E-002-C', lineas: [{ productoId, cantidad: 1 }] })
        .expect(400);
    });

    it('marcar una cotización como ENVIADA dispara una notificación real usando la plantilla "cotizacion_enviada"', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/notificaciones/plantillas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          canal: 'EMAIL',
          clave: 'cotizacion_enviada',
          asunto: 'Cotización {{cotizacion_numero}}',
          cuerpo: 'Hola {{cliente_nombre}}, tu cotización {{cotizacion_numero}} por {{cotizacion_total}} está lista.',
        })
        .expect(201);

      const cliente = await request(app.getHttpServer())
        .post('/api/clientes')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Cliente Notificación E2E', tipo: 'PERSONA_FISICA', email: 'notificacion-e2e@example.com' })
        .expect(201);

      const cotizacion = await request(app.getHttpServer())
        .post('/api/cotizaciones')
        .set('Authorization', `Bearer ${token}`)
        .send({ numero: 'COT-E2E-NOTIF', clienteId: cliente.body.id, fechaVigenciaHasta: '2099-01-01', lineas: [{ productoId, cantidad: 1 }] })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/cotizaciones/${cotizacion.body.id}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ estado: 'ENVIADA' })
        .expect(200);

      // El listener corre desacoplado del request HTTP (fire-and-forget sobre el event bus).
      await new Promise((resolve) => setTimeout(resolve, 300));

      const notificaciones = await request(app.getHttpServer())
        .get('/api/notificaciones')
        .set('Authorization', `Bearer ${token}`)
        .query({ busqueda: 'notificacion-e2e@example.com' })
        .expect(200);

      expect(notificaciones.body.datos).toHaveLength(1);
      expect(notificaciones.body.datos[0].asunto).toBe(`Cotización ${cotizacion.body.numero}`);
    });
  });

  describe('Documentos PDF (facturas, cotizaciones, remisiones)', () => {
    let bodegaId: string;
    let productoId: string;

    beforeAll(async () => {
      const bodega = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega PDF E2E' } });
      bodegaId = bodega.id;
      const producto = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-PDF', nombre: 'Producto PDF E2E', porcentajeItbis: 18 },
      });
      productoId = producto.id;
      await prisma.stock.create({ data: { productoId: producto.id, bodegaId: bodega.id, cantidadActual: 50, stockMinimo: 5 } });
    });

    it('descarga el PDF de una factura', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const factura = await request(app.getHttpServer())
        .post('/api/facturas')
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, bodegaId, tipoFactura: 'CONTADO', lineas: [{ productoId, cantidad: 1, precioUnitario: 100 }] })
        .expect(201);

      const pdf = await request(app.getHttpServer())
        .get(`/api/facturas/${factura.body.id}/pdf`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(pdf.body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    it('descarga el PDF de una cotización', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const cotizacion = await request(app.getHttpServer())
        .post('/api/cotizaciones')
        .set('Authorization', `Bearer ${token}`)
        .send({ numero: 'COT-E2E-PDF', clienteId: clienteAId, fechaVigenciaHasta: '2099-01-01', lineas: [{ productoId, cantidad: 1 }] })
        .expect(201);

      const pdf = await request(app.getHttpServer())
        .get(`/api/cotizaciones/${cotizacion.body.id}/pdf`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(pdf.body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    it('descarga el PDF de una remisión', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const remision = await request(app.getHttpServer())
        .post('/api/remisiones')
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, bodegaId, numero: 'REM-E2E-PDF', lineas: [{ productoId, cantidad: 1 }] })
        .expect(201);

      const pdf = await request(app.getHttpServer())
        .get(`/api/remisiones/${remision.body.id}/pdf`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(pdf.body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });
  });

  describe('Contabilidad', () => {
    let bodegaId: string;
    let productoId: string;
    let facturaId: string;

    // El listener de asientos corre desacoplado del request HTTP (fire-and-forget
    // sobre el event bus, igual que Notificaciones/Webhooks) — a diferencia de esos
    // dos, no depende de red externa (solo escribe en la misma base), así que una
    // espera corta y determinista es suficiente para observarlo sin volverse flaky.
    const esperarListener = () => new Promise((resolve) => setTimeout(resolve, 300));

    beforeAll(async () => {
      const bodega = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega Contabilidad E2E' } });
      bodegaId = bodega.id;
      const producto = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-CONTA', nombre: 'Producto Contabilidad E2E', porcentajeItbis: 18 },
      });
      productoId = producto.id;
      await prisma.precio.create({
        data: { productoId: producto.id, listaPrecio: 'GENERAL', costo: 50, margenPct: 100, precioVenta: 100 },
      });
      await prisma.stock.create({
        data: { productoId: producto.id, bodegaId: bodega.id, cantidadActual: 20, stockMinimo: 5 },
      });
    });

    it('el catálogo de cuentas sembrado en el provisioning está disponible', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/contabilidad/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ codigo: '1010', nombre: 'Caja y Bancos' })]),
      );
    });

    it('emitir una factura CONTADO genera automáticamente un asiento balanceado', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const factura = await request(app.getHttpServer())
        .post('/api/facturas')
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, bodegaId, tipoFactura: 'CONTADO', lineas: [{ productoId, cantidad: 2 }] })
        .expect(201);
      facturaId = factura.body.id;

      await esperarListener();

      const asientos = await request(app.getHttpServer())
        .get('/api/contabilidad/asientos')
        .query({ busqueda: facturaId })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(asientos.body.datos).toHaveLength(1);
      const asiento = asientos.body.datos[0];
      expect(asiento.origen).toBe('FACTURA');

      const totalDebito = asiento.lineas.reduce((acc: number, l: { debito: string }) => acc + Number(l.debito), 0);
      const totalCredito = asiento.lineas.reduce((acc: number, l: { credito: string }) => acc + Number(l.credito), 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 2);
      expect(totalDebito).toBeCloseTo(236, 2); // 2*100=200 + 18% = 236

      expect(asiento.lineas).toEqual(
        expect.arrayContaining([expect.objectContaining({ cuentaContable: expect.objectContaining({ codigo: '1010' }) })]),
      );
    });

    it('anular esa factura genera la reversa contable (segundo asiento)', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post(`/api/facturas/${facturaId}/anular`)
        .set('Authorization', `Bearer ${token}`)
        .send({ motivo: 'Reversa de prueba contable' })
        .expect(201);

      await esperarListener();

      const asientos = await request(app.getHttpServer())
        .get('/api/contabilidad/asientos')
        .query({ busqueda: facturaId })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(asientos.body.datos).toHaveLength(2);
    });

    it('el balance general y el estado de resultados reflejan los asientos generados', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const balance = await request(app.getHttpServer())
        .get('/api/contabilidad/balance-general')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(Math.abs(balance.body.diferencia)).toBeLessThan(0.01);

      const resultados = await request(app.getHttpServer())
        .get('/api/contabilidad/estado-resultados')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(resultados.body).toHaveProperty('utilidadNeta');
    });

    it('acepta un asiento manual balanceado y rechaza uno que no balancea', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const cuentas = await request(app.getHttpServer())
        .get('/api/contabilidad/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const caja = cuentas.body.find((c: { codigo: string }) => c.codigo === '1010');
      const capital = cuentas.body.find((c: { codigo: string }) => c.codigo === '3010');

      await request(app.getHttpServer())
        .post('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          concepto: 'Aporte de capital inicial',
          lineas: [
            { cuentaContableId: caja.id, debito: 5000 },
            { cuentaContableId: capital.id, credito: 5000 },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          concepto: 'Asiento mal hecho',
          lineas: [
            { cuentaContableId: caja.id, debito: 100 },
            { cuentaContableId: capital.id, credito: 50 },
          ],
        })
        .expect(400);
    });

    it('contabilidad.ver es obligatorio', async () => {
      const token = await login('lectura@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .get('/api/contabilidad/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('gasto rápido genera un asiento balanceado de 2 líneas sin que el usuario escriba partida doble', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const cuentas = await request(app.getHttpServer())
        .get('/api/contabilidad/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const caja = cuentas.body.find((c: { codigo: string }) => c.codigo === '1010');
      const gastosOperativos = cuentas.body.find((c: { codigo: string }) => c.codigo === '5020');

      const gasto = await request(app.getHttpServer())
        .post('/api/contabilidad/asientos/gastos')
        .set('Authorization', `Bearer ${token}`)
        .send({ concepto: 'Pago de alquiler de local', monto: 15000, cuentaGastoId: gastosOperativos.id, cuentaOrigenId: caja.id })
        .expect(201);

      expect(gasto.body.origen).toBe('GASTO');
      const totalDebito = gasto.body.lineas.reduce((acc: number, l: { debito: string }) => acc + Number(l.debito), 0);
      const totalCredito = gasto.body.lineas.reduce((acc: number, l: { credito: string }) => acc + Number(l.credito), 0);
      expect(totalDebito).toBe(15000);
      expect(totalCredito).toBe(15000);
    });
  });

  describe('Gastos Menores y Bancos', () => {
    let cuentaBancariaId: string;
    let gastosOperativosId: string;

    // El asiento se genera de forma asíncrona (fire-and-forget sobre el event
    // bus, ver ContabilidadEventosService.alCrearGastoMenor) — mismo patrón
    // ya usado más abajo en este archivo para Contabilidad/Nómina.
    const esperarListener = () => new Promise((resolve) => setTimeout(resolve, 300));

    beforeAll(async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);
      const cuentas = await request(app.getHttpServer())
        .get('/api/contabilidad/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const cajaId = cuentas.body.find((c: { codigo: string }) => c.codigo === '1010').id;
      gastosOperativosId = cuentas.body.find((c: { codigo: string }) => c.codigo === '5020').id;

      const banco = await request(app.getHttpServer())
        .post('/api/bancos')
        .set('Authorization', `Bearer ${token}`)
        .send({ banco: 'Banco Popular', numeroCuenta: '123456789', tipoCuenta: 'CORRIENTE', cuentaContableId: cajaId })
        .expect(201);
      cuentaBancariaId = banco.body.id;
    });

    it('crea un gasto menor con NCF tipo B11 y calcula monto/ITBIS/total sumando sus líneas', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const gasto = await request(app.getHttpServer())
        .post('/api/gastos-menores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cuentaBancariaId,
          notas: 'Compra de suministros al mercado informal',
          lineas: [
            { cuentaContableId: gastosOperativosId, concepto: 'Suministros', valor: 500, porcentajeItbis: 18, cantidad: 1 },
            { cuentaContableId: gastosOperativosId, concepto: 'Transporte', valor: 200, cantidad: 2 },
          ],
        })
        .expect(201);

      expect(gasto.body.ncf).toMatch(/^B11/);
      expect(gasto.body.tipoNcf).toBe('B11');
      // línea 1: 500 base, itbis 90; línea 2: 200*2=400 base, itbis 0 => monto 900, itbis 90, total 990
      expect(Number(gasto.body.monto)).toBe(900);
      expect(Number(gasto.body.itbis)).toBe(90);
      expect(Number(gasto.body.total)).toBe(990);

      await esperarListener();
      const asientos = await request(app.getHttpServer())
        .get('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const asiento = asientos.body.datos.find(
        (a: { origen: string; origenId: string }) => a.origen === 'GASTO_MENOR' && a.origenId === gasto.body.id,
      );
      expect(asiento).toBeDefined();
      const totalDebito = asiento.lineas.reduce((acc: number, l: { debito: string }) => acc + Number(l.debito), 0);
      const totalCredito = asiento.lineas.reduce((acc: number, l: { credito: string }) => acc + Number(l.credito), 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 2);
      expect(totalCredito).toBeCloseTo(990, 2);
    });

    it('rechaza un gasto menor sin al menos una línea', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/gastos-menores')
        .set('Authorization', `Bearer ${token}`)
        .send({ cuentaBancariaId, lineas: [] })
        .expect(400);
    });
  });

  describe('Libro mayor y cierre de período contable', () => {
    // Fechas deliberadamente en el pasado lejano (2020) para que este bloque
    // sea inmune a lo que el resto de la suite haga "hoy" — el cierre de
    // período bloquea asientos MANUALES/GASTO con fecha <= la de corte, así
    // que cualquier interferencia con los demás describe (que siempre usan
    // la fecha por defecto = ahora) queda descartada por construcción.
    let cajaId: string;
    let ingresosId: string;
    let gastosOperativosId: string;
    // Reutilizados en los tests nuevos de anular/conciliación/balance de
    // comprobación (en vez de loguear de nuevo en cada uno) para no sumarle
    // presión innecesaria al rate-limiter global de /auth/login (120/min)
    // que comparten TODOS los tests de este archivo.
    let tokenAdmin: string;
    let tokenB: string;

    beforeAll(async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);
      tokenAdmin = token;
      tokenB = await login('admin@e2e-b.com', SUBDOMINIO_B);
      const cuentas = await request(app.getHttpServer())
        .get('/api/contabilidad/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      cajaId = cuentas.body.find((c: { codigo: string }) => c.codigo === '1010').id;
      ingresosId = cuentas.body.find((c: { codigo: string }) => c.codigo === '4010').id;
      gastosOperativosId = cuentas.body.find((c: { codigo: string }) => c.codigo === '5020').id;

      await request(app.getHttpServer())
        .post('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          concepto: 'Venta de prueba 2020',
          fecha: '2020-01-15',
          lineas: [{ cuentaContableId: cajaId, debito: 1000 }, { cuentaContableId: ingresosId, credito: 1000 }],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          concepto: 'Gasto de prueba 2020',
          fecha: '2020-01-20',
          lineas: [{ cuentaContableId: gastosOperativosId, debito: 400 }, { cuentaContableId: cajaId, credito: 400 }],
        })
        .expect(201);
    });

    it('el libro mayor de Caja acumula el saldo cronológicamente', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get(`/api/contabilidad/libro-mayor/${cajaId}`)
        .query({ desde: '2020-01-01', hasta: '2020-01-31' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.saldoInicial).toBe(0);
      expect(respuesta.body.movimientos).toEqual([
        expect.objectContaining({ debito: 1000, credito: 0, saldoAcumulado: 1000 }),
        expect.objectContaining({ debito: 0, credito: 400, saldoAcumulado: 600 }),
      ]);
      expect(respuesta.body.saldoFinal).toBe(600);
    });

    it('cerrar el período traspasa la utilidad neta a Utilidades Retenidas con un asiento balanceado', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const cierre = await request(app.getHttpServer())
        .post('/api/contabilidad/cierre-periodo')
        .set('Authorization', `Bearer ${token}`)
        .send({ fecha: '2020-01-31' })
        .expect(201);

      expect(Number(cierre.body.utilidadNeta)).toBe(600);

      const asiento = cierre.body.asientoCierre;
      expect(asiento.origen).toBe('CIERRE');
      const totalDebito = asiento.lineas.reduce((acc: number, l: { debito: string }) => acc + Number(l.debito), 0);
      const totalCredito = asiento.lineas.reduce((acc: number, l: { credito: string }) => acc + Number(l.credito), 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 2);

      const cuentas = await request(app.getHttpServer())
        .get('/api/contabilidad/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const utilidadesId = cuentas.body.find((c: { codigo: string }) => c.codigo === '3020').id;
      const lineaUtilidades = asiento.lineas.find((l: { cuentaContableId: string }) => l.cuentaContableId === utilidadesId);
      expect(Number(lineaUtilidades.credito)).toBe(600);
    });

    it('rechaza un asiento manual con fecha dentro del período ya cerrado', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${token}`)
        .send({ concepto: 'Asiento tardío', fecha: '2020-01-20', lineas: [{ cuentaContableId: cajaId, debito: 10 }, { cuentaContableId: ingresosId, credito: 10 }] })
        .expect(400);
    });

    it('permite un asiento (manual o gasto) con fecha posterior al cierre', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${token}`)
        .send({ concepto: 'Asiento normal', fecha: '2020-02-01', lineas: [{ cuentaContableId: cajaId, debito: 10 }, { cuentaContableId: ingresosId, credito: 10 }] })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/contabilidad/asientos/gastos')
        .set('Authorization', `Bearer ${token}`)
        .send({ concepto: 'Gasto normal', fecha: '2020-02-02', monto: 20, cuentaGastoId: gastosOperativosId, cuentaOrigenId: cajaId })
        .expect(201);
    });

    it('rechaza cerrar dos veces en o antes de la misma fecha', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/contabilidad/cierre-periodo')
        .set('Authorization', `Bearer ${token}`)
        .send({ fecha: '2020-01-31' })
        .expect(400);
    });

    it('el listado de cierres incluye el cierre realizado', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/contabilidad/cierre-periodo')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.some((c: { utilidadNeta: string }) => Number(c.utilidadNeta) === 600)).toBe(true);
    });

    it('contabilidad.cerrarperiodo es obligatorio para cerrar un período', async () => {
      const token = await login('lectura@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/contabilidad/cierre-periodo')
        .set('Authorization', `Bearer ${token}`)
        .send({ fecha: '2019-01-31' })
        .expect(403);
    });

    it('anular un asiento manual genera un reverso y ya no aporta al balance general', async () => {
      const token = tokenAdmin;

      // Cuentas dedicadas y nuevas (sin ningún movimiento previo) para que el
      // saldo de esta prueba sea 100% autocontenido, sin depender de qué otro
      // test haya tocado Caja/Ingresos antes — el reverso siempre se fecha a
      // "ahora" (momento real de la anulación, igual que la reversa de
      // Factura/Compra), no a la fecha del asiento original.
      const cuentas = await request(app.getHttpServer())
        .post('/api/contabilidad/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .send({ codigo: '1099', nombre: 'Caja Test Anular', tipo: 'ACTIVO', naturaleza: 'DEUDORA' })
        .expect(201);
      const cajaAnularId = cuentas.body.id;
      const ingresosAnular = await request(app.getHttpServer())
        .post('/api/contabilidad/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .send({ codigo: '4099', nombre: 'Ingresos Test Anular', tipo: 'INGRESO', naturaleza: 'ACREEDORA' })
        .expect(201);
      const ingresosAnularId = ingresosAnular.body.id;

      const asiento = await request(app.getHttpServer())
        .post('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          concepto: 'Aporte a anular',
          lineas: [{ cuentaContableId: cajaAnularId, debito: 777 }, { cuentaContableId: ingresosAnularId, credito: 777 }],
        })
        .expect(201);

      const balanceConAsiento = await request(app.getHttpServer())
        .get('/api/contabilidad/balance-general')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const cajaConAsiento = balanceConAsiento.body.activo.cuentas.find((c: { codigo: string }) => c.codigo === '1099').saldo;
      expect(cajaConAsiento).toBeCloseTo(777, 2);

      const reverso = await request(app.getHttpServer())
        .post(`/api/contabilidad/asientos/${asiento.body.id}/anular`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(reverso.body.origen).toBe('ANULACION');
      const totalDebito = reverso.body.lineas.reduce((acc: number, l: { debito: string }) => acc + Number(l.debito), 0);
      const totalCredito = reverso.body.lineas.reduce((acc: number, l: { credito: string }) => acc + Number(l.credito), 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 2);
      expect(totalDebito).toBeCloseTo(777, 2);

      const original = await request(app.getHttpServer())
        .get(`/api/contabilidad/asientos/${asiento.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(original.body.anulado).toBe(true);

      const balanceDespues = await request(app.getHttpServer())
        .get('/api/contabilidad/balance-general')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const cajaDespues = balanceDespues.body.activo.cuentas.find((c: { codigo: string }) => c.codigo === '1099');
      // El original sigue contando (no se filtra por anulado), pero el
      // reverso lo cancela matemáticamente -> el saldo neto vuelve a 0.
      expect(cajaDespues?.saldo ?? 0).toBeCloseTo(0, 2);
    });

    it('rechaza anular un asiento (o registrar un pago/gasto menor) con fecha dentro de un período ya cerrado', async () => {
      const token = tokenAdmin;

      const asientoViejo = await request(app.getHttpServer())
        .get('/api/contabilidad/asientos')
        .query({ busqueda: 'Venta de prueba 2020' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const idAsientoViejo = asientoViejo.body.datos[0].id;

      await request(app.getHttpServer())
        .post(`/api/contabilidad/asientos/${idAsientoViejo}/anular`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('rechaza anular un asiento de origen automático', async () => {
      const token = tokenAdmin;

      const asientos = await request(app.getHttpServer())
        .get('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const asientoFactura = asientos.body.datos.find((a: { origen: string }) => a.origen === 'FACTURA');
      expect(asientoFactura).toBeDefined();

      await request(app.getHttpServer())
        .post(`/api/contabilidad/asientos/${asientoFactura.id}/anular`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('balance de comprobación: los totales de débito y crédito cuadran', async () => {
      const token = tokenAdmin;

      const respuesta = await request(app.getHttpServer())
        .get('/api/contabilidad/balance-comprobacion')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Math.abs(respuesta.body.totales.debito - respuesta.body.totales.credito)).toBeLessThan(0.01);
      expect(respuesta.body.cuentas.some((c: { codigo: string }) => c.codigo === '1010')).toBe(true);
    });

    it('conciliación bancaria: marcar una línea conciliada actualiza el saldo conciliado/pendiente', async () => {
      const token = tokenAdmin;

      // Cuenta contable dedicada y nueva (sin ningún movimiento previo) para
      // que el saldo según libros sea 100% predecible, sin arrastrar el
      // historial acumulado de la cuenta "1010" compartida por media suite.
      const cuentaNueva = await request(app.getHttpServer())
        .post('/api/contabilidad/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .send({ codigo: '1098', nombre: 'Banco Test Conciliación', tipo: 'ACTIVO', naturaleza: 'DEUDORA' })
        .expect(201);
      const cajaIdConciliacion = cuentaNueva.body.id;

      const banco = await request(app.getHttpServer())
        .post('/api/bancos')
        .set('Authorization', `Bearer ${token}`)
        .send({ banco: 'Banco Conciliación E2E', numeroCuenta: 'CONC-001', tipoCuenta: 'CORRIENTE', cuentaContableId: cajaIdConciliacion })
        .expect(201);

      const asiento = await request(app.getHttpServer())
        .post('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          concepto: 'Depósito a conciliar',
          lineas: [{ cuentaContableId: cajaIdConciliacion, debito: 500 }, { cuentaContableId: ingresosId, credito: 500 }],
        })
        .expect(201);
      const lineaCaja = asiento.body.lineas.find((l: { cuentaContableId: string }) => l.cuentaContableId === cajaIdConciliacion);

      const antes = await request(app.getHttpServer())
        .get(`/api/contabilidad/conciliacion/${banco.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(antes.body.saldoConciliado).toBe(0);
      expect(antes.body.saldoPendiente).toBeCloseTo(500, 2);

      await request(app.getHttpServer())
        .patch(`/api/contabilidad/conciliacion/lineas/${lineaCaja.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ conciliado: true })
        .expect(200);

      const despues = await request(app.getHttpServer())
        .get(`/api/contabilidad/conciliacion/${banco.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(despues.body.saldoConciliado).toBeCloseTo(500, 2);
      expect(despues.body.saldoPendiente).toBeCloseTo(0, 2);
    });

    it('el tenant B no puede conciliar una línea de asiento del tenant A (regresión de IDOR en tabla hija)', async () => {
      const asientos = await request(app.getHttpServer())
        .get('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(200);
      const lineaDeA = asientos.body.datos[0].lineas[0].id;

      await request(app.getHttpServer())
        .patch(`/api/contabilidad/conciliacion/lineas/${lineaDeA}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ conciliado: true })
        .expect(404);
    });
  });

  describe('Nómina', () => {
    let empleadoId: string;
    let periodoId: string;

    const esperarListener = () => new Promise((resolve) => setTimeout(resolve, 300));

    it('crea un empleado', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/nomina/empleados')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Empleado E2E', cedula: '001-E2E-1', cargo: 'Analista', fechaIngreso: '2025-01-01', salarioBrutoMensual: 35000 })
        .expect(201);

      empleadoId = respuesta.body.id;
      expect(respuesta.body.activo).toBe(true);
    });

    it('genera un período MENSUAL con un recibo calculado para el empleado activo', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/nomina/periodos')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'MENSUAL', fechaInicio: '2026-01-01', fechaFin: '2026-01-31' })
        .expect(201);

      periodoId = respuesta.body.id;
      expect(respuesta.body.estado).toBe('BORRADOR');
      expect(respuesta.body.recibos).toEqual(
        expect.arrayContaining([expect.objectContaining({ empleadoId, salarioBruto: '35000' })]),
      );
    });

    it('procesa el período (BORRADOR -> PROCESADO)', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post(`/api/nomina/periodos/${periodoId}/procesar`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(respuesta.body.estado).toBe('PROCESADO');
    });

    it('marcar pagado (PROCESADO -> PAGADO) genera un asiento contable balanceado de origen NOMINA', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post(`/api/nomina/periodos/${periodoId}/marcar-pagado`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(respuesta.body.estado).toBe('PAGADO');

      await esperarListener();

      const asientos = await request(app.getHttpServer())
        .get('/api/contabilidad/asientos')
        .query({ busqueda: periodoId })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(asientos.body.datos).toHaveLength(1);
      const asiento = asientos.body.datos[0];
      expect(asiento.origen).toBe('NOMINA');

      const totalDebito = asiento.lineas.reduce((acc: number, l: { debito: string }) => acc + Number(l.debito), 0);
      const totalCredito = asiento.lineas.reduce((acc: number, l: { credito: string }) => acc + Number(l.credito), 0);
      expect(totalDebito).toBeCloseTo(totalCredito, 2);
    });

    it('no permite procesar dos veces el mismo período', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post(`/api/nomina/periodos/${periodoId}/procesar`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('nomina.ver es obligatorio', async () => {
      const token = await login('lectura@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .get('/api/nomina/empleados')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('el reporte de aportes del período suma SFS/AFP/INFOTEP/ISR de todos los recibos', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get(`/api/nomina/periodos/${periodoId}/reporte-aportes`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.empleados).toEqual(
        expect.arrayContaining([expect.objectContaining({ empleadoId, salarioBruto: 35000 })]),
      );
      expect(respuesta.body.totales.salarioBruto).toBe(35000);
      expect(respuesta.body.totales.totalSfs).toBe(respuesta.body.totales.sfsEmpleado + respuesta.body.totales.sfsEmpleador);
      expect(respuesta.body.totales.totalAfp).toBe(respuesta.body.totales.afpEmpleado + respuesta.body.totales.afpEmpleador);
    });

    it('retenciones-nomina agrupa el ISR y salario bruto del período por empleado', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/reportes-fiscales/retenciones-nomina')
        .query({ desde: '2026-01-01', hasta: '2026-01-31' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.empleados).toEqual(
        expect.arrayContaining([expect.objectContaining({ cedula: '001-E2E-1', salarioBruto: 35000 })]),
      );
      expect(respuesta.body.resumen.salarioBruto).toBeGreaterThanOrEqual(35000);
    });

    it('el tenant B no ve el empleado de A ni en el listado ni pidiéndolo por id directo (regresión de la fuga de tenant en Nómina)', async () => {
      const tokenB = await login('admin@e2e-b.com', SUBDOMINIO_B);

      const listado = await request(app.getHttpServer())
        .get('/api/nomina/empleados')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      const ids = listado.body.datos.map((e: { id: string }) => e.id);
      expect(ids).not.toContain(empleadoId);

      await request(app.getHttpServer())
        .get(`/api/nomina/empleados/${empleadoId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });

    it('el tenant B no ve el período de nómina de A ni en el listado ni pidiéndolo por id directo', async () => {
      const tokenB = await login('admin@e2e-b.com', SUBDOMINIO_B);

      const listado = await request(app.getHttpServer())
        .get('/api/nomina/periodos')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      const ids = listado.body.datos.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(periodoId);

      await request(app.getHttpServer())
        .get(`/api/nomina/periodos/${periodoId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });
  });

  describe('POS', () => {
    let bodegaId: string;
    let productoId: string;
    let turnoId: string;

    beforeAll(async () => {
      const bodega = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega POS E2E' } });
      bodegaId = bodega.id;
      const producto = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-POS', nombre: 'Producto POS E2E', porcentajeItbis: 18 },
      });
      productoId = producto.id;
      await prisma.precio.create({
        data: { productoId: producto.id, listaPrecio: 'GENERAL', costo: 50, margenPct: 100, precioVenta: 100 },
      });
      await prisma.stock.create({
        data: { productoId: producto.id, bodegaId: bodega.id, cantidadActual: 20, stockMinimo: 5 },
      });
    });

    it('abre un turno de caja', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/pos/turnos')
        .set('Authorization', `Bearer ${token}`)
        .send({ bodegaId, montoInicial: 1000 })
        .expect(201);

      turnoId = respuesta.body.id;
      expect(respuesta.body.estado).toBe('ABIERTO');
    });

    it('rechaza abrir un segundo turno en la misma bodega mientras el primero sigue abierto', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/pos/turnos')
        .set('Authorization', `Bearer ${token}`)
        .send({ bodegaId, montoInicial: 500 })
        .expect(400);
    });

    it('registra una venta en efectivo contra el turno, vinculada a la factura generada', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/pos/ventas')
        .set('Authorization', `Bearer ${token}`)
        .send({ turnoCajaId: turnoId, clienteId: clienteAId, metodoPago: 'EFECTIVO', lineas: [{ productoId, cantidad: 2 }] })
        .expect(201);

      expect(respuesta.body.tipoFactura).toBe('CONTADO');
      expect(respuesta.body.metodoPago).toBe('EFECTIVO');
      expect(respuesta.body.total).toBe('236'); // 2*100 + 18%
    });

    it('registra un retiro de efectivo (salida) en el turno', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post(`/api/pos/turnos/${turnoId}/movimientos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'SALIDA', monto: 50, concepto: 'Compra de insumos de limpieza' })
        .expect(201);
    });

    it('cierra el turno y calcula la diferencia contra lo contado (inicial + venta efectivo - salida)', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      // esperado = 1000 (inicial) + 236 (venta efectivo) - 50 (salida) = 1186
      const respuesta = await request(app.getHttpServer())
        .post(`/api/pos/turnos/${turnoId}/cerrar`)
        .set('Authorization', `Bearer ${token}`)
        .send({ montoFinalContado: 1186 })
        .expect(201);

      expect(respuesta.body.estado).toBe('CERRADO');
      expect(Number(respuesta.body.montoEsperado)).toBeCloseTo(1186, 2);
      expect(Number(respuesta.body.diferencia)).toBeCloseTo(0, 2);
    });

    it('pos.ver es obligatorio', async () => {
      const token = await login('lectura@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .get('/api/pos/turnos')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('el tenant B no ve el turno de caja de A ni en el listado ni pidiéndolo por id directo (regresión de la fuga de tenant en POS)', async () => {
      const tokenB = await login('admin@e2e-b.com', SUBDOMINIO_B);

      const listado = await request(app.getHttpServer())
        .get('/api/pos/turnos')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      const ids = listado.body.datos.map((t: { id: string }) => t.id);
      expect(ids).not.toContain(turnoId);

      await request(app.getHttpServer())
        .get(`/api/pos/turnos/${turnoId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });
  });

  describe('POS — arqueo por cajero (quién cierra, restricción, tolerancia)', () => {
    let bodegaArqueoId: string;
    // Un login por usuario para todo el describe (no uno por test) — evitar
    // sumarle presión innecesaria al rate-limiter global de /auth/login
    // (120/min) que comparten TODOS los tests de este archivo.
    let tokenAdminArqueo: string;
    let tokenCajero2Arqueo: string;
    let tokenCajero3Arqueo: string;

    beforeAll(async () => {
      const bodega = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega Arqueo E2E' } });
      bodegaArqueoId = bodega.id;

      const rolCajero = await prisma.role.create({ data: { tenantId: tenantAId, nombre: 'CajeroArqueoE2E' } });
      for (const clave of ['pos.ver', 'pos.editar']) {
        const permiso = await prisma.permission.findUniqueOrThrow({ where: { clave } });
        await prisma.rolePermission.create({ data: { roleId: rolCajero.id, permissionId: permiso.id } });
      }
      const passwordHash = await bcrypt.hash(PASSWORD, 10);
      for (const email of ['cajero2@e2e-a.com', 'cajero3@e2e-a.com']) {
        const usuario = await prisma.user.create({ data: { tenantId: tenantAId, email, nombre: email, passwordHash } });
        await prisma.userRole.create({ data: { userId: usuario.id, roleId: rolCajero.id } });
      }

      tokenAdminArqueo = await login('admin@e2e-a.com', SUBDOMINIO_A); // CompletoA tiene pos.supervisar
      tokenCajero2Arqueo = await login('cajero2@e2e-a.com', SUBDOMINIO_A);
      tokenCajero3Arqueo = await login('cajero3@e2e-a.com', SUBDOMINIO_A);
    });

    it('un cajero sin pos.supervisar no puede cerrar el turno abierto por otro cajero', async () => {
      const turno = await request(app.getHttpServer())
        .post('/api/pos/turnos')
        .set('Authorization', `Bearer ${tokenCajero2Arqueo}`)
        .send({ bodegaId: bodegaArqueoId, montoInicial: 500 })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/pos/turnos/${turno.body.id}/cerrar`)
        .set('Authorization', `Bearer ${tokenCajero3Arqueo}`)
        .send({ montoFinalContado: 500 })
        .expect(403);

      // El cajero que lo abrió sí puede cerrar el suyo propio.
      const cierre = await request(app.getHttpServer())
        .post(`/api/pos/turnos/${turno.body.id}/cerrar`)
        .set('Authorization', `Bearer ${tokenCajero2Arqueo}`)
        .send({ montoFinalContado: 500 })
        .expect(201);
      expect(cierre.body.cerradoPor.id).toEqual(expect.any(String));
      expect(cierre.body.cajero.nombre).toEqual(expect.any(String));
    });

    it('un supervisor (pos.supervisar) sí puede cerrar el turno de otro cajero, y queda registrado como cerradoPor', async () => {
      const turno = await request(app.getHttpServer())
        .post('/api/pos/turnos')
        .set('Authorization', `Bearer ${tokenCajero2Arqueo}`)
        .send({ bodegaId: bodegaArqueoId, montoInicial: 500 })
        .expect(201);

      const cierre = await request(app.getHttpServer())
        .post(`/api/pos/turnos/${turno.body.id}/cerrar`)
        .set('Authorization', `Bearer ${tokenAdminArqueo}`)
        .send({ montoFinalContado: 500 })
        .expect(201);

      expect(cierre.body.cajero.id).not.toBe(cierre.body.cerradoPor.id);
    });

    it('exige justificación si la diferencia supera la tolerancia (default RD$50), y la acepta con ella', async () => {
      const turno = await request(app.getHttpServer())
        .post('/api/pos/turnos')
        .set('Authorization', `Bearer ${tokenCajero2Arqueo}`)
        .send({ bodegaId: bodegaArqueoId, montoInicial: 500 })
        .expect(201);

      // esperado = 500 (sin ventas/movimientos); contado 300 -> diferencia -200, supera la tolerancia default de 50.
      await request(app.getHttpServer())
        .post(`/api/pos/turnos/${turno.body.id}/cerrar`)
        .set('Authorization', `Bearer ${tokenCajero2Arqueo}`)
        .send({ montoFinalContado: 300 })
        .expect(400);

      const cierre = await request(app.getHttpServer())
        .post(`/api/pos/turnos/${turno.body.id}/cerrar`)
        .set('Authorization', `Bearer ${tokenCajero2Arqueo}`)
        .send({ montoFinalContado: 300, justificacionDiferencia: 'Faltante por verificar con el cajero' })
        .expect(201);

      expect(cierre.body.justificacionDiferencia).toBe('Faltante por verificar con el cajero');
    });

    it('GET /pos/turnos filtra por cajeroId y GET /pos/cajeros lista los cajeros distintos', async () => {
      const bodegaFiltro = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega Filtro E2E' } });

      const turnoCajero2 = await request(app.getHttpServer())
        .post('/api/pos/turnos')
        .set('Authorization', `Bearer ${tokenCajero2Arqueo}`)
        .send({ bodegaId: bodegaFiltro.id, montoInicial: 100 })
        .expect(201);
      const cajeroId = turnoCajero2.body.cajero.id;

      const filtrado = await request(app.getHttpServer())
        .get('/api/pos/turnos')
        .query({ cajeroId })
        .set('Authorization', `Bearer ${tokenAdminArqueo}`)
        .expect(200);
      expect(filtrado.body.datos.every((t: { cajero: { id: string } }) => t.cajero.id === cajeroId)).toBe(true);

      const cajeros = await request(app.getHttpServer())
        .get('/api/pos/cajeros')
        .set('Authorization', `Bearer ${tokenAdminArqueo}`)
        .expect(200);
      expect(cajeros.body.some((c: { id: string }) => c.id === cajeroId)).toBe(true);
    });
  });

  describe('IA (modo heurístico, sin ANTHROPIC_API_KEY en el entorno de pruebas)', () => {
    it('el asistente responde con el resumen numérico crudo del dashboard', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/ia/asistente')
        .set('Authorization', `Bearer ${token}`)
        .send({ pregunta: '¿cómo van las ventas de hoy?' })
        .expect(201);

      expect(respuesta.body.generadaConIa).toBe(false);
      expect(respuesta.body.respuesta).toEqual(expect.any(String));
    });

    it('sugiere una cuenta contable por coincidencia de palabras con el catálogo sembrado', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/ia/sugerir-cuenta-contable')
        .set('Authorization', `Bearer ${token}`)
        .send({ concepto: 'gastos operativos varios de oficina' })
        .expect(201);

      expect(respuesta.body).toEqual(expect.objectContaining({ codigo: '5020', fuente: 'HEURISTICA' }));
    });

    it('genera una descripción básica de producto sin IA', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .post('/api/ia/generar-descripcion-producto')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Silla ergonómica' })
        .expect(201);

      expect(respuesta.body.generadaConIa).toBe(false);
      expect(respuesta.body.descripcion).toContain('Silla ergonómica');
    });

    it('ia.usar es obligatorio', async () => {
      const token = await login('lectura@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .post('/api/ia/asistente')
        .set('Authorization', `Bearer ${token}`)
        .send({ pregunta: 'algo' })
        .expect(403);
    });
  });

  describe('Compras', () => {
    let bodegaId: string;
    let productoId: string;
    let proveedorId: string;

    beforeAll(async () => {
      const bodega = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega Compras E2E' } });
      bodegaId = bodega.id;
      const producto = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-COMPRA', nombre: 'Producto Compras E2E', porcentajeItbis: 18 },
      });
      productoId = producto.id;
      await prisma.stock.create({ data: { productoId: producto.id, bodegaId: bodega.id, cantidadActual: 0, stockMinimo: 1 } });
      const proveedor = await prisma.proveedor.create({ data: { tenantId: tenantAId, nombre: 'Proveedor E2E' } });
      proveedorId = proveedor.id;
    });

    it('crea una orden de compra y la recibe por completo: suma stock, marca RECIBIDA_TOTAL y calcula diferenciaVsFactura', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const orden = await request(app.getHttpServer())
        .post('/api/compras')
        .set('Authorization', `Bearer ${token}`)
        .send({ proveedorId, numero: 'OC-E2E-001', lineas: [{ productoId, cantidad: 10, costoUnitario: 20 }] })
        .expect(201);

      const respuesta = await request(app.getHttpServer())
        .post(`/api/compras/${orden.body.id}/recibir`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bodegaId, montoFacturaProveedor: 190, lineas: [{ productoId, cantidadRecibida: 10, costoUnitario: 20 }] })
        .expect(201);

      // orden.total = 10*20 = 200; factura del proveedor = 190 -> diferencia 10
      expect(respuesta.body.diferenciaVsFactura).toBe(10);

      const ordenActualizada = await request(app.getHttpServer())
        .get(`/api/compras/${orden.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(ordenActualizada.body.estado).toBe('RECIBIDA_TOTAL');

      const stock = await prisma.stock.findUnique({ where: { productoId_bodegaId: { productoId, bodegaId } } });
      expect(Number(stock?.cantidadActual)).toBe(10);
    });

    it('en una recepción PARCIAL, diferenciaVsFactura compara contra esta recepción, no contra el total de toda la orden (regresión de un bug real)', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      // Orden por 20 unidades a 20 c/u = 400 en total.
      const orden = await request(app.getHttpServer())
        .post('/api/compras')
        .set('Authorization', `Bearer ${token}`)
        .send({ proveedorId, numero: 'OC-E2E-PARCIAL', lineas: [{ productoId, cantidad: 20, costoUnitario: 20 }] })
        .expect(201);

      // Primer envío: solo 8 unidades, con una factura del proveedor que
      // corresponde SOLO a esas 8 unidades (160), no a la orden completa (400).
      const primeraRecepcion = await request(app.getHttpServer())
        .post(`/api/compras/${orden.body.id}/recibir`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bodegaId, montoFacturaProveedor: 155, lineas: [{ productoId, cantidadRecibida: 8, costoUnitario: 20 }] })
        .expect(201);

      // Correcto: 8*20=160 (esta recepción) - 155 (factura de esta recepción) = 5.
      // El bug comparaba contra el total de la orden completa (400): 400-155=245.
      expect(primeraRecepcion.body.diferenciaVsFactura).toBe(5);

      const ordenTrasPrimera = await request(app.getHttpServer())
        .get(`/api/compras/${orden.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(ordenTrasPrimera.body.estado).toBe('RECIBIDA_PARCIAL');

      // Segundo envío: las 12 unidades restantes -> completa la orden.
      const segundaRecepcion = await request(app.getHttpServer())
        .post(`/api/compras/${orden.body.id}/recibir`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bodegaId, montoFacturaProveedor: 240, lineas: [{ productoId, cantidadRecibida: 12, costoUnitario: 20 }] })
        .expect(201);

      // 12*20=240 (esta recepción) - 240 (factura de esta recepción) = 0.
      expect(segundaRecepcion.body.diferenciaVsFactura).toBe(0);

      const ordenFinal = await request(app.getHttpServer())
        .get(`/api/compras/${orden.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(ordenFinal.body.estado).toBe('RECIBIDA_TOTAL');
    });

    it(
      'recibir con una línea de producto inexistente falla completa y NO deja aplicada la entrada de stock de la línea anterior que sí era válida (atomicidad)',
      async () => {
        const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

        const orden = await request(app.getHttpServer())
          .post('/api/compras')
          .set('Authorization', `Bearer ${token}`)
          .send({ proveedorId, numero: 'OC-E2E-002', lineas: [{ productoId, cantidad: 5, costoUnitario: 20 }] })
          .expect(201);

        const stockAntes = await prisma.stock.findUnique({ where: { productoId_bodegaId: { productoId, bodegaId } } });

        await request(app.getHttpServer())
          .post(`/api/compras/${orden.body.id}/recibir`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            bodegaId,
            lineas: [
              { productoId, cantidadRecibida: 5, costoUnitario: 20 },
              { productoId: '00000000-0000-0000-0000-000000000000', cantidadRecibida: 1, costoUnitario: 20 },
            ],
          })
          .expect(409); // el producto inexistente viola la FK de linea_recepcion.productoId al crear la recepción, dentro de la transacción

        const stockDespues = await prisma.stock.findUnique({ where: { productoId_bodegaId: { productoId, bodegaId } } });
        expect(Number(stockDespues?.cantidadActual)).toBe(Number(stockAntes?.cantidadActual));
      },
      15_000,
    );

    it('actualiza un proveedor existente', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .patch(`/api/proveedores/${proveedorId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Proveedor E2E Actualizado', telefono: '809-555-0000' })
        .expect(200)
        .expect((res) => {
          expect(res.body.nombre).toBe('Proveedor E2E Actualizado');
          expect(res.body.telefono).toBe('809-555-0000');
        });
    });

    it('actualiza un producto existente', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      await request(app.getHttpServer())
        .patch(`/api/productos/${productoId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Producto Compras E2E Actualizado', categoria: 'General' })
        .expect(200)
        .expect((res) => {
          expect(res.body.nombre).toBe('Producto Compras E2E Actualizado');
          expect(res.body.categoria).toBe('General');
        });
    });
  });

  describe('Pagos de facturas y órdenes de compra', () => {
    let bodegaId: string;
    let productoId: string;
    let proveedorId: string;

    beforeAll(async () => {
      const bodega = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega Pagos E2E' } });
      bodegaId = bodega.id;
      const producto = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-PAGOS', nombre: 'Producto Pagos E2E', porcentajeItbis: 18 },
      });
      productoId = producto.id;
      await prisma.stock.create({ data: { productoId: producto.id, bodegaId: bodega.id, cantidadActual: 100, stockMinimo: 1 } });
      const proveedor = await prisma.proveedor.create({ data: { tenantId: tenantAId, nombre: 'Proveedor Pagos E2E' } });
      proveedorId = proveedor.id;
    });

    it('cobro de una factura a crédito: admite pagos parciales, rechaza exceder el saldo, y marca pagada al completar el total', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const factura = await request(app.getHttpServer())
        .post('/api/facturas')
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: clienteAId, bodegaId, tipoFactura: 'CREDITO', lineas: [{ productoId, cantidad: 1, precioUnitario: 100 }] })
        .expect(201);
      // subtotal 100 + 18% itbis = 118 de total a cobrar

      await request(app.getHttpServer())
        .post(`/api/facturas/${factura.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monto: 50, metodoPago: 'EFECTIVO' })
        .expect(201);

      const trasPrimerPago = await request(app.getHttpServer())
        .get(`/api/facturas/${factura.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(trasPrimerPago.body.pagada).toBe(false);

      // pendiente = 68; pedir 100 debe rechazarse
      await request(app.getHttpServer())
        .post(`/api/facturas/${factura.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monto: 100, metodoPago: 'EFECTIVO' })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/facturas/${factura.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monto: 68, metodoPago: 'TRANSFERENCIA' })
        .expect(201);

      const final = await request(app.getHttpServer())
        .get(`/api/facturas/${factura.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(final.body.pagada).toBe(true);

      const historial = await request(app.getHttpServer())
        .get(`/api/facturas/${factura.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(historial.body.pagos).toHaveLength(2);
      expect(Number(historial.body.totalPagado)).toBe(118);
    });

    it('pago a proveedor: acumula contra el total de la orden de compra y la marca pagada al completarse', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const orden = await request(app.getHttpServer())
        .post('/api/compras')
        .set('Authorization', `Bearer ${token}`)
        .send({ proveedorId, numero: 'OC-PAGO-E2E-001', lineas: [{ productoId, cantidad: 5, costoUnitario: 40 }] })
        .expect(201);
      // total = 200

      await request(app.getHttpServer())
        .post(`/api/compras/${orden.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monto: 150, metodoPago: 'TRANSFERENCIA' })
        .expect(201);

      // pendiente = 50; pedir 100 debe rechazarse
      await request(app.getHttpServer())
        .post(`/api/compras/${orden.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monto: 100, metodoPago: 'TRANSFERENCIA' })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/compras/${orden.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monto: 50, metodoPago: 'EFECTIVO' })
        .expect(201);

      const ordenFinal = await request(app.getHttpServer())
        .get(`/api/compras/${orden.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(ordenFinal.body.pagada).toBe(true);

      const historial = await request(app.getHttpServer())
        .get(`/api/compras/${orden.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(historial.body.pagos).toHaveLength(2);
    });

    it('pago a proveedor con retención de ISR/ITBIS: genera un asiento balanceado y aparece en el reporte de retenciones', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);
      const esperarListener = () => new Promise((resolve) => setTimeout(resolve, 300));

      const orden = await request(app.getHttpServer())
        .post('/api/compras')
        .set('Authorization', `Bearer ${token}`)
        .send({ proveedorId, numero: 'OC-RETENCION-E2E-001', lineas: [{ productoId, cantidad: 10, costoUnitario: 100 }] })
        .expect(201);
      // total = 1000

      const pago = await request(app.getHttpServer())
        .post(`/api/compras/${orden.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monto: 1000, metodoPago: 'TRANSFERENCIA', retencionIsr: 150, retencionItbis: 300 })
        .expect(201);

      // Retención que excede el monto del pago debe rechazarse.
      const otraOrden = await request(app.getHttpServer())
        .post('/api/compras')
        .set('Authorization', `Bearer ${token}`)
        .send({ proveedorId, numero: 'OC-RETENCION-E2E-002', lineas: [{ productoId, cantidad: 1, costoUnitario: 100 }] })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/compras/${otraOrden.body.id}/pagos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monto: 100, metodoPago: 'EFECTIVO', retencionIsr: 80, retencionItbis: 50 })
        .expect(400);

      await esperarListener();

      const asientos = await request(app.getHttpServer())
        .get('/api/contabilidad/asientos')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const asiento = asientos.body.datos.find((a: { origenId: string }) => a.origenId === pago.body.id);
      expect(asiento).toBeDefined();
      const totalDebito = asiento.lineas.reduce((acc: number, l: { debito: string }) => acc + Number(l.debito), 0);
      const totalCredito = asiento.lineas.reduce((acc: number, l: { credito: string }) => acc + Number(l.credito), 0);
      expect(totalDebito).toBe(totalCredito);
      expect(totalDebito).toBe(1000);
      const creditoCaja = asiento.lineas.find((l: { cuentaContable: { codigo: string } }) => l.cuentaContable.codigo === '1010');
      expect(Number(creditoCaja.credito)).toBe(550); // 1000 - 150 (ISR) - 300 (ITBIS)

      const reporte = await request(app.getHttpServer())
        .get('/api/reportes-fiscales/retenciones-proveedores')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const fila = reporte.body.filas.find((f: { netoPagado: number }) => f.netoPagado === 550);
      expect(fila).toBeDefined();
      expect(fila.retencionIsr).toBe(150);
      expect(fila.retencionItbis).toBe(300);
    });

    it('devolución a proveedor: reduce cantidadRecibida, saca stock, y vuelve a RECIBIDA_PARCIAL', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const orden = await request(app.getHttpServer())
        .post('/api/compras')
        .set('Authorization', `Bearer ${token}`)
        .send({ proveedorId, numero: 'OC-DEVOLUCION-E2E-001', lineas: [{ productoId, cantidad: 10, costoUnitario: 20 }] })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/compras/${orden.body.id}/recibir`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bodegaId, lineas: [{ productoId, cantidadRecibida: 10, costoUnitario: 20 }] })
        .expect(201);

      const stockTrasRecibir = await prisma.stock.findUniqueOrThrow({ where: { productoId_bodegaId: { productoId, bodegaId } } });

      // No se puede devolver más de lo recibido.
      await request(app.getHttpServer())
        .post(`/api/compras/${orden.body.id}/devolver`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bodegaId, motivo: 'Mercancía defectuosa', lineas: [{ productoId, cantidad: 99 }] })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/compras/${orden.body.id}/devolver`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bodegaId, motivo: 'Mercancía defectuosa', lineas: [{ productoId, cantidad: 4 }] })
        .expect(201);

      const stockTrasDevolucion = await prisma.stock.findUniqueOrThrow({ where: { productoId_bodegaId: { productoId, bodegaId } } });
      expect(Number(stockTrasDevolucion.cantidadActual)).toBe(Number(stockTrasRecibir.cantidadActual) - 4);

      const ordenActualizada = await request(app.getHttpServer())
        .get(`/api/compras/${orden.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(ordenActualizada.body.estado).toBe('RECIBIDA_PARCIAL');
      expect(Number(ordenActualizada.body.lineas[0].cantidadRecibida)).toBe(6);
      expect(ordenActualizada.body.devoluciones).toHaveLength(1);
    });
  });

  describe('Atomicidad de FacturacionService.crear (todo-o-nada, contra Postgres real)', () => {
    let bodegaId: string;
    let productoConStockId: string;
    let productoSinStockId: string;

    beforeAll(async () => {
      const bodega = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega Atomicidad E2E' } });
      bodegaId = bodega.id;

      const productoConStock = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-ATOM-1', nombre: 'Producto Con Stock E2E', porcentajeItbis: 18 },
      });
      productoConStockId = productoConStock.id;
      await prisma.precio.create({ data: { productoId: productoConStock.id, listaPrecio: 'GENERAL', costo: 50, margenPct: 100, precioVenta: 100 } });
      await prisma.stock.create({ data: { productoId: productoConStock.id, bodegaId: bodega.id, cantidadActual: 10, stockMinimo: 1 } });

      const productoSinStock = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-ATOM-2', nombre: 'Producto Sin Stock E2E', porcentajeItbis: 18 },
      });
      productoSinStockId = productoSinStock.id;
      await prisma.precio.create({ data: { productoId: productoSinStock.id, listaPrecio: 'GENERAL', costo: 50, margenPct: 100, precioVenta: 100 } });
      await prisma.stock.create({ data: { productoId: productoSinStock.id, bodegaId: bodega.id, cantidadActual: 0, stockMinimo: 1 } });
    });

    it(
      'una factura con una línea sin stock suficiente falla completa y NO deja descontado el stock de las líneas anteriores que sí tenían stock',
      async () => {
        const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

        await request(app.getHttpServer())
          .post('/api/facturas')
          .set('Authorization', `Bearer ${token}`)
          .send({
            clienteId: clienteAId,
            bodegaId,
            tipoFactura: 'CONTADO',
            lineas: [
              { productoId: productoConStockId, cantidad: 5 },
              { productoId: productoSinStockId, cantidad: 1 },
            ],
          })
          .expect(400);

        // Antes del fix de atomicidad, esta llamada habría dejado el stock
        // del primer producto en 5 (10 - 5) aunque la factura completa
        // nunca se creó — la línea 1 ya se había descontado en su propia
        // transacción antes de llegar a la línea 2 y fallar.
        const stock = await prisma.stock.findUnique({
          where: { productoId_bodegaId: { productoId: productoConStockId, bodegaId } },
        });
        expect(Number(stock?.cantidadActual)).toBe(10);
      },
      15_000,
    );
  });

  describe('Concurrencia (contra Postgres real, no mocks)', () => {
    let bodegaId: string;
    let productoId: string;
    const CANTIDAD_CONCURRENTE = 10;

    beforeAll(async () => {
      const bodega = await prisma.bodega.create({ data: { tenantId: tenantAId, nombre: 'Bodega Concurrencia E2E' } });
      bodegaId = bodega.id;
      const producto = await prisma.producto.create({
        data: { tenantId: tenantAId, codigo: 'E2E-CONC', nombre: 'Producto Concurrencia E2E', porcentajeItbis: 18 },
      });
      productoId = producto.id;
      await prisma.precio.create({
        data: { productoId: producto.id, listaPrecio: 'GENERAL', costo: 50, margenPct: 100, precioVenta: 100 },
      });
      await prisma.stock.create({
        data: { productoId: producto.id, bodegaId: bodega.id, cantidadActual: CANTIDAD_CONCURRENTE, stockMinimo: 1 },
      });
    });

    it(
      `${CANTIDAD_CONCURRENTE} facturas creadas en paralelo reciben NCF únicos (regresión: el incremento en JS podía duplicar NCF bajo concurrencia)`,
      async () => {
        const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

        const respuestas = await Promise.all(
          Array.from({ length: CANTIDAD_CONCURRENTE }, () =>
            request(app.getHttpServer())
              .post('/api/facturas')
              .set('Authorization', `Bearer ${token}`)
              .send({ clienteId: clienteAId, bodegaId, tipoFactura: 'CONTADO', lineas: [{ productoId, cantidad: 1 }] }),
          ),
        );

        respuestas.forEach((r) => expect(r.status).toBe(201));
        const ncfs = respuestas.map((r) => r.body.ncf);
        expect(new Set(ncfs).size).toBe(CANTIDAD_CONCURRENTE);

        // El stock (10 unidades) solo alcanza para las 10 ventas de este
        // test si ninguna pisó el NCF/stock de otra — confirma también que
        // verificarYDescontarStock no dejó pasar más ventas de las que había.
        const stock = await prisma.stock.findUnique({ where: { productoId_bodegaId: { productoId, bodegaId } } });
        expect(Number(stock?.cantidadActual)).toBe(0);

        // Los asientos contables automáticos (listener fire-and-forget, un
        // aggregate MAX(numero)+1 por cada uno) también corren concurrentes
        // entre sí — confirma que el reintento ante P2002 no dejó ninguno
        // sin generar (regresión: antes, una colisión de "numero" tumbaba
        // el asiento entero sin reintentar, solo lo logueaba).
        await new Promise((resolve) => setTimeout(resolve, 800));
        const facturaIds = new Set(respuestas.map((r) => r.body.id));
        const asientos = await request(app.getHttpServer())
          .get('/api/contabilidad/asientos')
          .query({ tamanoPagina: 200 })
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const asientosDeEstaCorrida = asientos.body.datos.filter((a: { origenId: string }) => facturaIds.has(a.origenId));
        expect(asientosDeEstaCorrida).toHaveLength(CANTIDAD_CONCURRENTE);
        const numeros = asientosDeEstaCorrida.map((a: { numero: number }) => a.numero);
        expect(new Set(numeros).size).toBe(CANTIDAD_CONCURRENTE);
      },
      20_000,
    );
  });

  describe('Búsqueda y paginación', () => {
    beforeAll(async () => {
      await prisma.cliente.createMany({
        data: [
          { tenantId: tenantAId, nombre: 'Zapatería Paginación Uno' },
          { tenantId: tenantAId, nombre: 'Zapatería Paginación Dos' },
        ],
      });
    });

    it('respeta tamanoPagina y devuelve el total real, no solo la página actual', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/clientes')
        .query({ pagina: 1, tamanoPagina: 1 })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.datos).toHaveLength(1);
      expect(respuesta.body.total).toBeGreaterThanOrEqual(3);
      expect(respuesta.body.pagina).toBe(1);
      expect(respuesta.body.tamanoPagina).toBe(1);
    });

    it('busqueda filtra por nombre', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/clientes')
        .query({ busqueda: 'Paginación Uno' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.datos).toHaveLength(1);
      expect(respuesta.body.datos[0].nombre).toBe('Zapatería Paginación Uno');
    });

    it('busqueda sin coincidencias devuelve datos vacíos y total 0', async () => {
      const token = await login('admin@e2e-a.com', SUBDOMINIO_A);

      const respuesta = await request(app.getHttpServer())
        .get('/api/clientes')
        .query({ busqueda: 'esto-no-existe-en-ningun-cliente' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(respuesta.body.datos).toEqual([]);
      expect(respuesta.body.total).toBe(0);
    });
  });

  describe('Recuperación de contraseña (tenant)', () => {
    const emailReset = 'reset@e2e-a.com';

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash(PASSWORD, 10);
      await prisma.user.create({ data: { tenantId: tenantAId, email: emailReset, nombre: 'Reset E2E', passwordHash } });
    });

    it('el flujo completo: solicitar reset, canjear el token, loguear con la nueva contraseña', async () => {
      const emailChannel = app.get(EmailChannel);
      const spy = jest.spyOn(emailChannel, 'enviar').mockResolvedValue(true);

      await request(app.getHttpServer())
        .post('/api/auth/password/olvide')
        .send({ email: emailReset, tenantSubdominio: SUBDOMINIO_A })
        .expect(201);

      const cuerpoHtml = spy.mock.calls[0][2] as string;
      const token = extraerTokenDeReset(cuerpoHtml);
      const nuevaPassword = 'NuevaClave456!';

      await request(app.getHttpServer())
        .post('/api/auth/password/restablecer')
        .send({ token, tenantSubdominio: SUBDOMINIO_A, password: nuevaPassword })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: emailReset, password: PASSWORD, tenantSubdominio: SUBDOMINIO_A })
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: emailReset, password: nuevaPassword, tenantSubdominio: SUBDOMINIO_A })
        .expect(201);

      spy.mockRestore();
    });

    it('rechaza un token ya canjeado (de un solo uso)', async () => {
      const emailChannel = app.get(EmailChannel);
      const spy = jest.spyOn(emailChannel, 'enviar').mockResolvedValue(true);

      await request(app.getHttpServer())
        .post('/api/auth/password/olvide')
        .send({ email: emailReset, tenantSubdominio: SUBDOMINIO_A })
        .expect(201);
      const token = extraerTokenDeReset(spy.mock.calls[spy.mock.calls.length - 1][2] as string);
      spy.mockRestore();

      await request(app.getHttpServer())
        .post('/api/auth/password/restablecer')
        .send({ token, tenantSubdominio: SUBDOMINIO_A, password: 'OtraClave789!' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/password/restablecer')
        .send({ token, tenantSubdominio: SUBDOMINIO_A, password: 'Intento2Clave!' })
        .expect(400);
    });

    it('responde 201 genérico aunque el email no exista (no filtra qué correos están registrados)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/password/olvide')
        .send({ email: 'no-existe@e2e-a.com', tenantSubdominio: SUBDOMINIO_A })
        .expect(201);
    });

    it('un token emitido para el tenant A no sirve para restablecer en el tenant B', async () => {
      const emailChannel = app.get(EmailChannel);
      const spy = jest.spyOn(emailChannel, 'enviar').mockResolvedValue(true);

      await request(app.getHttpServer())
        .post('/api/auth/password/olvide')
        .send({ email: emailReset, tenantSubdominio: SUBDOMINIO_A })
        .expect(201);
      const token = extraerTokenDeReset(spy.mock.calls[spy.mock.calls.length - 1][2] as string);
      spy.mockRestore();

      await request(app.getHttpServer())
        .post('/api/auth/password/restablecer')
        .send({ token, tenantSubdominio: SUBDOMINIO_B, password: 'Intento123!' })
        .expect(400);
    });
  });

  describe('Módulos activos por plan (ModuloActivoGuard)', () => {
    let moduloPosId: string;
    let planSinPosId: string;
    let planConPosId: string;
    let tenantSinPosId: string;
    let tenantConPosId: string;
    let tokenSinPos: string;
    let tokenConPos: string;

    beforeAll(async () => {
      const moduloPos = await prisma.modulo.upsert({
        where: { clave: 'pos' },
        update: {},
        create: { clave: 'pos', nombre: 'Punto de venta' },
      });
      moduloPosId = moduloPos.id;
      const moduloFacturacion = await prisma.modulo.upsert({
        where: { clave: 'facturacion' },
        update: {},
        create: { clave: 'facturacion', nombre: 'Facturación' },
      });

      const planSinPos = await prisma.plan.upsert({
        where: { nombre: 'E2E Básico Sin POS' },
        update: {},
        create: { nombre: 'E2E Básico Sin POS' },
      });
      planSinPosId = planSinPos.id;
      await prisma.planModulo.deleteMany({ where: { planId: planSinPosId } });
      await prisma.planModulo.create({ data: { planId: planSinPosId, moduloId: moduloFacturacion.id } });

      const planConPos = await prisma.plan.upsert({
        where: { nombre: 'E2E Premium Con POS' },
        update: {},
        create: { nombre: 'E2E Premium Con POS' },
      });
      planConPosId = planConPos.id;
      await prisma.planModulo.deleteMany({ where: { planId: planConPosId } });
      await prisma.planModulo.createMany({
        data: [
          { planId: planConPosId, moduloId: moduloFacturacion.id },
          { planId: planConPosId, moduloId: moduloPosId },
        ],
      });

      // 'pos.ver'/'contabilidad.ver' ya fueron sembrados por crearPermisos() más arriba.
      const permisoPosVer = await prisma.permission.findUniqueOrThrow({ where: { clave: 'pos.ver' } });
      const permisoContabilidadVer = await prisma.permission.findUniqueOrThrow({ where: { clave: 'contabilidad.ver' } });
      const passwordHash = await bcrypt.hash(PASSWORD, 10);

      const tenantSinPos = await prisma.tenant.create({
        data: { nombre: 'E2E Tenant Sin POS', subdominio: 'e2e-tenant-sin-pos', planId: planSinPosId },
      });
      tenantSinPosId = tenantSinPos.id;
      const rolSinPos = await prisma.role.create({ data: { tenantId: tenantSinPosId, nombre: 'RolSinPos' } });
      await prisma.rolePermission.createMany({
        data: [
          { roleId: rolSinPos.id, permissionId: permisoPosVer.id },
          { roleId: rolSinPos.id, permissionId: permisoContabilidadVer.id },
        ],
      });
      const usuarioSinPos = await prisma.user.create({
        data: { tenantId: tenantSinPosId, email: 'admin@e2e-sin-pos.com', nombre: 'Admin', passwordHash },
      });
      await prisma.userRole.create({ data: { userId: usuarioSinPos.id, roleId: rolSinPos.id } });

      const tenantConPos = await prisma.tenant.create({
        data: { nombre: 'E2E Tenant Con POS', subdominio: 'e2e-tenant-con-pos', planId: planConPosId },
      });
      tenantConPosId = tenantConPos.id;
      const rolConPos = await prisma.role.create({ data: { tenantId: tenantConPosId, nombre: 'RolConPos' } });
      await prisma.rolePermission.createMany({
        data: [
          { roleId: rolConPos.id, permissionId: permisoPosVer.id },
          { roleId: rolConPos.id, permissionId: permisoContabilidadVer.id },
        ],
      });
      const usuarioConPos = await prisma.user.create({
        data: { tenantId: tenantConPosId, email: 'admin@e2e-con-pos.com', nombre: 'Admin', passwordHash },
      });
      await prisma.userRole.create({ data: { userId: usuarioConPos.id, roleId: rolConPos.id } });

      tokenSinPos = await login('admin@e2e-sin-pos.com', 'e2e-tenant-sin-pos');
      tokenConPos = await login('admin@e2e-con-pos.com', 'e2e-tenant-con-pos');
    });

    afterAll(async () => {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantSinPosId, tenantConPosId] } } });
    });

    it('un tenant con un plan que no incluye POS recibe 403 al acceder a /pos/*', async () => {
      await request(app.getHttpServer())
        .get('/api/pos/turnos')
        .set('Authorization', `Bearer ${tokenSinPos}`)
        .expect(403);
    });

    it('Contabilidad sigue accesible aunque el plan del tenant no incluya POS (nunca gateable)', async () => {
      await request(app.getHttpServer())
        .get('/api/contabilidad/cuentas')
        .set('Authorization', `Bearer ${tokenSinPos}`)
        .expect(200);
    });

    it('una excepción pos:true habilita el módulo sin cambiar de plan', async () => {
      await prisma.tenantModuloOverride.upsert({
        where: { tenantId_moduloId: { tenantId: tenantSinPosId, moduloId: moduloPosId } },
        update: { activo: true },
        create: { tenantId: tenantSinPosId, moduloId: moduloPosId, activo: true },
      });

      await request(app.getHttpServer())
        .get('/api/pos/turnos')
        .set('Authorization', `Bearer ${tokenSinPos}`)
        .expect(200);
    });

    it('un tenant con un plan que incluye POS puede acceder desde el inicio', async () => {
      await request(app.getHttpServer())
        .get('/api/pos/turnos')
        .set('Authorization', `Bearer ${tokenConPos}`)
        .expect(200);
    });
  });
});
