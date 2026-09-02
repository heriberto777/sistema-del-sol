import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Matches, MaxLength, Max, Min, ValidateNested } from 'class-validator';
import { AjusteImagenProducto, TipoProducto } from '@prisma/client';

/** Plan de integración Cuadre, ítem E-8 — lista cerrada (antes String libre sin validar). 'UND' se mantiene por compatibilidad con el default histórico. */
export const UNIDADES_MEDIDA = ['UND', 'KILOGRAMO', 'GRAMO', 'LIBRA', 'ONZA', 'LITRO', 'MILILITRO', 'GALON', 'PORCION', 'DOCENA'] as const;

export class ComponenteComboDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;
}

export class ImagenProductoDto {
  @ApiProperty({ description: 'Data URI completa (data:image/...;base64,...), misma validación que `imagen`.' })
  @IsString()
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, { message: 'imagen debe ser una data URI de imagen (jpeg/png/webp)' })
  @MaxLength(2_000_000, { message: 'La imagen es demasiado pesada — comprimila antes de subirla' })
  imagen: string;
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

  @ApiProperty({ required: false, default: 'UND', enum: UNIDADES_MEDIDA })
  @IsOptional()
  @IsIn(UNIDADES_MEDIDA)
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

  @ApiProperty({ required: false, default: false, description: 'Plan de integración Cuadre, ítem E-8 — habilita un precio editable por línea en el carrito del POS (ej. artículos de precio negociado)' })
  @IsOptional()
  @IsBoolean()
  precioVariable?: boolean;

  @ApiProperty({ required: false, default: false, description: 'Puramente informativo — no hay motor de recetas/BOM' })
  @IsOptional()
  @IsBoolean()
  esIngrediente?: boolean;

  @ApiProperty({ required: false, default: true, description: 'Si es false, este producto no puede incluirse en una Nota de Crédito' })
  @IsOptional()
  @IsBoolean()
  permiteDevolucion?: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Ítem A-1 — % de comisión de venta sobre el monto neto (sin ITBIS, después de descuento) de cada línea vendida de este producto. Mutuamente excluyente con montoComisionFijo (400 si vienen ambos). null explícito lo quita.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeComision?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Ítem A-1 — comisión fija en RD$ por cada unidad vendida de este producto (alternativa a porcentajeComision). null explícito lo quita.',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  montoComisionFijo?: number | null;

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
    enum: AjusteImagenProducto,
    required: false,
    default: 'COVER',
    description: 'Cómo encajar la imagen dentro del recuadro de la tarjeta (catálogo del POS) — mismo criterio que object-fit de CSS.',
  })
  @IsOptional()
  @IsEnum(AjusteImagenProducto)
  imagenAjuste?: AjusteImagenProducto;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Copy de marketing para la Tienda Online (Fase 5, plugin e-commerce) — sin efecto en Facturación/POS/Compras. null explícito lo quita.',
  })
  @IsOptional()
  @IsString()
  descripcionTienda?: string | null;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Opt-in manual (Fase 11, plugin e-commerce) — aparece en la sección "Destacados" del storefront público. Nadie se destaca automáticamente por ventas/fecha.',
  })
  @IsOptional()
  @IsBoolean()
  destacado?: boolean;

  @ApiProperty({
    type: [ImagenProductoDto],
    required: false,
    description:
      'Fotos adicionales para la Tienda Online (Fase 5) — `imagen` sigue siendo la portada. Sin enviar el campo, la galería existente queda igual; `[]` la vacía; con elementos, la reemplaza por completo.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImagenProductoDto)
  imagenesAdicionales?: ImagenProductoDto[];

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
