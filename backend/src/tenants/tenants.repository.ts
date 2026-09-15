import { Injectable } from '@nestjs/common';
import { EstadoTenant, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISOS_BASE, ROLES_BASE, CONFIGURACIONES_BASE } from './roles-base';
import { CUENTAS_BASE } from '../contabilidad/cuentas-base';
import { FORMAS_PAGO_BASE } from './formas-pago-base';
import { LISTAS_PRECIO_BASE } from './listas-precio-base';
import { TIPOS_AUSENCIA_CONFIG_BASE } from './tipos-ausencia-config-base';
import { CORRELATIVOS_BASE } from './correlativos-base';
import { PLANTILLAS_PUBLICACIONES_SOCIALES_BASE } from '../notificaciones/plantillas-publicaciones-sociales-base';
import { PLANTILLAS_COMENTARIOS_TAREA_BASE } from '../notificaciones/plantillas-comentarios-tarea-base';
import { PLANTILLAS_VENCIMIENTO_TAREAS_BASE } from '../notificaciones/plantillas-vencimiento-tareas-base';
import { ModoReseteoTenant } from './dto/resetear-tenant.dto';

@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: 'desc' }, include: { plan: true } });
  }

  buscarPorId(id: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id } });
  }

  async actualizar(
    id: string,
    data: {
      nombre?: string;
      estado?: EstadoTenant;
      planId?: string;
      rnc?: string;
      subdominio?: string;
      direccion?: string;
      telefono?: string;
      email?: string;
      logo?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({ where: { id }, data });
      // Si cambia de plan, la suscripción debe cobrar el precio del plan
      // nuevo desde la próxima factura — no tocar fechaProximoCorte, solo
      // qué plan factura.
      if (data.planId) {
        await tx.suscripcion.updateMany({ where: { tenantId: id }, data: { planId: data.planId } });
      }
      return tenant;
    });
  }

  /**
   * Provisioning completo de un tenant nuevo: catálogo de permisos (idempotente,
   * por si nunca se corrió el seed global), tenant + settings + configuración
   * por defecto, los roles base con sus permisos, y el usuario administrador
   * inicial. Todo en una sola transacción — o se crea completo, o no se crea
   * nada.
   */
  async crearConProvisioning(params: {
    nombre: string;
    subdominio: string;
    rnc?: string;
    direccion?: string;
    telefono?: string;
    email?: string;
    logo?: string;
    planId: string;
    adminEmail: string;
    adminNombre: string;
    adminPasswordHash: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      for (const clave of PERMISOS_BASE) {
        await tx.permission.upsert({ where: { clave }, update: {}, create: { clave } });
      }

      const tenant = await tx.tenant.create({
        data: {
          nombre: params.nombre,
          subdominio: params.subdominio,
          rnc: params.rnc,
          direccion: params.direccion,
          telefono: params.telefono,
          email: params.email,
          logo: params.logo,
          planId: params.planId,
          settings: { create: {} },
          configuraciones: {
            create: Object.entries(CONFIGURACIONES_BASE).map(([clave, valor]) => ({ clave, valor })),
          },
          // Home 100% dinámico (Fase 18) — sin esto, un tenant nuevo
          // vería la Tienda vacía entre Nav y Footer hasta que alguien
          // entre a "Secciones del Home" a crear algo. Título/subtítulo
          // genéricos, editables desde el día uno.
          seccionesTienda: {
            create: [
              { tipo: 'HERO', titulo: params.nombre, subtitulo: 'Bienvenido a nuestra tienda', orden: 0 },
              { tipo: 'DESTACADOS', titulo: 'Destacados', orden: 1 },
              { tipo: 'OFERTAS', titulo: 'Ofertas', orden: 2 },
            ],
          },
        },
      });

      // fechaProximoCorte: hoy — la primera factura sale en el próximo
      // tick del cron de facturación de plataforma, sin período de gracia.
      await tx.suscripcion.create({
        data: { tenantId: tenant.id, planId: params.planId, fechaProximoCorte: new Date() },
      });

      await tx.cuentaContable.createMany({
        data: CUENTAS_BASE.map((c) => ({
          tenantId: tenant.id,
          codigo: c.codigo,
          nombre: c.nombre,
          tipo: c.tipo,
          naturaleza: c.naturaleza,
        })),
      });

      // Cliente genérico para POS — ver ClientesController.consumidorFinal.
      await tx.cliente.create({
        data: { tenantId: tenant.id, nombre: 'Consumidor Final', esConsumidorFinal: true },
      });

      await tx.formaPago.createMany({
        data: FORMAS_PAGO_BASE.map((f) => ({ tenantId: tenant.id, ...f })),
      });

      await tx.listaPrecio.createMany({
        data: LISTAS_PRECIO_BASE.map((l) => ({ tenantId: tenant.id, ...l })),
      });

      await tx.tipoAusenciaConfig.createMany({
        data: TIPOS_AUSENCIA_CONFIG_BASE.map((c) => ({ tenantId: tenant.id, ...c })),
      });

      await tx.correlativo.createMany({
        data: CORRELATIVOS_BASE.map((tipo) => ({ tenantId: tenant.id, tipo })),
      });

      // Fase 5 (Publicaciones Sociales) — contenido real por defecto, no
      // en blanco (ver el comentario de PLANTILLAS_PUBLICACIONES_SOCIALES_BASE).
      await tx.notificacionPlantilla.createMany({
        data: PLANTILLAS_PUBLICACIONES_SOCIALES_BASE.map((p) => ({ tenantId: tenant.id, ...p })),
      });

      // Fase 8 (Comentarios de tarea) — mismo criterio, ver el comentario
      // de PLANTILLAS_COMENTARIOS_TAREA_BASE.
      await tx.notificacionPlantilla.createMany({
        data: PLANTILLAS_COMENTARIOS_TAREA_BASE.map((p) => ({ tenantId: tenant.id, ...p })),
      });

      // Aviso de "hoy vence" (Mis Tareas + tareas de Proyectos) — mismo criterio.
      await tx.notificacionPlantilla.createMany({
        data: PLANTILLAS_VENCIMIENTO_TAREAS_BASE.map((p) => ({ tenantId: tenant.id, ...p })),
      });

      let adminRoleId: string | undefined;
      for (const [nombreRol, permisos] of Object.entries(ROLES_BASE)) {
        const rol = await tx.role.create({
          data: { tenantId: tenant.id, nombre: nombreRol, esSistema: true },
        });
        if (nombreRol === 'Admin Total') adminRoleId = rol.id;

        for (const clave of permisos) {
          const permiso = await tx.permission.findUniqueOrThrow({ where: { clave } });
          await tx.rolePermission.create({ data: { roleId: rol.id, permissionId: permiso.id } });
        }
      }

      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: params.adminEmail,
          nombre: params.adminNombre,
          passwordHash: params.adminPasswordHash,
        },
      });
      await tx.userRole.create({ data: { userId: adminUser.id, roleId: adminRoleId! } });

      return tenant;
    });
  }

  /**
   * Pedido del usuario (2026-09-10) — "reiniciar el sistema" de UN tenant
   * puntual, en dos modos, todo en una sola transacción (o se resetea
   * completo, o no se toca nada). Corre con `PrismaService` global (no
   * `TenantPrismaService`, que es request-scoped de tenant): esto es una
   * operación de PLATAFORMA sobre un tenant ajeno.
   *
   * En los dos modos se preserva siempre: el `Tenant` en sí, sus `User`
   * (logins), y todo lo de Suscripción/Facturación de PLATAFORMA (eso es
   * lo que la plataforma le cobra al tenant, un eje totalmente aparte de
   * sus propios datos de negocio). También quedan intactos, en ambos
   * modos, los catálogos de "infraestructura física/organizativa" que no
   * tiene sentido regenerar (Sucursal/Bodega/Caja, Puesto/PlantillaHorario/
   * Feriado, TasaCambio, CategoriaCliente, Oferta/ConfiguracionLealtad,
   * TenantModuloOverride/TenantDominio, WhatsappConfigTenant/
   * PasarelaConfigTenant/TenantSettings).
   *
   * TRANSACCIONAL: borra todo lo "generado" (documentos y su actividad) —
   * ver `borrarDatosTransaccionalesEnTx`. COMPLETO: TRANSACCIONAL +
   * vacía Productos/Clientes/Empleados y reinicia a los valores base
   * Roles/Permisos, Cuentas contables, Formas de pago, Listas de precio,
   * Correlativos, Configuración, Tipos de ausencia, Plantillas de
   * notificación y Secciones del Home — exactamente el mismo catálogo que
   * `crearConProvisioning` siembra para un tenant nuevo (ver
   * `reiniciarCatalogosBaseEnTx`). `NcfAsignado` se vacía SIN recrear: son
   * rangos reales asignados por la DGII a esta empresa, no hay una
   * secuencia "base" genérica que inventar — el tenant debe volver a
   * cargar sus rangos reales.
   */
  async resetear(tenantId: string, modo: ModoReseteoTenant) {
    return this.prisma.$transaction(
      async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
        await this.borrarDatosTransaccionalesEnTx(tx, tenantId);
        if (modo === 'COMPLETO') {
          await this.reiniciarCatalogosBaseEnTx(tx, tenantId, tenant.nombre);
        }
        return { tenantId, modo };
      },
      { timeout: 60_000 },
    );
  }

  /** Ver el comentario completo en `resetear`. Orden pensado para no violar
   * ninguna FK: lo que tiene una referencia OPCIONAL a Factura/AjusteInventario
   * sin `onDelete` explícito (Cotizacion/Remisión/HitoProyecto/ConteoFisico)
   * se borra ANTES que su destino, sin depender de qué acción por default
   * haya elegido Prisma para esas columnas. */
  private async borrarDatosTransaccionalesEnTx(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.cotizacion.deleteMany({ where: { tenantId } });
    await tx.remision.deleteMany({ where: { tenantId } });
    await tx.movimientoLealtad.deleteMany({ where: { tenantId } });
    await tx.comisionVenta.deleteMany({ where: { tenantId } });
    // Cascada: HitoProyecto, TareaProyecto (+ComentarioTareaProyecto,
    // SesionTrabajoTarea, TareaProyectoResponsable, RegistroHoraProyecto).
    await tx.proyecto.deleteMany({ where: { tenantId } });
    await tx.conteoFisico.deleteMany({ where: { tenantId } });
    await tx.ajusteInventario.deleteMany({ where: { tenantId } });
    await tx.transferenciaInventario.deleteMany({ where: { tenantId } });
    await tx.movimientoInventario.deleteMany({ where: { tenantId } });
    // Cascada: LineaOc, RecepcionCompra(+LineaRecepcion), DevolucionCompra(+LineaDevolucionCompra).
    await tx.ordenCompra.deleteMany({ where: { tenantId } });
    await tx.pago.deleteMany({ where: { tenantId } });
    // Cascada: LineaFactura, FacturaRecargo, PagoVenta.
    await tx.factura.deleteMany({ where: { tenantId } });
    // Cascada: LineaAsiento, PeriodoContableCerrado.
    await tx.asientoContable.deleteMany({ where: { tenantId } });
    // Cascada: LineaGastoMenor.
    await tx.gastoMenor.deleteMany({ where: { tenantId } });
    // Cascada: ReciboNomina.
    await tx.periodoNomina.deleteMany({ where: { tenantId } });
    await tx.registroAsistencia.deleteMany({ where: { tenantId } });
    await tx.ausencia.deleteMany({ where: { tenantId } });
    // Cascada: MovimientoCaja, VentaAparcada(+VentaAparcadaLinea), CarritoBorrador.
    await tx.turnoCaja.deleteMany({ where: { tenantId } });
    await tx.pedidoTienda.deleteMany({ where: { tenantId } });
    await tx.sesionCobroFactura.deleteMany({ where: { tenantId } });

    // Sin tenantId propio (se resuelve por clienteId) — los clientes en sí
    // se preservan siempre acá (solo se vacían en modo COMPLETO, después).
    const clientes = await tx.cliente.findMany({ where: { tenantId }, select: { id: true } });
    if (clientes.length > 0) {
      await tx.carritoClienteTienda.deleteMany({ where: { clienteId: { in: clientes.map((c) => c.id) } } });
    }

    // Cascada: PublicacionSocialVersion.
    await tx.publicacionSocial.deleteMany({ where: { tenantId } });
    await tx.whatsappMensaje.deleteMany({ where: { tenantId } });
    await tx.notificacion.deleteMany({ where: { tenantId } });
    await tx.auditLog.deleteMany({ where: { tenantId } });

    // Sin tenantId propio — el Webhook (configuración) se preserva, solo se
    // borra su historial de entregas.
    const webhooks = await tx.webhook.findMany({ where: { tenantId }, select: { id: true } });
    if (webhooks.length > 0) {
      await tx.webhookDelivery.deleteMany({ where: { webhookId: { in: webhooks.map((w) => w.id) } } });
    }

    await tx.bono.deleteMany({ where: { tenantId } });
    await tx.codigoAutorizacion.deleteMany({ where: { tenantId } });
  }

  /** Ver el comentario completo en `resetear`. Solo se llama en modo COMPLETO,
   * después de `borrarDatosTransaccionalesEnTx` (con eso ya limpio, no queda
   * ninguna Factura/Cotización/etc. que bloquee borrar Cliente/Producto). */
  private async reiniciarCatalogosBaseEnTx(tx: Prisma.TransactionClient, tenantId: string, nombreTenant: string) {
    await tx.empleado.deleteMany({ where: { tenantId } });

    await tx.cliente.deleteMany({ where: { tenantId } });
    // Ver ClientesController.consumidorFinal — el POS lo necesita siempre.
    await tx.cliente.create({ data: { tenantId, nombre: 'Consumidor Final', esConsumidorFinal: true } });

    // Categoria/Atributo/LeyFiscal no cascadean DESDE Producto (la FK va al
    // revés) — hay que vaciarlos aparte.
    await tx.producto.deleteMany({ where: { tenantId } });
    await tx.categoria.deleteMany({ where: { tenantId } });
    await tx.atributo.deleteMany({ where: { tenantId } });
    await tx.leyFiscal.deleteMany({ where: { tenantId } });

    // Reiniciar Roles reasigna sus permisos a los base — pero borrar el Role
    // también borra (cascada) los UserRole existentes. Se captura antes qué
    // rol (por NOMBRE) tenía cada usuario para reasignarlo después de
    // recrear los roles base — un usuario cuyo ÚNICO rol era uno
    // personalizado (fuera de ROLES_BASE) queda sin rol, consecuencia
    // inevitable de "reiniciar desde cero" (avisada en el modal de
    // confirmación del frontend).
    const asignacionesPrevias = await tx.userRole.findMany({
      where: { role: { tenantId } },
      select: { userId: true, role: { select: { nombre: true } } },
    });
    await tx.role.deleteMany({ where: { tenantId } });
    const nuevoRoleIdPorNombre: Record<string, string> = {};
    for (const [nombreRol, permisos] of Object.entries(ROLES_BASE)) {
      const rol = await tx.role.create({ data: { tenantId, nombre: nombreRol, esSistema: true } });
      nuevoRoleIdPorNombre[nombreRol] = rol.id;
      for (const clave of permisos) {
        const permiso = await tx.permission.findUniqueOrThrow({ where: { clave } });
        await tx.rolePermission.create({ data: { roleId: rol.id, permissionId: permiso.id } });
      }
    }
    for (const { userId, role } of asignacionesPrevias) {
      const nuevoRoleId = nuevoRoleIdPorNombre[role.nombre];
      if (nuevoRoleId) {
        await tx.userRole.create({ data: { userId, roleId: nuevoRoleId } });
      }
    }

    // Cascada: CuentaBancaria (el tenant debe volver a cargar sus cuentas
    // bancarias reales — no hay catálogo base de bancos que recrear).
    await tx.cuentaContable.deleteMany({ where: { tenantId } });
    await tx.cuentaContable.createMany({
      data: CUENTAS_BASE.map((c) => ({ tenantId, codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, naturaleza: c.naturaleza })),
    });

    await tx.formaPago.deleteMany({ where: { tenantId } });
    await tx.formaPago.createMany({ data: FORMAS_PAGO_BASE.map((f) => ({ tenantId, ...f })) });

    await tx.listaPrecio.deleteMany({ where: { tenantId } });
    await tx.listaPrecio.createMany({ data: LISTAS_PRECIO_BASE.map((l) => ({ tenantId, ...l })) });

    await tx.correlativo.deleteMany({ where: { tenantId } });
    await tx.correlativo.createMany({ data: CORRELATIVOS_BASE.map((tipo) => ({ tenantId, tipo })) });

    // Sin recrear — rangos reales asignados por la DGII, no hay un genérico
    // que inventar. El tenant debe volver a configurarlos.
    await tx.ncfAsignado.deleteMany({ where: { tenantId } });

    await tx.configuracion.deleteMany({ where: { tenantId } });
    await tx.configuracion.createMany({
      data: Object.entries(CONFIGURACIONES_BASE).map(([clave, valor]) => ({ tenantId, clave, valor })),
    });

    await tx.tipoAusenciaConfig.deleteMany({ where: { tenantId } });
    await tx.tipoAusenciaConfig.createMany({ data: TIPOS_AUSENCIA_CONFIG_BASE.map((c) => ({ tenantId, ...c })) });

    await tx.notificacionPlantilla.deleteMany({ where: { tenantId } });
    await tx.notificacionPlantilla.createMany({ data: PLANTILLAS_PUBLICACIONES_SOCIALES_BASE.map((p) => ({ tenantId, ...p })) });
    await tx.notificacionPlantilla.createMany({ data: PLANTILLAS_COMENTARIOS_TAREA_BASE.map((p) => ({ tenantId, ...p })) });
    await tx.notificacionPlantilla.createMany({ data: PLANTILLAS_VENCIMIENTO_TAREAS_BASE.map((p) => ({ tenantId, ...p })) });

    await tx.seccionTienda.deleteMany({ where: { tenantId } });
    await tx.seccionTienda.createMany({
      data: [
        { tenantId, tipo: 'HERO', titulo: nombreTenant, subtitulo: 'Bienvenido a nuestra tienda', orden: 0 },
        { tenantId, tipo: 'DESTACADOS', titulo: 'Destacados', orden: 1 },
        { tenantId, tipo: 'OFERTAS', titulo: 'Ofertas', orden: 2 },
      ],
    });
  }
}
