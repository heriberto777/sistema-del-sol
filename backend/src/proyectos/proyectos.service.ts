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
   * "¿Quién soy yo como empleado?" (Fase 6, cronómetro) — el frontend lo
   * necesita para decidir si muestra "Iniciar" o "Pausar" en cada tarea,
   * sin exponer nada del salario (a diferencia de `costoHoraEmpleado`).
   * `null` si el usuario logueado no tiene un Empleado de RRHH vinculado.
   */
  async miEmpleadoId(userId: string): Promise<string | null> {
    const empleado = await this.empleadosRepository.buscarPorUserId(userId);
    return empleado?.id ?? null;
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
  /**
   * Cuerpo puro del cálculo de monto — reusado por `facturarHito` (factura
   * real) y `previsualizarFacturaHito` (modal de confirmación, no factura
   * nada). Mismas reglas/mismos mensajes de error en los dos casos, para
   * que la previsualización nunca prometa algo que `facturarHito` termine
   * rechazando.
   */
  private async calcularMontoHito(
    hito: { id: string; montoFijo: unknown },
    proyecto: { modoFacturacion: string; tarifaHoraFacturable: unknown },
  ): Promise<{ monto: number; horas?: number; tarifaHora?: number }> {
    if (proyecto.modoFacturacion === 'PRECIO_FIJO') {
      if (hito.montoFijo == null) throw new BadRequestException('Este hito no tiene un monto fijo cargado');
      return { monto: Number(hito.montoFijo) };
    }
    const horas = await this.proyectosRepository.sumarHorasDelHito(hito.id);
    if (horas <= 0) throw new BadRequestException('No hay horas registradas para facturar en este hito');
    if (proyecto.tarifaHoraFacturable == null) {
      throw new BadRequestException('El proyecto no tiene una tarifa por hora facturable configurada');
    }
    const tarifaHora = Number(proyecto.tarifaHoraFacturable);
    return { monto: horas * tarifaHora, horas, tarifaHora };
  }

  /**
   * Fase 9 (Proyectos) — datos para el modal de confirmación ANTES de
   * facturar de verdad: mismo cálculo de monto que `facturarHito`, más
   * `tareasPendientes`/`puedeFacturar` para que el frontend deshabilite el
   * botón de confirmar si todavía hay tareas sin terminar (la validación
   * real y no saltable sigue siendo la de `facturarHito`, esto es solo
   * para avisar antes de intentarlo).
   */
  async previsualizarFacturaHito(hitoId: string) {
    const hito = await this.proyectosRepository.buscarHitoPorId(hitoId);
    if (hito.facturaId) throw new BadRequestException('Este hito ya fue facturado');

    const proyecto = await this.proyectosRepository.buscarProyectoPorId(hito.proyectoId);
    const tareasPendientes = await this.proyectosRepository.contarTareasVigentesDelHito(hitoId);
    const { monto, horas, tarifaHora } = await this.calcularMontoHito(hito, proyecto);

    return {
      proyectoNombre: proyecto.nombre,
      clienteNombre: proyecto.cliente.nombre,
      hitoNombre: hito.nombre,
      modoFacturacion: proyecto.modoFacturacion,
      monto,
      horas,
      tarifaHora,
      tareasPendientes,
      puedeFacturar: tareasPendientes === 0,
    };
  }

  async facturarHito(hitoId: string, tenantId: string, vendedorId: string) {
    const hito = await this.proyectosRepository.buscarHitoPorId(hitoId);
    if (hito.facturaId) throw new BadRequestException('Este hito ya fue facturado');

    // Confirmado con el usuario — no se puede facturar mientras el hito
    // tenga tareas sin terminar (Pendiente/En curso/En revisión).
    const tareasPendientes = await this.proyectosRepository.contarTareasVigentesDelHito(hitoId);
    if (tareasPendientes > 0) {
      throw new BadRequestException(
        `Este hito tiene ${tareasPendientes} tarea(s) sin terminar — no se puede facturar hasta que todas estén Terminadas.`,
      );
    }

    const proyecto = await this.proyectosRepository.buscarProyectoPorId(hito.proyectoId);
    const { monto } = await this.calcularMontoHito(hito, proyecto);

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
   * "Facturar todo" — datos para el modal de confirmación de la factura
   * consolidada: un renglón por cada hito SIN facturar todavía del
   * proyecto, con su monto (si se puede calcular) y si está listo o no.
   * Mismo criterio que `previsualizarFacturaHito`: nunca promete algo que
   * `facturarConsolidado` vaya a rechazar después.
   */
  async previsualizarFacturaConsolidada(proyectoId: string) {
    const proyecto = await this.proyectosRepository.buscarProyectoPorId(proyectoId);
    const hitosSinFacturar = proyecto.hitos.filter((h) => !h.facturaId);

    const detalle = await Promise.all(
      hitosSinFacturar.map(async (hito) => {
        const tareasPendientes = await this.proyectosRepository.contarTareasVigentesDelHito(hito.id);
        if (tareasPendientes > 0) {
          return { hitoId: hito.id, hitoNombre: hito.nombre, monto: 0, tareasPendientes, puedeFacturar: false, motivo: `${tareasPendientes} tarea(s) sin terminar` };
        }
        try {
          const { monto } = await this.calcularMontoHito(hito, proyecto);
          return { hitoId: hito.id, hitoNombre: hito.nombre, monto, tareasPendientes: 0, puedeFacturar: true, motivo: null };
        } catch (error) {
          return { hitoId: hito.id, hitoNombre: hito.nombre, monto: 0, tareasPendientes: 0, puedeFacturar: false, motivo: error instanceof Error ? error.message : 'No se pudo calcular el monto' };
        }
      }),
    );

    const listos = detalle.filter((d) => d.puedeFacturar);
    return {
      proyectoNombre: proyecto.nombre,
      clienteNombre: proyecto.cliente.nombre,
      hitos: detalle,
      total: listos.reduce((acc, d) => acc + d.monto, 0),
    };
  }

  /**
   * Factura UNA sola vez, en una sola Factura con una línea por hito —
   * revalida cada `hitoId` recibido (no facturado ya, sin tareas
   * pendientes, monto calculable) en vez de confiar en lo que mandó el
   * frontend: si algo cambió entre la previsualización y la confirmación,
   * ese hito puntual queda afuera del lote en vez de abortar todo.
   */
  async facturarConsolidado(proyectoId: string, hitoIds: string[], tenantId: string, vendedorId: string) {
    const proyecto = await this.proyectosRepository.buscarProyectoPorId(proyectoId);
    const candidatos = proyecto.hitos.filter((h) => !h.facturaId && hitoIds.includes(h.id));

    const lineas: { descripcionManual: string; cantidad: number; precioUnitario: number; aplicaItbis: boolean }[] = [];
    const idsListos: string[] = [];

    for (const hito of candidatos) {
      const tareasPendientes = await this.proyectosRepository.contarTareasVigentesDelHito(hito.id);
      if (tareasPendientes > 0) continue;
      try {
        const { monto } = await this.calcularMontoHito(hito, proyecto);
        lineas.push({ descripcionManual: `${proyecto.nombre} — ${hito.nombre}`, cantidad: 1, precioUnitario: monto, aplicaItbis: true });
        idsListos.push(hito.id);
      } catch {
        // No listo todavía (ej. sin monto fijo cargado) — se excluye del lote, no aborta el resto.
      }
    }

    if (lineas.length === 0) {
      throw new BadRequestException('Ningún hito de los seleccionados está listo para facturar todavía.');
    }

    const bodega = await this.proyectosRepository.buscarBodegaActivaPorDefecto();
    if (!bodega) throw new BadRequestException('Este tenant no tiene ninguna bodega activa configurada — no se puede facturar');

    const factura = await this.facturacionService.crear(
      { clienteId: proyecto.clienteId, bodegaId: bodega.id, tipoFactura: 'CONTADO', lineas },
      tenantId,
      vendedorId,
      { sinMovimientoInventario: true },
    );

    await this.proyectosRepository.marcarHitosFacturados(idsListos, factura.id);
    return { facturaId: factura.id, numero: factura.numero, total: factura.total, hitosFacturados: idsListos.length };
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

  /**
   * Dashboard de rentabilidad: facturado real (Facturas emitidas desde los
   * hitos de este proyecto, ver `facturarHito`) vs. costo real (horas de
   * TODAS las tareas del proyecto × costo interno de cada empleado, más
   * gastos menores asociados). Gateado con un permiso propio
   * (`proyectos.rentabilidad.ver`, ver roles-base.ts) porque el costo de
   * horas se deriva del salario de los empleados — más sensible que solo
   * `proyectos.ver`.
   */
  async calcularRentabilidad(proyectoId: string, tenantId: string) {
    await this.buscarPorId(proyectoId); // 404 si el proyecto no existe/no es de este tenant

    const [facturado, horasPorEmpleado, costoGastos] = await Promise.all([
      this.proyectosRepository.sumarFacturadoDelProyecto(proyectoId),
      this.proyectosRepository.agruparHorasDelProyectoPorEmpleado(proyectoId),
      this.proyectosRepository.sumarGastosDelProyecto(proyectoId),
    ]);

    const costosPorEmpleado = await Promise.all(
      horasPorEmpleado.map(async ({ empleadoId, horas }) => horas * (await this.costoHoraEmpleado(empleadoId, tenantId))),
    );
    const costoHoras = costosPorEmpleado.reduce((acc, c) => acc + c, 0);

    const costoTotal = costoHoras + costoGastos;
    const margen = facturado - costoTotal;
    const margenPorcentaje = facturado > 0 ? (margen / facturado) * 100 : null;

    return { facturado, costoHoras, costoGastos, costoTotal, margen, margenPorcentaje };
  }

  /** Dashboard "Resumen ejecutivo" — rentabilidad sumada de todos los proyectos EN_CURSO. Mismo permiso que `calcularRentabilidad` (deriva del salario de los empleados). */
  async resumenRentabilidad(tenantId: string) {
    const activos = await this.proyectosRepository.idsProyectosActivos();
    const rentabilidades = await Promise.all(activos.map((p) => this.calcularRentabilidad(p.id, tenantId)));
    const totales = rentabilidades.reduce(
      (acc, r) => ({ facturado: acc.facturado + r.facturado, costoTotal: acc.costoTotal + r.costoTotal }),
      { facturado: 0, costoTotal: 0 },
    );
    const margen = totales.facturado - totales.costoTotal;
    return {
      proyectosActivos: activos.length,
      facturado: totales.facturado,
      costoTotal: totales.costoTotal,
      margen,
      margenPorcentaje: totales.facturado > 0 ? (margen / totales.facturado) * 100 : null,
    };
  }

  /** Dashboard "Resumen ejecutivo" — hitos por vencer (14 días) y tareas vencidas, a través de TODOS los proyectos. Permiso general `proyectos.ver`: no expone nada de salario. */
  async resumenAlertas() {
    const [hitosProximos, tareasVencidas] = await Promise.all([
      this.proyectosRepository.hitosProximos(14),
      this.proyectosRepository.tareasVencidas(),
    ]);
    return {
      hitosProximos: hitosProximos.map((h) => ({ id: h.id, nombre: h.nombre, fechaObjetivo: h.fechaObjetivo, proyecto: h.proyecto.nombre })),
      tareasVencidasTotal: tareasVencidas.total,
      tareasVencidas: tareasVencidas.primeras.map((t) => ({
        id: t.id,
        titulo: t.titulo,
        fechaVencimiento: t.fechaVencimiento,
        proyecto: t.proyecto.nombre,
        responsables: t.responsables.map((r) => r.empleado.nombre),
      })),
    };
  }

  /**
   * Costo interno estimado (salario de los empleados) de las horas YA
   * cargadas en las tareas de cada Hito de este proyecto — para que la UI
   * pueda avisar si `HitoProyecto.montoFijo` (lo pactado con el cliente) no
   * alcanza a cubrir lo que en verdad costó ese trabajo. Mismo permiso que
   * `calcularRentabilidad` (`proyectos.rentabilidad.ver`): también deriva
   * del salario de los empleados.
   *
   * Reusa `buscarPorId` (ya trae `tareas[].registrosHoras` con `empleadoId`)
   * en vez de una query de agregación nueva — el volumen de horas de un
   * proyecto es chico, y así no hay que sumarle a Prisma un `groupBy` por
   * un campo (`hitoId`) que vive en la tabla padre (`TareaProyecto`), no en
   * `RegistroHoraProyecto`.
   */
  async calcularCostoHorasPorHito(proyectoId: string, tenantId: string): Promise<Record<string, { horasTotales: number; costoHoras: number }>> {
    const proyecto = await this.buscarPorId(proyectoId); // 404 si el proyecto no existe/no es de este tenant

    const horasPorHitoYEmpleado = new Map<string, Map<string, number>>();
    for (const tarea of proyecto.tareas) {
      if (!tarea.hitoId) continue;
      const porEmpleado = horasPorHitoYEmpleado.get(tarea.hitoId) ?? new Map<string, number>();
      horasPorHitoYEmpleado.set(tarea.hitoId, porEmpleado);
      for (const registro of tarea.registrosHoras) {
        porEmpleado.set(registro.empleadoId, (porEmpleado.get(registro.empleadoId) ?? 0) + Number(registro.horas));
      }
    }

    const costoPorEmpleado = new Map<string, number>();
    const resultado: Record<string, { horasTotales: number; costoHoras: number }> = {};
    for (const [hitoId, porEmpleado] of horasPorHitoYEmpleado) {
      let horasTotales = 0;
      let costoHoras = 0;
      for (const [empleadoId, horas] of porEmpleado) {
        if (!costoPorEmpleado.has(empleadoId)) {
          costoPorEmpleado.set(empleadoId, await this.costoHoraEmpleado(empleadoId, tenantId));
        }
        horasTotales += horas;
        costoHoras += horas * costoPorEmpleado.get(empleadoId)!;
      }
      // Redondeo a 2 decimales — `RegistroHoraProyecto.horas` es Decimal(5,2),
      // nunca tiene más precisión real que esa; sin este redondeo, la suma
      // en JS de varios registros arrastra error de punto flotante y termina
      // mostrando cosas como "6.539999999999999h" en vez de "6.54h".
      resultado[hitoId] = { horasTotales: Math.round(horasTotales * 100) / 100, costoHoras: Math.round(costoHoras * 100) / 100 };
    }
    return resultado;
  }
}
