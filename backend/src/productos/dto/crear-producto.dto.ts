import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Matches, MaxLength, Max, Min, ValidateNested } from 'class-validator';
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

export class SeleccionAtributoDto {
  @ApiProperty()
  @IsUUID()
  atributoId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  valoresIds: string[];
}

export class CrearProductoDto {
  @ApiProperty()
  @IsString()
  codigo: string;

  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false, nullable: true, description: 'null explícito quita la categoría asignada' })
  @IsOptional()
  @IsUUID()
  categoriaId?: string | null;

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

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Ley fiscal aplicable (plan de integración Cuadre, ítem B-3) — reduce el ITBIS efectivo de este producto. null explícito quita la asignación.',
  })
  @IsOptional()
  @IsUUID()
  leyFiscalId?: string | null;

  @ApiProperty({ enum: TipoProducto, required: false, default: 'PRODUCTO' })
  @IsOptional()
  @IsEnum(TipoProducto)
  tipo?: TipoProducto;

  @ApiProperty({ required: false, default: false, description: 'Opt-in (Fase 5b) — habilita lotes con fecha de vencimiento y consumo FEFO en ventas para este producto' })
  @IsOptional()
  @IsBoolean()
  controlaVencimiento?: boolean;

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

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Data URI completa (data:image/...;base64,...) — el cliente la comprime/redimensiona antes de enviarla. `null` explícito quita la foto existente.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, { message: 'imagen debe ser una data URI de imagen (jpeg/png/webp)' })
  @MaxLength(2_000_000, { message: 'La imagen es demasiado pesada — comprimila antes de subirla' })
  imagen?: string | null;

  @ApiProperty({
    type: [SeleccionAtributoDto],
    required: false,
    description:
      'Solo tiene efecto al editar (PATCH) — genera el producto cartesiano de los valores elegidos por atributo (una VarianteProducto por combinación) y reemplaza por completo las variantes actuales. `[]` revierte a una única variante "por defecto" sin atributos.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeleccionAtributoDto)
  atributos?: SeleccionAtributoDto[];
}
