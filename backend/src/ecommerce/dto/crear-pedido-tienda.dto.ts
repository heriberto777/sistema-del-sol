import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEmail, IsNotEmpty, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export class LineaPedidoTiendaDto {
  @IsUUID()
  productoId: string;

  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @IsPositive()
  cantidad: number;
}

/**
 * Sin `precioUnitario` a propósito — nunca se confía en un precio que
 * mande el cliente. `FacturacionService.crear()` resuelve el precio
 * vigente del catálogo cuando la línea no lo trae (mismo mecanismo que
 * ya usan Facturación/POS), así que omitirlo acá ES la revalidación de
 * precio, no un paso aparte.
 */
export class CrearPedidoTiendaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaPedidoTiendaDto)
  lineas: LineaPedidoTiendaDto[];

  @IsString()
  @IsNotEmpty()
  clienteNombre: string;

  @IsString()
  @IsNotEmpty()
  clienteTelefono: string;

  @IsEmail()
  clienteEmail: string;

  @IsString()
  @IsNotEmpty()
  direccionEntrega: string;

  // Ítem "documento fiscal del comprador" — pedido explícito del usuario,
  // obligatorio. Se guarda en Cliente.rncCedula (el mismo campo que ya usa
  // Contactos/facturación admin — no un dato suelto del pedido) para que
  // quede en el perfil real y no haya que volver a pedirlo la próxima
  // compra (ver EcommerceService.crearPedido).
  @IsString()
  @IsNotEmpty()
  clienteDocumento: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
