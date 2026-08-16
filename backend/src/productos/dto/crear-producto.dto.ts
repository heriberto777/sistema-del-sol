import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { TipoProducto } from '@prisma/client';

export class ComponenteComboDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;
}

export class CrearProductoDto {
  @ApiProperty()
  @IsString()
  codigo: string;

  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoria?: string;

  @ApiProperty({ required: false, default: 'UND' })
  @IsOptional()
  @IsString()
  unidadMedida?: string;

  @ApiProperty({ required: false, default: 18 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeItbis?: number;

  @ApiProperty({ enum: TipoProducto, required: false, default: 'PRODUCTO' })
  @IsOptional()
  @IsEnum(TipoProducto)
  tipo?: TipoProducto;

  @ApiProperty({
    type: [ComponenteComboDto],
    required: false,
    description: 'Solo tiene efecto cuando tipo=COMBO — los productos (PRODUCTO o SERVICIO, nunca otro COMBO) que se descuentan al facturar este combo',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ComponenteComboDto)
  componentes?: ComponenteComboDto[];
}
