import { BadRequestException, Injectable } from '@nestjs/common';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OperacionPropiedad, TipoPropiedad } from '@prisma/client';
import { InmobiliariaRepository } from './inmobiliaria.repository';
import { EmpleadosRepository } from '../nomina/empleados.repository';
import { ClientesService } from '../clientes/clientes.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { ProyectosRepository } from '../proyectos/proyectos.repository';
import { PrismaService } from '../prisma/prisma.service';
import { moduloEstaActivo } from '../planes/resolver-modulos-activos';
import { CrearPropiedadDto } from './dto/crear-propiedad.dto';
import { CrearContratoPropiedadDto } from './dto/crear-contrato-propiedad.dto';
import { ListadoContratosQueryDto } from './dto/listado-contratos-query.dto';
import { ActivarAdministracionAlquilerDto } from './dto/activar-administracion-alquiler.dto';
import { MarcarCobradoAlquilerDto } from './dto/marcar-cobrado-alquiler.dto';
import { ListadoCobrosAlquilerQueryDto } from './dto/listado-cobros-alquiler-query.dto';
import { CrearPreventaDto } from './dto/crear-preventa.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

// `whitelist: true` + `forbidNonWhitelisted: true` (ver main.ts) exige que
// cada query param tenga su decorador de validación — sin esto, un query
// string con `?operacion=VENTA` sería rechazado con 400.
export class ListadoPropiedadesQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsEnum(OperacionPropiedad)
  operacion?: OperacionPropiedad;

  @IsOptional()
  @IsEnum(TipoPropiedad)
  tipo?: TipoPropiedad;

  @IsOptional()
  @IsUUID()
  agenteId?: string;
}

@Injectable()
export class InmobiliariaService {
  constructor(
    private readonly inmobiliariaRepository: InmobiliariaRepository,
    private readonly empleadosRepository: EmpleadosRepository,
    private readonly clientesService: ClientesService,
    private readonly facturacionService: FacturacionService,
    private readonly proyectosRepository: ProyectosRepository,
    private readonly prisma: PrismaService,
  ) {}

  async crear(dto: CrearPropiedadDto, tenantId: string) {
    // findUniqueOrThrow tenant-scoped: si agenteId/propietarioId es de otro
    // tenant, 404 — mismo patrón de prevención de IDOR que ProyectosService.crear.
    if (dto.agenteId) await this.empleadosRepository.buscarPorId(dto.agenteId);
    if (dto.propietarioId) await this.clientesService.buscarPorId(dto.propietarioId);
    return this.inmobiliariaRepository.crearPropiedad(dto, tenantId);
  }

  async listar(query: ListadoPropiedadesQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.inmobiliariaRepository.listarPropiedades({
      skip,
      take,
      busqueda: query.busqueda,
      operacion: query.operacion,
      tipo: query.tipo,
      agenteId: query.agenteId,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.inmobiliariaRepository.buscarPropiedadPorId(id);
  }

  async actualizar(id: string, dto: Partial<CrearPropiedadDto>) {
    if (dto.agenteId) await this.empleadosRepository.buscarPorId(dto.agenteId);
    if (dto.propietarioId) await this.clientesService.buscarPorId(dto.propietarioId);
    return this.inmobiliariaRepository.actualizarPropiedad(id, dto);
  }

  eliminar(id: string) {
    return this.inmobiliariaRepository.eliminarPropiedad(id);
  }

  /** Lista liviana de agentes para el select — mismo criterio que ProyectosService.listarEmpleadosDisponibles. */
  listarAgentesDisponibles() {
    return this.empleadosRepository.listarActivos();
  }

  // ---------- ContratoPropiedad (Fase 3) ----------

  /**
   * Cierra un negocio sobre una propiedad. `tipo` se deriva SIEMPRE de
   * `propiedad.operacion` (nunca lo elige quien llama) y la comisión se
   * calcula acá — la única fuente de verdad de ese cálculo, para que
   * nunca diverja entre lo que se guarda y lo que se le muestra al
   * usuario antes de confirmar.
   */
  async crearContrato(propiedadId: string, dto: CrearContratoPropiedadDto, tenantId: string) {
    const propiedad = await this.inmobiliariaRepository.buscarPropiedadPorId(propiedadId);
    if (propiedad.estado === 'VENDIDA' || propiedad.estado === 'ALQUILADA') {
      throw new BadRequestException('Esta propiedad ya tiene un negocio cerrado.');
    }

    // findUniqueOrThrow tenant-scoped: si clienteId/agenteId es de otro
    // tenant, 404 — mismo patrón de prevención de IDOR que ProyectosService.crear.
    await this.clientesService.buscarPorId(dto.clienteId);
    const agenteId = dto.agenteId ?? propiedad.agenteId ?? undefined;
    if (agenteId) await this.empleadosRepository.buscarPorId(agenteId);

    const montoComision = dto.porcentajeComision ? Math.round(((dto.monto * dto.porcentajeComision) / 100) * 100) / 100 : 0;

    return this.inmobiliariaRepository.crearContrato(propiedadId, { ...dto, agenteId, tipo: propiedad.operacion, montoComision }, tenantId);
  }

  async listarContratos(query: ListadoContratosQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.inmobiliariaRepository.listarContratos({
      skip,
      take,
      estado: query.estado,
      tipo: query.tipo,
      agenteId: query.agenteId,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarContratoPorId(id: string) {
    return this.inmobiliariaRepository.buscarContratoPorId(id);
  }

  async anularContrato(id: string) {
    const contrato = await this.inmobiliariaRepository.buscarContratoPorId(id);
    if (contrato.estado === 'ANULADO') throw new BadRequestException('Este contrato ya está anulado.');
    return this.inmobiliariaRepository.anularContrato(id, contrato.propiedad.id);
  }

  async marcarComisionPagada(id: string) {
    const contrato = await this.inmobiliariaRepository.buscarContratoPorId(id);
    if (contrato.estado === 'ANULADO') throw new BadRequestException('No se puede pagar la comisión de un contrato anulado.');
    if (contrato.comisionPagada) throw new BadRequestException('La comisión de este contrato ya está pagada.');
    return this.inmobiliariaRepository.marcarComisionPagada(id);
  }

  // ---------- Modelo 2 — Administración de alquileres ----------

  async activarAdministracionAlquiler(contratoId: string, dto: ActivarAdministracionAlquilerDto) {
    const contrato = await this.inmobiliariaRepository.buscarContratoPorId(contratoId);
    if (contrato.tipo !== 'ALQUILER') throw new BadRequestException('Solo un contrato de alquiler puede administrarse recurrentemente.');
    if (contrato.estado === 'ANULADO') throw new BadRequestException('Este contrato está anulado.');
    if (!contrato.propiedad.propietarioId) {
      throw new BadRequestException('Esta propiedad no tiene un propietario asignado — asignalo antes de activar la administración.');
    }
    return this.inmobiliariaRepository.activarAdministracionAlquiler(contratoId, dto);
  }

  desactivarAdministracionAlquiler(contratoId: string) {
    return this.inmobiliariaRepository.desactivarAdministracionAlquiler(contratoId);
  }

  async listarCobrosAlquiler(query: ListadoCobrosAlquilerQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.inmobiliariaRepository.listarCobrosAlquiler({
      skip,
      take,
      contratoPropiedadId: query.contratoPropiedadId,
      estado: query.estado,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarCobroAlquilerPorId(id: string) {
    return this.inmobiliariaRepository.buscarCobroPorId(id);
  }

  /**
   * Marca el cobro como recibido del inquilino. `generarFactura` es
   * opcional (confirmado con el usuario): si es true, genera una Factura
   * real vía `FacturacionService.crear()` — sale con NCF o e-CF según la
   * modalidad de facturación ya configurada del tenant, sin que el plugin
   * tenga que decidir eso; si es false, el cobro queda como registro
   * interno, sin ningún comprobante fiscal ("factura libre").
   */
  async marcarCobradoAlquiler(id: string, dto: MarcarCobradoAlquilerDto, tenantId: string, userId: string) {
    const cobro = await this.inmobiliariaRepository.buscarCobroPorId(id);
    if (cobro.estado !== 'PENDIENTE') throw new BadRequestException('Este cobro ya fue procesado.');

    let facturaId: string | null = null;
    if (dto.generarFactura) {
      const bodega = await this.inmobiliariaRepository.buscarBodegaActivaPorDefecto();
      if (!bodega) throw new BadRequestException('Este tenant no tiene ninguna bodega activa configurada — no se puede facturar');

      const propiedad = cobro.contratoPropiedad.propiedad;
      const factura = await this.facturacionService.crear(
        {
          clienteId: cobro.contratoPropiedad.clienteId,
          bodegaId: bodega.id,
          tipoFactura: 'CONTADO',
          lineas: [
            {
              descripcionManual: `Alquiler ${cobro.periodo} — ${propiedad.titulo}`,
              cantidad: 1,
              precioUnitario: Number(cobro.montoAlquiler),
              aplicaItbis: dto.aplicaItbis ?? false,
            },
          ],
        },
        tenantId,
        userId,
        { sinMovimientoInventario: true },
      );
      facturaId = factura.id;
    }

    return this.inmobiliariaRepository.marcarCobrado(id, facturaId);
  }

  async liquidarPropietarioAlquiler(id: string) {
    const cobro = await this.inmobiliariaRepository.buscarCobroPorId(id);
    if (cobro.estado === 'PENDIENTE') throw new BadRequestException('No se puede liquidar un cobro que todavía no se cobró al inquilino.');
    if (cobro.estado === 'LIQUIDADO') throw new BadRequestException('Este cobro ya fue liquidado al propietario.');
    return this.inmobiliariaRepository.marcarLiquidado(id);
  }

  // ---------- Modelo 3 — Preventa (reusa Proyecto/HitoProyecto de Proyectos) ----------

  /**
   * Crea un Proyecto (plugin Proyectos, modoFacturacion PRECIO_FIJO) y lo
   * vincula a la propiedad — cada pago del plan de preventa se carga
   * después como un HitoProyecto desde la pantalla de Proyectos, sin
   * duplicar esa UI/lógica acá. La propiedad pasa a RESERVADA (ya es un
   * estado "cerrable" — ver ESTADOS_PROPIEDAD_CERRABLE en el frontend):
   * cuando el plan termine de pagarse, el cierre final usa el mismo
   * "Cerrar negocio" de Fase 3, sin máquina de estados nueva.
   */
  async crearPreventa(propiedadId: string, dto: CrearPreventaDto, tenantId: string) {
    const proyectosActivo = await moduloEstaActivo(this.prisma, tenantId, 'proyectos');
    if (!proyectosActivo) {
      throw new BadRequestException('Este tenant no tiene el módulo de Proyectos activado — actívalo desde Plataforma para usar preventas.');
    }

    const propiedad = await this.inmobiliariaRepository.buscarPropiedadPorId(propiedadId);
    if (propiedad.operacion !== 'VENTA') throw new BadRequestException('La preventa solo aplica a propiedades en venta.');
    if (propiedad.proyectoPreventaId) throw new BadRequestException('Esta propiedad ya tiene un proyecto de preventa vinculado.');
    if (propiedad.estado === 'VENDIDA' || propiedad.estado === 'ALQUILADA') {
      throw new BadRequestException('Esta propiedad ya tiene un negocio cerrado.');
    }

    // findUniqueOrThrow tenant-scoped: si clienteId es de otro tenant, 404
    // — mismo patrón de prevención de IDOR que ProyectosService.crear.
    await this.clientesService.buscarPorId(dto.clienteId);

    const proyecto = await this.proyectosRepository.crearProyecto(
      { nombre: `Preventa — ${propiedad.titulo}`, clienteId: dto.clienteId, modoFacturacion: 'PRECIO_FIJO' },
      tenantId,
    );
    await this.inmobiliariaRepository.vincularProyectoPreventa(propiedadId, proyecto.id);
    return proyecto;
  }

  async desvincularPreventa(propiedadId: string) {
    const propiedad = await this.inmobiliariaRepository.buscarPropiedadPorId(propiedadId);
    if (!propiedad.proyectoPreventaId) throw new BadRequestException('Esta propiedad no tiene un proyecto de preventa vinculado.');
    return this.inmobiliariaRepository.desvincularProyectoPreventa(propiedadId);
  }
}
