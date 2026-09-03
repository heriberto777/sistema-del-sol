import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

/**
 * Mismo shape que `ItemCarritoTienda` (frontend, `useCarritoTienda.ts`) —
 * se guarda tal cual, sin resolver nada contra el catálogo real acá (es
 * un caché de conveniencia, el checkout siempre revalida precio/stock).
 * `precio`/`precioOriginal` se aceptan como los manda el cliente porque
 * nunca se usan para cobrar nada — solo para repintar el carrito en otro
 * dispositivo.
 */
export class ItemCarritoTiendaDto {
  @IsUUID()
  productoId: string;

  @IsUUID()
  varianteId: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  varianteEtiqueta: string;

  @IsNumber()
  @Min(0)
  precio: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precioOriginal?: number;

  @IsOptional()
  @IsString()
  imagen: string | null;

  @IsPositive()
  cantidad: number;
}

export class GuardarCarritoTiendaDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ItemCarritoTiendaDto)
  items: ItemCarritoTiendaDto[];
}
