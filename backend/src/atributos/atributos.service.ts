import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AtributosRepository } from './atributos.repository';

@Injectable()
export class AtributosService {
  constructor(private readonly atributosRepository: AtributosRepository) {}

  crear(nombre: string, tenantId: string) {
    return this.atributosRepository.crear(nombre, tenantId);
  }

  listar() {
    return this.atributosRepository.listar();
  }

  async crearValor(atributoId: string, valor: string) {
    // findUniqueOrThrow tenant-scoped: si atributoId es de otro tenant, 404 —
    // mismo patrón de prevención de IDOR ya documentado para FKs
    // cliente-suministradas.
    await this.atributosRepository.buscarPorId(atributoId);
    return this.atributosRepository.crearValor(atributoId, valor);
  }

  /**
   * `ValorAtributo` es una tabla "hija" sin tenantId propio (como
   * `ComponenteCombo`) — su aislamiento depende de validar primero el
   * padre (`Atributo`, tenant-scoped) y recién ahí confirmar que el valor
   * realmente pertenece a ESE atributo, antes de tocarlo.
   */
  async eliminarValor(atributoId: string, valorId: string) {
    const atributo = await this.atributosRepository.buscarPorId(atributoId);
    const valor = atributo.valores.find((v) => v.id === valorId);
    if (!valor) {
      throw new NotFoundException('El valor no pertenece a este atributo');
    }
    if (valor._count.variantes > 0) {
      throw new BadRequestException('No se puede eliminar: hay variantes de producto usando este valor');
    }
    return this.atributosRepository.eliminarValor(valorId);
  }

  async eliminarAtributo(id: string) {
    const atributo = await this.atributosRepository.buscarPorId(id);
    const valorEnUso = atributo.valores.find((v) => v._count.variantes > 0);
    if (valorEnUso) {
      throw new BadRequestException(`No se puede eliminar: el valor "${valorEnUso.valor}" está en uso por alguna variante de producto`);
    }
    return this.atributosRepository.eliminarAtributo(id);
  }
}
