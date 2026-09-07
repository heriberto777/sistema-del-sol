import { BadRequestException, Injectable } from '@nestjs/common';
import { ProyectosRepository } from './proyectos.repository';
import { ClientesService } from '../clientes/clientes.service';
import { EmpleadosRepository } from '../nomina/empleados.repository';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { CONFIGURACIONES_BASE } from '../tenants/roles-base';
import { costoHora } from './costo-hora.util';
import { CrearProyectoDto } from './dto/crear-proyecto.dto';
import { CrearHitoDto } from './dto/crear-hito.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

const CLAVE_HORAS_LABORABLES_MES = 'PROYECTOS_HORAS_LABORABLES_MES';

@Injectable()
export class ProyectosService {
  constructor(
    private readonly proyectosRepository: ProyectosRepository,
    private readonly clientesService: ClientesService,
    private readonly empleadosRepository: EmpleadosRepository,
    private readonly configuracionesService: ConfiguracionesService,
    private readonly facturacionService: FacturacionService,
  ) {}

  async crear(dto: CrearProyectoDto, tenantId: string) {
    // findUniqueOrThrow tenant-scoped: si clienteId/responsableId es de otro
    // tenant, 404 — mismo patrón de prevención de IDOR que ClientesService.
    await this.clientesService.buscarPorId(dto.clienteId);
    if (dto.responsableId) await this.empleadosRepository.buscarPorId(dto.responsableId);
    return this.proyectosRepository.crearProyecto(dto, tenantId);
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.proyectosRepository.listarProyectos({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.proyectosRepository.buscarProyectoPorId(id);
  }

  /**
   * Lista liviana de empleados para los selects de "responsable"
   * (Proyecto/Tarea) — mismo criterio que `PosService.listarVendedores`:
   * expuesta bajo el permiso de ESTE módulo (`proyectos.ver`), no
   * `nomina.ver`, para no obligar a dar acceso a Nómina/RRHH solo para
   * poder elegir quién hace una tarea.
   */
  listarEmpleadosDisponibles() {
    return this.empleadosRepository.listarActivos();
  }

  async actualizar(id: string, dto: Partial<CrearProyectoDto>) {
    if (dto.clienteId) await this.clientesService.buscarPorId(dto.clienteId);
    if (dto.responsableId) await this.empleadosRepository.buscarPorId(dto.responsableId);
    return this.proyectosRepository.actualizarProyecto(id, dto);
  }

  eliminar(id: string) {
    return this.proyectosRepository.eliminarProyecto(id);
  }

  // ---------- Hitos ----------

  async crearHito(proyectoId: string, dto: CrearHitoDto, tenantId: string) {
    await this.buscarPorId(proyectoId); // 404 si el proyecto no existe/no es de este tenant
    return this.proyectosRepository.crearHito(proyectoId, dto, tenantId);
  }

  actualizarHito(id: string, dto: Partial<CrearHitoDto>) {
    return this.proyectosRepository.actualizarHito(id, dto);
  }

  async eliminarHito(id: string) {
    await this.proyectosRepository.buscarHitoPorId(id);
    return this.proyectosRepository.eliminarHito(id);
  }

  /**
   * Fase 4 — genera la Factura real de un hito, reusando
   * `FacturacionService.crear()` (nunca se duplica lógica de NCF/ITBIS
   * acá). `montoFijo`/`tarifaHoraFacturable` están cargados ANTES de
   * ITBIS (decisión confirmada con el usuario) — se mandan tal cual como
   * `precioUnitario` de una línea manual, el ITBIS lo suma `crear()` solo
   * con la tasa general del tenant.
   */
  async facturarHito(hitoId: string, tenantId: string, vendedorId: string) {
    const hito = await this.proyectosRepository.buscarHitoPorId(hitoId);
    if (hito.facturaId) throw new BadRequestException('Este hito ya fue facturado');

    const proyecto = await this.proyectosRepository.buscarProyectoPorId(hito.proyectoId);

    let monto: number;
    if (proyecto.modoFacturacion === 'PRECIO_FIJO') {
      if (hito.montoFijo == null) throw new BadRequestException('Este hito no tiene un monto fijo cargado');
      monto = Number(hito.montoFijo);
    } else {
      const horas = await this.proyectosRepository.sumarHorasDelHito(hitoId);
      if (horas <= 0) throw new BadRequestException('No hay horas registradas para facturar en este hito');
      if (proyecto.tarifaHoraFacturable == null) {
        throw new BadRequestException('El proyecto no tiene una tarifa por hora facturable configurada');
      }
      monto = horas * Number(proyecto.tarifaHoraFacturable);
    }

    const bodega = await this.proyectosRepository.buscarBodegaActivaPorDefecto();
    if (!bodega) throw new BadRequestException('Este tenant no tiene ninguna bodega activa configurada — no se puede facturar');

    const factura = await this.facturacionService.crear(
      {
        clienteId: proyecto.clienteId,
        bodegaId: bodega.id,
        tipoFactura: 'CONTADO',
        lineas: [{ descripcionManual: `${proyecto.nombre} — ${hito.nombre}`, cantidad: 1, precioUnitario: monto, aplicaItbis: true }],
      },
      tenantId,
      vendedorId,
      { sinMovimientoInventario: true },
    );

    await this.proyectosRepository.marcarHitoFacturado(hitoId, factura.id);
    return { facturaId: factura.id, numero: factura.numero, total: factura.total };
  }

  /**
   * Costo interno estimado de una hora de ESTE empleado — base para el
   * dashboard de rentabilidad de la Fase 4, no expuesto en un endpoint
   * propio todavía. Nunca lo que se le cobra al cliente (ver
   * Proyecto.tarifaHoraFacturable, un campo aparte).
   */
  async costoHoraEmpleado(empleadoId: string, tenantId: string): Promise<number> {
    const empleado = await this.empleadosRepository.buscarPorId(empleadoId);
    const horasLaborablesMes = await this.configuracionesService.buscarValor(
      CLAVE_HORAS_LABORABLES_MES,
      tenantId,
      CONFIGURACIONES_BASE[CLAVE_HORAS_LABORABLES_MES],
    );
    return costoHora(empleado.salarioBrutoMensual.toString(), horasLaborablesMes);
  }
}
