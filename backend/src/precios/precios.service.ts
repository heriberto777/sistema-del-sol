import { Injectable } from '@nestjs/common';
import { PreciosRepository } from './precios.repository';
import { ProductosService } from '../productos/productos.service';
import { VariantesService } from '../variantes/variantes.service';
import { CrearPrecioDto } from './dto/crear-precio.dto';

@Injectable()
export class PreciosService {
  constructor(
    private readonly preciosRepository: PreciosRepository,
    private readonly productosService: ProductosService,
    private readonly variantesService: VariantesService,
  ) {}

  /**
   * `Precio` no tiene tenantId propio (depende de VarianteProducto, que a
   * su vez depende de Producto, sí tenant-scoped) — ver el comentario
   * equivalente en InventarioService.validarPertenencia.
   * `varianteId` (Fase 3c) es obligatorio si el producto tiene más de una
   * variante real — ver VariantesService.resolverObligatoria.
   */
  async vigente(productoId: string, varianteId?: string, listaPrecio?: string) {
    await this.productosService.buscarPorId(productoId);
    const varianteResuelta = await this.variantesService.resolverObligatoria(productoId, varianteId);
    return this.preciosRepository.vigente(varianteResuelta, listaPrecio);
  }

  async historial(productoId: string, varianteId?: string, listaPrecio?: string) {
    await this.productosService.buscarPorId(productoId);
    const varianteResuelta = await this.variantesService.resolverObligatoria(productoId, varianteId);
    return this.preciosRepository.historial(varianteResuelta, listaPrecio);
  }

  async crear(dto: CrearPrecioDto) {
    await this.productosService.buscarPorId(dto.productoId);
    const varianteId = await this.variantesService.resolverObligatoria(dto.productoId, dto.varianteId);
    const listaPrecio = dto.listaPrecio ?? 'GENERAL';
    // Margen % = ((Precio venta - Costo) / Costo) * 100
    // Precio venta = Costo * (1 + Margen% / 100)
    const precioVenta = dto.precioVenta ?? dto.costo * (1 + (dto.margenPct ?? 0) / 100);
    const margenPct = dto.margenPct ?? ((precioVenta - dto.costo) / dto.costo) * 100;

    return this.preciosRepository.crear({
      varianteId,
      listaPrecio,
      costo: dto.costo,
      margenPct,
      precioVenta,
    });
  }
}
