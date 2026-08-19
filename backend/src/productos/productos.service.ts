import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TipoProducto } from '@prisma/client';
import { ProductosRepository } from './productos.repository';
import { CrearProductoDto, ComponenteComboDto } from './dto/crear-producto.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { CatalogoQueryDto } from './dto/catalogo-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class ProductosService {
  constructor(private readonly productosRepository: ProductosRepository) {}

  async crear(dto: CrearProductoDto, tenantId: string) {
    const tipoEfectivo = dto.tipo ?? 'PRODUCTO';
    await this.validarComponentes(dto.componentes, tipoEfectivo);
    return this.productosRepository.crear(dto, tenantId);
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.productosRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  async catalogo(query: CatalogoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [filas, total] = await this.productosRepository.catalogo({
      skip,
      take,
      busqueda: query.busqueda,
      categoria: query.categoria,
    });
    const datos = filas.map(({ precios, ...producto }) => ({ ...producto, precioVenta: precios[0]?.precioVenta ?? null }));
    return { datos, total, pagina, tamanoPagina };
  }

  categorias() {
    return this.productosRepository.categoriasDistintas();
  }

  buscarPorId(id: string) {
    return this.productosRepository.buscarPorId(id);
  }

  buscarPorIdEnTx(tx: Prisma.TransactionClient, id: string) {
    return this.productosRepository.buscarPorIdEnTx(tx, id);
  }

  async actualizar(id: string, dto: Partial<CrearProductoDto>) {
    if (dto.tipo === undefined && dto.componentes === undefined) {
      return this.productosRepository.actualizar(id, dto);
    }

    const actual = await this.productosRepository.buscarPorId(id);
    const tipoEfectivo = dto.tipo ?? actual.tipo;
    // Si deja de ser COMBO (o nunca lo fue), no tiene sentido conservar
    // componentes viejos colgando — se limpian a propósito, aunque el
    // caller no haya mandado `componentes` explícitamente.
    const componentes = tipoEfectivo === 'COMBO' ? dto.componentes : [];

    await this.validarComponentes(componentes, tipoEfectivo, id);
    return this.productosRepository.actualizar(id, { ...dto, componentes });
  }

  /**
   * Reglas de un combo, validadas en la capa de servicio antes de tocar la
   * base (ver docs del plan): los componentes solo tienen sentido en un
   * COMBO, un combo no puede componerse de sí mismo, y no se permiten
   * combos anidados (un componente no puede ser a su vez un COMBO) — sin
   * este límite, expandir el inventario al facturar necesitaría recursión
   * sin cota.
   */
  private async validarComponentes(
    componentes: ComponenteComboDto[] | undefined,
    tipoEfectivo: TipoProducto,
    idPropio?: string,
  ) {
    if (!componentes?.length) return;

    if (tipoEfectivo !== 'COMBO') {
      throw new BadRequestException('Solo un producto de tipo COMBO puede tener componentes');
    }
    if (idPropio && componentes.some((c) => c.productoId === idPropio)) {
      throw new BadRequestException('Un combo no puede tener un componente que sea el propio combo');
    }

    const productos = await Promise.all(componentes.map((c) => this.productosRepository.buscarPorId(c.productoId)));
    const comboAnidado = productos.find((p) => p.tipo === 'COMBO');
    if (comboAnidado) {
      throw new BadRequestException(`El producto "${comboAnidado.nombre}" es un combo — no se pueden anidar combos`);
    }
  }
}
