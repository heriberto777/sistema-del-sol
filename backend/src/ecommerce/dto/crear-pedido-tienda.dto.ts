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

  @IsOptional()
  @IsEmail()
  clienteEmail?: string;

  @IsString()
  @IsNotEmpty()
  direccionEntrega: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
