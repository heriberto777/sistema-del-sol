import { Injectable } from '@nestjs/common';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { CrearCuentaContableDto } from './dto/crear-cuenta-contable.dto';
import { CUENTAS_CATALOGO_COMPLETO } from './cuentas-base';

@Injectable()
export class CuentasContablesService {
  constructor(private readonly repository: CuentasContablesRepository) {}

  listar() {
    return this.repository.listar();
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
}
