import { Injectable } from '@nestjs/common';
import { EstadoContratoPropiedad, EstadoCobroAlquiler, OperacionPropiedad, TipoPropiedad } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearPropiedadDto } from './dto/crear-propiedad.dto';
import { CrearContratoPropiedadDto } from './dto/crear-contrato-propiedad.dto';
import { ActivarAdministracionAlquilerDto } from './dto/activar-administracion-alquiler.dto';

const INCLUDE_PROPIEDAD = {
  agente: { select: { id: true, nombre: true } },
  propietario: { select: { id: true, nombre: true } },
  proyectoPreventa: { select: { id: true, nombre: true, estado: true } },
  imagenes: { orderBy: { orden: 'asc' as const } },
};

const INCLUDE_CONTRATO = {
  propiedad: { select: { id: true, codigo: true, titulo: true, propietarioId: true } },
  cliente: { select: { id: true, nombre: true } },
  agente: { select: { id: true, nombre: true } },
};

const INCLUDE_COBRO = {
  contratoPropiedad: {
    select: {
      id: true,
      clienteId: true,
      propiedad: { select: { id: true, codigo: true, titulo: true, propietarioId: true } },
      cliente: { select: { id: true, nombre: true } },
    },
  },
};

/** Un solo repositorio para el plugin — Fase 1 es solo Propiedad+ImagenPropiedad, mismo criterio que ProyectosRepository. */
@Injectable()
export class InmobiliariaRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crearPropiedad(dto: CrearPropiedadDto, tenantId: string) {
    const { imagenes, ...datos } = dto;
    return this.db.$transaction(async (tx) => {
      const propiedad = await tx.propiedad.create({ data: { ...datos, tenantId } });
      if (imagenes?.length) {
        await tx.imagenPropiedad.createMany({
          data: imagenes.map((img, orden) => ({ propiedadId: propiedad.id, imagen: img.imagen, orden })),
        });
      }
      return tx.propiedad.findUniqueOrThrow({ where: { id: propiedad.id }, include: INCLUDE_PROPIEDAD });
    });
  }

  listarPropiedades(params: {
    skip: number;
    take: number;
    busqueda?: string;
    operacion?: OperacionPropiedad;
    tipo?: TipoPropiedad;
    agenteId?: string;
  }) {
    const where = {
      ...(params.busqueda
        ? {
            OR: [
              { titulo: { contains: params.busqueda, mode: 'insensitive' as const } },
              { codigo: { contains: params.busqueda, mode: 'insensitive' as const } },
              { ubicacion: { contains: params.busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(params.operacion ? { operacion: params.operacion } : {}),
      ...(params.tipo ? { tipo: params.tipo } : {}),
      ...(params.agenteId ? { agenteId: params.agenteId } : {}),
    };
    return Promise.all([
      this.db.propiedad.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take, include: INCLUDE_PROPIEDAD }),
      this.db.propiedad.count({ where }),
    ]);
  }

  buscarPropiedadPorId(id: string) {
    return this.db.propiedad.findUniqueOrThrow({ where: { id }, include: INCLUDE_PROPIEDAD });
  }

  actualizarPropiedad(id: string, dto: Partial<CrearPropiedadDto>) {
    const { imagenes, ...datos } = dto;
    return this.db.$transaction(async (tx) => {
      await tx.propiedad.update({ where: { id }, data: datos });
      if (imagenes !== undefined) {
        await tx.imagenPropiedad.deleteMany({ where: { propiedadId: id } });
        if (imagenes.length) {
          await tx.imagenPropiedad.createMany({
            data: imagenes.map((img, orden) => ({ propiedadId: id, imagen: img.imagen, orden })),
          });
        }
      }
      return tx.propiedad.findUniqueOrThrow({ where: { id }, include: INCLUDE_PROPIEDAD });
    });
  }

  eliminarPropiedad(id: string) {
    // Cascade en schema.prisma se encarga de ImagenPropiedad. Si la
    // propiedad ya tiene algún ContratoPropiedad, Postgres rechaza el
    // borrado (RESTRICT) — el filtro global lo mapea a 409, ver el
    // comentario en el modelo ContratoPropiedad (schema.prisma).
    return this.db.propiedad.delete({ where: { id } });
  }

  // ---------- ContratoPropiedad (Fase 3) ----------

  /** `tipo`/`montoComision` ya vienen calculados por InmobiliariaService — acá solo persiste y cierra la propiedad, atómico. */
  crearContrato(propiedadId: string, dto: CrearContratoPropiedadDto & { tipo: OperacionPropiedad; montoComision: number }, tenantId: string) {
    const { fecha, ...datos } = dto;
    return this.db.$transaction(async (tx) => {
      const contrato = await tx.contratoPropiedad.create({
        data: { ...datos, propiedadId, tenantId, ...(fecha ? { fecha: new Date(fecha) } : {}) },
      });
      await tx.propiedad.update({
        where: { id: propiedadId },
        data: { estado: dto.tipo === 'VENTA' ? 'VENDIDA' : 'ALQUILADA' },
      });
      return tx.contratoPropiedad.findUniqueOrThrow({ where: { id: contrato.id }, include: INCLUDE_CONTRATO });
    });
  }

  listarContratos(params: { skip: number; take: number; estado?: EstadoContratoPropiedad; tipo?: OperacionPropiedad; agenteId?: string }) {
    const where = {
      ...(params.estado ? { estado: params.estado } : {}),
      ...(params.tipo ? { tipo: params.tipo } : {}),
      ...(params.agenteId ? { agenteId: params.agenteId } : {}),
    };
    return Promise.all([
      this.db.contratoPropiedad.findMany({ where, orderBy: { fecha: 'desc' }, skip: params.skip, take: params.take, include: INCLUDE_CONTRATO }),
      this.db.contratoPropiedad.count({ where }),
    ]);
  }

  buscarContratoPorId(id: string) {
    return this.db.contratoPropiedad.findUniqueOrThrow({ where: { id }, include: INCLUDE_CONTRATO });
  }

  /** Reabre la propiedad (vuelve a ACTIVA) en la misma transacción — mismo criterio de reversión que HitoFacturaAnuladaListener. */
  anularContrato(id: string, propiedadId: string) {
    return this.db.$transaction(async (tx) => {
      const contrato = await tx.contratoPropiedad.update({ where: { id }, data: { estado: 'ANULADO' }, include: INCLUDE_CONTRATO });
      await tx.propiedad.update({ where: { id: propiedadId }, data: { estado: 'ACTIVA' } });
      return contrato;
    });
  }

  marcarComisionPagada(id: string) {
    return this.db.contratoPropiedad.update({ where: { id }, data: { comisionPagada: true, comisionPagadaEn: new Date() }, include: INCLUDE_CONTRATO });
  }

  // ---------- Modelo 2 — Administración de alquileres ----------

  activarAdministracionAlquiler(id: string, dto: ActivarAdministracionAlquilerDto) {
    return this.db.contratoPropiedad.update({
      where: { id },
      data: {
        administracionActiva: true,
        porcentajeComisionAdministracion: dto.porcentajeComisionAdministracion,
        proximoCobroAlquilerEn: dto.proximoCobroAlquilerEn ? new Date(dto.proximoCobroAlquilerEn) : new Date(),
      },
      include: INCLUDE_CONTRATO,
    });
  }

  /** Pausa la generación de nuevos cobros — no borra `proximoCobroAlquilerEn` ni los cobros ya generados. */
  desactivarAdministracionAlquiler(id: string) {
    return this.db.contratoPropiedad.update({ where: { id }, data: { administracionActiva: false }, include: INCLUDE_CONTRATO });
  }

  listarCobrosAlquiler(params: { skip: number; take: number; contratoPropiedadId?: string; estado?: EstadoCobroAlquiler }) {
    const where = {
      ...(params.contratoPropiedadId ? { contratoPropiedadId: params.contratoPropiedadId } : {}),
      ...(params.estado ? { estado: params.estado } : {}),
    };
    return Promise.all([
      this.db.cobroAlquiler.findMany({ where, orderBy: { periodo: 'desc' }, skip: params.skip, take: params.take, include: INCLUDE_COBRO }),
      this.db.cobroAlquiler.count({ where }),
    ]);
  }

  buscarCobroPorId(id: string) {
    return this.db.cobroAlquiler.findUniqueOrThrow({ where: { id }, include: INCLUDE_COBRO });
  }

  marcarCobrado(id: string, facturaId: string | null) {
    return this.db.cobroAlquiler.update({ where: { id }, data: { estado: 'COBRADO', fechaCobro: new Date(), facturaId }, include: INCLUDE_COBRO });
  }

  marcarLiquidado(id: string) {
    return this.db.cobroAlquiler.update({ where: { id }, data: { estado: 'LIQUIDADO', fechaLiquidacion: new Date() }, include: INCLUDE_COBRO });
  }

  /** Mismo criterio que ProyectosRepository.buscarBodegaActivaPorDefecto — el plugin no gestiona bodegas propias, usa la primera activa del tenant para poder llamar a FacturacionService.crear(). */
  buscarBodegaActivaPorDefecto() {
    return this.db.bodega.findFirst({ where: { activa: true }, orderBy: { nombre: 'asc' } });
  }

  // ---------- Modelo 3 — Preventa (reusa Proyecto/HitoProyecto) ----------

  vincularProyectoPreventa(propiedadId: string, proyectoId: string) {
    return this.db.propiedad.update({
      where: { id: propiedadId },
      data: { proyectoPreventaId: proyectoId, estado: 'RESERVADA' },
      include: INCLUDE_PROPIEDAD,
    });
  }

  /** No borra el Proyecto (eso se gestiona desde Proyectos) — solo desvincula y reabre la propiedad. */
  desvincularProyectoPreventa(propiedadId: string) {
    return this.db.propiedad.update({
      where: { id: propiedadId },
      data: { proyectoPreventaId: null, estado: 'ACTIVA' },
      include: INCLUDE_PROPIEDAD,
    });
  }
}
