import { Injectable } from '@nestjs/common';
import { PreciosRepository } from './precios.repository';
import { ProductosService } from '../productos/productos.service';
import { CrearPrecioDto } from './dto/crear-precio.dto';

@Injectable()
export class PreciosService {
  constructor(
    private readonly preciosRepository: PreciosRepository,
    private readonly productosService: ProductosService,
  ) {}

  /** `Precio` no tiene tenantId propio (depende de Producto, que sí es tenant-scoped) — ver el comentario equivalente en InventarioService.validarPertenencia. */
  async vigente(productoId: string, listaPrecio?: string) {
    await this.productosService.buscarPorId(productoId);
    return this.preciosRepository.vigente(productoId, listaPrecio);
  }

  async historial(productoId: string, listaPrecio?: string) {
    await this.productosService.buscarPorId(productoId);
    return this.preciosRepository.historial(productoId, listaPrecio);
  }

  async crear(dto: CrearPrecioDto) {
    await this.productosService.buscarPorId(dto.productoId);
    const listaPrecio = dto.listaPrecio ?? 'GENERAL';
    // Margen % = ((Precio venta - Costo) / Costo) * 100
    // Precio venta = Costo * (1 + Margen% / 100)
    const precioVenta = dto.precioVenta ?? dto.costo * (1 + (dto.margenPct ?? 0) / 100);
    const margenPct = dto.margenPct ?? ((precioVenta - dto.costo) / dto.costo) * 100;

    return this.preciosRepository.crear({
      productoId: dto.productoId,
      listaPrecio,
      costo: dto.costo,
      margenPct,
      precioVenta,
    });
  }
}
