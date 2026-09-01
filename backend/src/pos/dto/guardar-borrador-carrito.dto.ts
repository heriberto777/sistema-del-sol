import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

/**
 * A diferencia de LineaVentaAparcadaDto (aparcado explícito, F12), esta línea
 * lleva también `codigo`/`nombre`/`precioVariable` — el borrador se restaura
 * en el frontend sin volver a pedirle nada al catálogo (ver
 * TurnoCajaDetalle.tsx, restauración al abrir el turno).
 */
export class LineaBorradorCarritoDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @ApiProperty()
  @IsString()
  codigo: string;

  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  porcentajeItbis: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  precioVariable?: boolean;
}

/**
 * Snapshot del carrito en curso — el frontend lo manda en cada cambio
 * (agregar/quitar línea, cambiar cliente/vendedor, etc.), debounced. Sin
 * `ArrayMinSize` a propósito: un carrito vacío es una petición válida
 * (aunque en la práctica el frontend borra el borrador en vez de mandar
 * uno vacío — ver PosService.guardarBorrador).
 */
export class GuardarBorradorCarritoDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  vendedorEmpleadoId?: string;

  @ApiProperty({ required: false, description: 'Nombre de la ListaPrecio (ej. "MAYORISTA"), no su id — mismo campo que RegistrarVentaPosDto.listaPrecio.' })
  @IsOptional()
  @IsString()
  listaPrecio?: string;

  @ApiProperty({ required: false, enum: ['CONTADO', 'CREDITO'] })
  @IsOptional()
  @IsIn(['CONTADO', 'CREDITO'])
  tipoFactura?: 'CONTADO' | 'CREDITO';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comprobanteFiscal?: string;

  @ApiProperty({ type: [LineaBorradorCarritoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineaBorradorCarritoDto)
  lineas: LineaBorradorCarritoDto[];
}
