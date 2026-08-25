import { BadRequestException, Injectable } from '@nestjs/common';
import { CajasRepository } from './cajas.repository';
import { CrearCajaDto } from './dto/crear-caja.dto';

@Injectable()
export class CajasService {
  constructor(private readonly cajasRepository: CajasRepository) {}

  crear(dto: CrearCajaDto, tenantId: string) {
    return this.cajasRepository.crear(dto, tenantId);
  }

  listar() {
    return this.cajasRepository.listar();
  }

  buscarPorId(id: string) {
    return this.cajasRepository.buscarPorId(id);
  }

  actualizar(id: string, dto: Partial<CrearCajaDto>) {
    return this.cajasRepository.actualizar(id, dto);
  }

  eliminar(id: string) {
    return this.cajasRepository.eliminar(id);
  }

  /**
   * Ítem E-7 — llamado desde `PosService.registrarVenta` SOLO si el
   * turno abierto tiene una Caja asignada (decisión confirmada con el
   * usuario: la restricción es exclusiva del checkout de POS, nunca de
   * Facturación directa). Lista blanca combinada: sin ninguna categoría
   * ni producto asignado a la Caja, vende el catálogo completo.
   */
  async validarLineasPermitidas(cajaId: string, productoIds: string[]) {
    const restriccion = await this.cajasRepository.buscarRestriccion(cajaId);
    const sinRestriccion = restriccion.categorias.length === 0 && restriccion.productos.length === 0;
    if (sinRestriccion) return;

    const categoriasPermitidas = new Set(restriccion.categorias.map((c) => c.categoriaId));
    const productosPermitidos = new Set(restriccion.productos.map((p) => p.productoId));

    const productos = await this.cajasRepository.productosInfo([...new Set(productoIds)]);
    for (const producto of productos) {
      const permitido = productosPermitidos.has(producto.id) || (!!producto.categoriaId && categoriasPermitidas.has(producto.categoriaId));
      if (!permitido) {
        throw new BadRequestException(`Esta caja no puede vender "${producto.nombre}"`);
      }
    }
  }
}
