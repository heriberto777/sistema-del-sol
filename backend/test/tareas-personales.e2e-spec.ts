import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * "Mis Tareas" es personal — el riesgo real acá no es tanto cross-tenant
 * (ya cubierto en todo el resto del proyecto vía TenantPrismaService)
 * sino CROSS-USER dentro del MISMO tenant: dos compañeros de la misma
 * empresa nunca deben ver la lista de tareas del otro. Ese filtro lo
 * hace a mano TareasPersonalesRepository (no hay ningún guard genérico
 * que lo resuelva solo), así que necesita su propio test end-to-end.
 */
describe('Mis Tareas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const SUBDOMINIO = 'e2e-mis-tareas';
  const PASSWORD = 'Test1234!';

  let tenantId: string;
  let tareaAId: string;
  let comentarioAId: string;

  async function login(email: string) {
    const respuesta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD, tenantSubdominio: SUBDOMINIO });
    return respuesta.body.accessToken as string;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();

    const modulo = await prisma.modulo.upsert({
      where: { clave: 'mistareas' },
      update: {},
      create: { clave: 'mistareas', nombre: 'Mis Tareas' },
    });
    const plan = await prisma.plan.upsert({
      where: { nombre: 'E2E Mis Tareas' },
      update: {},
      create: { nombre: 'E2E Mis Tareas' },
    });
    await prisma.planModulo.upsert({
      where: { planId_moduloId: { planId: plan.id, moduloId: modulo.id } },
      update: {},
      create: { planId: plan.id, moduloId: modulo.id },
    });
    const tenant = await prisma.tenant.create({ data: { nombre: 'E2E Mis Tareas', subdominio: SUBDOMINIO, planId: plan.id } });
    tenantId = tenant.id;

    const rol = await prisma.role.create({ data: { tenantId, nombre: 'Cualquiera' } });
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const usuarioA = await prisma.user.create({ data: { tenantId, email: 'a@e2e-mis-tareas.com', nombre: 'Usuario A', passwordHash } });
    await prisma.userRole.create({ data: { userId: usuarioA.id, roleId: rol.id } });

    const usuarioB = await prisma.user.create({ data: { tenantId, email: 'b@e2e-mis-tareas.com', nombre: 'Usuario B', passwordHash } });
    await prisma.userRole.create({ data: { userId: usuarioB.id, roleId: rol.id } });

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

  it('el usuario A crea una tarea con etiquetas y la ve en su propia lista', async () => {
    const token = await login('a@e2e-mis-tareas.com');

    const respuesta = await request(app.getHttpServer())
      .post('/api/admin/mis-tareas')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'Llamar al proveedor de insumos', etiquetas: ['Proveedores', 'Urgente'] })
      .expect(201);

    tareaAId = respuesta.body.id;
    expect(respuesta.body.etiquetas).toEqual(['Proveedores', 'Urgente']);

    const lista = await request(app.getHttpServer())
      .get('/api/admin/mis-tareas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(lista.body.map((t: { id: string }) => t.id)).toContain(tareaAId);
  });

  it('crear una tarea sin etiquetas (alta rápida) no revienta — queda con []', async () => {
    const token = await login('a@e2e-mis-tareas.com');

    const respuesta = await request(app.getHttpServer())
      .post('/api/admin/mis-tareas')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'Tarea sin etiquetas' })
      .expect(201);

    expect(respuesta.body.etiquetas).toEqual([]);

    await request(app.getHttpServer())
      .delete(`/api/admin/mis-tareas/${respuesta.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('se puede pasar la tarea a EN_ESPERA sin que se marque como completada', async () => {
    const token = await login('a@e2e-mis-tareas.com');

    const respuesta = await request(app.getHttpServer())
      .patch(`/api/admin/mis-tareas/${tareaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'EN_ESPERA' })
      .expect(200);

    expect(respuesta.body.estado).toBe('EN_ESPERA');
    expect(respuesta.body.completadaEn).toBeNull();
  });

  it('el usuario B (mismo tenant) NO ve la tarea de A en su lista', async () => {
    const token = await login('b@e2e-mis-tareas.com');

    const lista = await request(app.getHttpServer())
      .get('/api/admin/mis-tareas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(lista.body.map((t: { id: string }) => t.id)).not.toContain(tareaAId);
  });

  it('el usuario B no puede leer la tarea de A por id directo', async () => {
    const token = await login('b@e2e-mis-tareas.com');

    await request(app.getHttpServer())
      .get(`/api/admin/mis-tareas/${tareaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('el usuario B no puede editar la tarea de A (y no queda modificada)', async () => {
    const token = await login('b@e2e-mis-tareas.com');

    await request(app.getHttpServer())
      .patch(`/api/admin/mis-tareas/${tareaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'Secuestrada por B' })
      .expect(404);

    const tarea = await prisma.tareaPersonal.findUniqueOrThrow({ where: { id: tareaAId } });
    expect(tarea.titulo).toBe('Llamar al proveedor de insumos');
  });

  it('el usuario B no puede eliminar la tarea de A (y sigue existiendo)', async () => {
    const token = await login('b@e2e-mis-tareas.com');

    await request(app.getHttpServer())
      .delete(`/api/admin/mis-tareas/${tareaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    await prisma.tareaPersonal.findUniqueOrThrow({ where: { id: tareaAId } });
  });

  it('el usuario B no puede comentar en la tarea de A', async () => {
    const token = await login('b@e2e-mis-tareas.com');

    await request(app.getHttpServer())
      .post(`/api/admin/mis-tareas/${tareaAId}/comentarios`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contenido: 'Intento de B' })
      .expect(404);
  });

  it('el usuario A comenta en su propia tarea, con texto y una imagen', async () => {
    const token = await login('a@e2e-mis-tareas.com');

    const respuesta = await request(app.getHttpServer())
      .post(`/api/admin/mis-tareas/${tareaAId}/comentarios`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        contenido: 'Ya llamé, ```const x = 1;``` llegan el jueves.',
        imagenes: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='],
      })
      .expect(201);

    comentarioAId = respuesta.body.id;
    expect(respuesta.body.imagenes).toHaveLength(1);
  });

  it('el usuario B no puede eliminar el comentario de A', async () => {
    const token = await login('b@e2e-mis-tareas.com');

    await request(app.getHttpServer())
      .delete(`/api/admin/mis-tareas/comentarios/${comentarioAId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('el usuario B no puede editar el comentario de A (y el texto no cambia)', async () => {
    const token = await login('b@e2e-mis-tareas.com');

    await request(app.getHttpServer())
      .patch(`/api/admin/mis-tareas/comentarios/${comentarioAId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contenido: 'Secuestrado por B' })
      .expect(404);

    const comentario = await prisma.comentarioTareaPersonal.findUniqueOrThrow({ where: { id: comentarioAId } });
    expect(comentario.contenido).toContain('Ya llamé');
  });

  it('el usuario A edita su propio comentario', async () => {
    const token = await login('a@e2e-mis-tareas.com');

    const respuesta = await request(app.getHttpServer())
      .patch(`/api/admin/mis-tareas/comentarios/${comentarioAId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contenido: 'Texto corregido — llegan el viernes.' })
      .expect(200);

    expect(respuesta.body.contenido).toBe('Texto corregido — llegan el viernes.');
  });

  it('marcar la tarea como HECHA completa completadaEn; reabrirla lo limpia', async () => {
    const token = await login('a@e2e-mis-tareas.com');

    const hecha = await request(app.getHttpServer())
      .patch(`/api/admin/mis-tareas/${tareaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'HECHA' })
      .expect(200);
    expect(hecha.body.completadaEn).not.toBeNull();

    const reabierta = await request(app.getHttpServer())
      .patch(`/api/admin/mis-tareas/${tareaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'PENDIENTE' })
      .expect(200);
    expect(reabierta.body.completadaEn).toBeNull();
  });

  it('el usuario A elimina su propia tarea', async () => {
    const token = await login('a@e2e-mis-tareas.com');

    await request(app.getHttpServer())
      .delete(`/api/admin/mis-tareas/${tareaAId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
