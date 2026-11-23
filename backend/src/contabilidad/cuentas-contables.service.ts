import { BadRequestException, Injectable } from '@nestjs/common';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { CrearCuentaContableDto } from './dto/crear-cuenta-contable.dto';
import { CUENTAS_CATALOGO_COMPLETO, CODIGOS_CUENTA, TIPO_ESPERADO_POR_ROL } from './cuentas-base';

@Injectable()
export class CuentasContablesService {
  constructor(private readonly repository: CuentasContablesRepository) {}

  listar() {
    return this.repository.listar();
  }

  /** Tenant-scoped (findUniqueOrThrow vía TenantPrismaService) — para que otros módulos (ej. Categorías) validen un id de cuenta contable sin tocar el repositorio directo. */
  buscarPorId(id: string) {
    return this.repository.buscarPorId(id);
  }

  crear(dto: CrearCuentaContableDto, tenantId: string) {
    return this.repository.crear({ ...dto, tenantId });
  }

  /**
   * Fase 11.3 del benchmark — botón de un clic equivalente al de Cuadre.
   * Idempotente: salta cualquier código que ya exista (activo o no — el
   * unique de (tenantId, codigo) no distingue). CUENTAS_CATALOGO_COMPLETO
   * está ordenado padre-antes-que-hijo, así que un recorrido secuencial
   * (no Promise.all) alcanza para resolver `padreCodigo` con el id recién
   * creado del padre, sin necesitar una segunda pasada.
   */
  async completarCatalogo(tenantId: string) {
    const existentes = await this.repository.listarTodasLasCuentas();
    const idPorCodigo = new Map(existentes.map((c) => [c.codigo, c.id]));

    const creadas: string[] = [];
    for (const cuenta of CUENTAS_CATALOGO_COMPLETO) {
      if (idPorCodigo.has(cuenta.codigo)) continue;
      const cuentaPadreId = cuenta.padreCodigo ? idPorCodigo.get(cuenta.padreCodigo) : undefined;
      const creada = await this.repository.crear({
        tenantId,
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
        naturaleza: cuenta.naturaleza,
        cuentaPadreId,
      });
      idPorCodigo.set(cuenta.codigo, creada.id);
      creadas.push(cuenta.codigo);
    }

    return { creadas: creadas.length, total: CUENTAS_CATALOGO_COMPLETO.length };
  }

  /**
   * Override por tenant de los 15 códigos fijos que el motor de asientos
   * automáticos resuelve por rol (docs/PLAN.md, punto 4). Devuelve los 15
   * roles siempre (no solo los configurados), con `cuentaConfigurada:
   * null` para los que siguen en el código fijo de siempre — así la
   * pantalla de administración puede listarlos todos de una.
   */
  async listarConfiguracionCuentasSistema(tenantId: string) {
    const configuraciones = await this.repository.listarConfiguracionCuentasSistema(tenantId);
    const porClave = new Map(configuraciones.map((c) => [c.clave, c]));
    return Object.entries(CODIGOS_CUENTA).map(([clave, codigoFijo]) => ({
      clave,
      tipoEsperado: TIPO_ESPERADO_POR_ROL[clave as keyof typeof CODIGOS_CUENTA],
      codigoFijo,
      cuentaConfigurada: porClave.get(clave)?.cuentaContable ?? null,
    }));
  }

  /**
   * Valida que `clave` sea uno de los 15 roles reales y que la cuenta
   * elegida pertenezca al tenant (`buscarPorId`, tenant-scoped — 404 si
   * no), esté activa, y sea del mismo `tipo` que la cuenta fija que
   * reemplaza (ej. no se puede reasignar CAJA_BANCOS, tipo ACTIVO, a una
   * cuenta de GASTO) — sin esto, el motor de asientos quedaría
   * silenciosamente desbalanceado o mal clasificado.
   */
  async configurarCuentaSistema(clave: string, cuentaContableId: string, tenantId: string) {
    if (!(clave in CODIGOS_CUENTA)) {
      throw new BadRequestException(`"${clave}" no es un rol de cuenta contable válido`);
    }
    const cuenta = await this.repository.buscarPorId(cuentaContableId);
    if (!cuenta.activa) {
      throw new BadRequestException('No se puede asignar una cuenta inactiva');
    }
    const tipoEsperado = TIPO_ESPERADO_POR_ROL[clave as keyof typeof CODIGOS_CUENTA];
    if (cuenta.tipo !== tipoEsperado) {
      throw new BadRequestException(`Esta cuenta debe ser de tipo ${tipoEsperado} (la elegida es de tipo ${cuenta.tipo})`);
    }
    return this.repository.guardarConfiguracionCuentaSistema(tenantId, clave, cuentaContableId);
  }

  /** Vuelve al código fijo de siempre para ese rol — simplemente borra el override, si existía. */
  quitarConfiguracionCuentaSistema(clave: string, tenantId: string) {
    return this.repository.eliminarConfiguracionCuentaSistema(tenantId, clave);
  }
}
