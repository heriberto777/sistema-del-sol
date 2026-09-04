import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { LineaPedidoTiendaDto } from './crear-pedido-tienda.dto';

/**
 * Mismas líneas que `CrearPedidoTiendaDto` (sin datos de contacto/entrega,
 * acá solo importa el total) — para que el carrito/checkout puedan pedir
 * el subtotal/ITBIS/total exactos ANTES de crear el pedido, sin duplicar
 * ninguna cuenta del lado del frontend (ver EcommerceService.previsualizarPedido).
 */
export class PrevisualizarPedidoTiendaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaPedidoTiendaDto)
  lineas: LineaPedidoTiendaDto[];
}
