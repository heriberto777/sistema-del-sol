import { Injectable } from '@nestjs/common';
import { Prisma, TipoNcf } from '@prisma/client';
import { GastosMenoresRepository } from './gastos-menores.repository';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearGastoMenorDto } from './dto/crear-gasto-menor.dto';
import { ImportarGastosMenoresDto } from './dto/importar-gastos-menores.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { CierrePeriodoService } from '../contabilidad/cierre-periodo.service';
import { CuentasContablesService } from '../contabilidad/cuentas-contables.service';
import { BancosService } from '../bancos/bancos.service';

export interface ResumenImportacionGastosMenores {
  creados: number;
  errores: { fila: number; mensaje: string }[];
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase();
}

@Injectable()
export class GastosMenoresService {
  constructor(
    private readonly gastosMenoresRepository: GastosMenoresRepository,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly eventBus: EventBusService,
    private readonly cierrePeriodoService: CierrePeriodoService,
    private readonly cuentasContablesService: CuentasContablesService,
    private readonly bancosService: BancosService,
  ) {}

  /**
   * Requiere que el tenant tenga una secuencia de NCF activa para B11
   * (tradicional) o E43 (modalidad ECF) — mismo requisito que Facturación
   * tiene para B02/E32. Si no existe, `siguienteNumeroEnTx` lanza (404) —
   * mismo comportamiento que si Facturación se quedara sin secuencia.
   */
  async crear(dto: CrearGastoMenorDto, tenantId: string) {
    const lineasCalculadas = dto.lineas.map((linea) => {
      const cantidad = linea.cantidad ?? 1;
      const porcentajeItbis = linea.porcentajeItbis ?? 0;
      const montoItbis = linea.valor * cantidad * (porcentajeItbis / 100);
      return {
        cuentaContableId: linea.cuentaContableId,
        concepto: linea.concepto,
        valor: linea.valor,
        porcentajeItbis,
        montoItbis,
        cantidad,
        montoTotal: linea.valor * cantidad + montoItbis,
      };
    });

    const monto = lineasCalculadas.reduce((acc, l) => acc + l.valor * l.cantidad, 0);
    const itbis = lineasCalculadas.reduce((acc, l) => acc + l.montoItbis, 0);
    const total = monto + itbis;

    const modalidad = await this.gastosMenoresRepository.obtenerModalidadFacturacion(tenantId);
    const tipoNcf: TipoNcf = modalidad === 'ECF' ? 'E43' : 'B11';
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    await this.cierrePeriodoService.validarFechaAbierta(fecha);

    // Plugin de Proyectos (opcional) — findFirstOrThrow tenant-scoped (vía
    // $transaction, ya trae el SET LOCAL de esta conexión) para no permitir
    // asociar el gasto a un proyecto de otro tenant.
    if (dto.proyectoId) {
      await this.tenantPrisma.client.proyecto.findUniqueOrThrow({ where: { id: dto.proyectoId } });
    }

    const gastoMenor = await this.tenantPrisma.client.$transaction(async (tx) => {
      const ncf = await this.gastosMenoresRepository.siguienteNumeroEnTx(tx, tipoNcf);
      return this.gastosMenoresRepository.crearEnTx(tx, {
        tenantId,
        ncf,
        tipoNcf,
        notas: dto.notas,
        fecha,
        cuentaBancariaId: dto.cuentaBancariaId,
        monto,
        itbis,
        total,
        proyectoId: dto.proyectoId,
        lineas: lineasCalculadas,
      });
    });

    this.eventBus.emit(EVENTOS.GASTO_MENOR_CREADO, { tenantId, gastoMenorId: gastoMenor.id });

    return gastoMenor;
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.gastosMenoresRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.gastosMenoresRepository.buscarPorId(id);
  }

  /**
   * Fase 11.1 del benchmark (Cuadre tiene import masivo de Gastos que
   * alimenta el 606 directo). Resuelve `cuentaBancaria`/`cuentaContable`
   * (texto libre) contra el catálogo real del tenant UNA sola vez antes
   * del recorrido (no por fila) y reusa `crear()` tal cual — misma
   * validación de período cerrado, mismo cálculo de ITBIS, mismo evento.
   *
   * Dos pasadas, a propósito (bug real encontrado en QA en vivo con la
   * versión de una sola pasada): primero se resuelve la referencia de
   * CADA fila (no crea nada todavía) — una fila con banco/cuenta
   * inexistente guarda SU PROPIO error y nunca llega a `crear()`. Recién
   * después se crean en orden las que sí resolvieron bien; si una de
   * ESAS falla por secuencia de NCF agotada (o sin configurar, compartida
   * por todo el tenant), el resto de las que iban a crearse también
   * fallarían igual, así que se cortan ahí y se marcan como "no
   * procesada" — pero sin pisar el error propio de una fila que ya había
   * fallado por una razón distinta en el paso de resolución.
   */
  async importar(dto: ImportarGastosMenoresDto, tenantId: string): Promise<ResumenImportacionGastosMenores> {
    const [bancos, cuentas] = await Promise.all([this.bancosService.listarTodasActivas(), this.cuentasContablesService.listar()]);

    const bancoPorEtiqueta = new Map(bancos.map((b) => [normalizar(`${b.banco} — ${b.numeroCuenta}`), b.id]));
    const bancosPorNombreSolo = new Map<string, string[]>();
    for (const b of bancos) {
      const clave = normalizar(b.banco);
      bancosPorNombreSolo.set(clave, [...(bancosPorNombreSolo.get(clave) ?? []), b.id]);
    }

    const cuentaPorCodigo = new Map(cuentas.map((c) => [normalizar(c.codigo), c]));
    const cuentaPorNombre = new Map(cuentas.map((c) => [normalizar(c.nombre), c]));

    const resumen: ResumenImportacionGastosMenores = { creados: 0, errores: [] };

    // Paso 1: resolver referencias de TODAS las filas antes de crear nada.
    const paraCrear: { numeroFila: number; dto: CrearGastoMenorDto }[] = [];
    dto.gastos.forEach((fila, i) => {
      // Fila 1 del Excel es el encabezado — la primera de datos es la 2.
      const numeroFila = i + 2;
      try {
        const cuentaBancariaId = this.resolverCuentaBancaria(fila.cuentaBancaria, bancoPorEtiqueta, bancosPorNombreSolo);
        const cuentaContable = cuentaPorCodigo.get(normalizar(fila.cuentaContable)) ?? cuentaPorNombre.get(normalizar(fila.cuentaContable));
        if (!cuentaContable) throw new Error(`Cuenta contable "${fila.cuentaContable}" no encontrada`);
        if (cuentaContable.tipo !== 'GASTO') throw new Error(`"${fila.cuentaContable}" no es una cuenta de tipo Gasto`);

        paraCrear.push({
          numeroFila,
          dto: {
            cuentaBancariaId,
            fecha: fila.fecha,
            notas: fila.notas,
            lineas: [
              {
                cuentaContableId: cuentaContable.id,
                concepto: fila.concepto,
                valor: fila.valor,
                porcentajeItbis: fila.porcentajeItbis,
                cantidad: fila.cantidad,
              },
            ],
          },
        });
      } catch (err) {
        resumen.errores.push({ fila: numeroFila, mensaje: err instanceof Error ? err.message : 'Error desconocido' });
      }
    });

    // Paso 2: crear en orden las que resolvieron bien.
    for (let j = 0; j < paraCrear.length; j++) {
      const { numeroFila, dto: dtoGasto } = paraCrear[j];
      try {
        await this.crear(dtoGasto, tenantId);
        resumen.creados++;
      } catch (err) {
        if (this.esFalloDeSecuenciaNcf(err)) {
          const mensaje = 'Secuencia de NCF agotada o sin configurar — contactá a un administrador para ampliarla/activarla.';
          for (let k = j; k < paraCrear.length; k++) resumen.errores.push({ fila: paraCrear[k].numeroFila, mensaje });
          break;
        }
        resumen.errores.push({ fila: numeroFila, mensaje: err instanceof Error ? err.message : 'Error desconocido' });
      }
    }

    // Mismo orden que el archivo — el paso 1 pudo insertar errores de
    // filas con número más alto antes de que el paso 2 corra.
    resumen.errores.sort((a, b) => a.fila - b.fila);

    return resumen;
  }

  private resolverCuentaBancaria(texto: string, porEtiqueta: Map<string, string>, porNombreSolo: Map<string, string[]>): string {
    const clave = normalizar(texto);
    const porEtiquetaId = porEtiqueta.get(clave);
    if (porEtiquetaId) return porEtiquetaId;

    const candidatas = porNombreSolo.get(clave);
    if (!candidatas || candidatas.length === 0) throw new Error(`Cuenta bancaria "${texto}" no encontrada`);
    if (candidatas.length > 1) throw new Error(`"${texto}" es ambiguo (hay ${candidatas.length} cuentas en ese banco) — usá el formato "Banco — NúmeroCuenta"`);
    return candidatas[0];
  }

  /**
   * `siguienteNumeroEnTx` lanza un `Error` explícito si la secuencia existe
   * pero se quedó sin números, o deja que Prisma lance `P2025` (record no
   * encontrado) si no hay NINGUNA secuencia activa para este tipo — acá no
   * se llama nada más con `findFirstOrThrow`/`findUniqueOrThrow` dentro de
   * `crear()` en el camino del import (no se manda `proyectoId`), así que
   * cualquier P2025 en este contexto es inequívocamente esto.
   */
  private esFalloDeSecuenciaNcf(err: unknown): boolean {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return true;
    return err instanceof Error && /Secuencia de NCF .* agotada/.test(err.message);
  }
}
