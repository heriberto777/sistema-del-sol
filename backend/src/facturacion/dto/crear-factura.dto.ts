import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { TipoFactura } from '@prisma/client';

export class LineaFacturaDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty({ required: false, description: 'Obligatorio si el producto tiene más de una variante (Fase 3c)' })
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @ApiProperty({ required: false, description: 'Si se omite, se toma el precio de venta vigente del producto' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioUnitario?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @ApiProperty({
    required: false,
    default: true,
    description:
      'Toggle de ITBIS por línea (plan de integración Cuadre, ítem B-7) — false fuerza 0% en esta línea sin importar producto.porcentajeItbis (ej. venta exenta puntual).',
  })
  @IsOptional()
  @IsBoolean()
  aplicaItbis?: boolean;
}

export class RecargoFacturaDto {
  @ApiProperty({ description: 'Texto libre — no hay catálogo reusable, un recargo es puntual por factura (ej. "Imprevistos", "Viáticos")' })
  @IsString()
  concepto: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  monto: number;

  @ApiProperty({ required: false, default: false, description: 'Si aplica ITBIS (tasa general del tenant) sobre el monto del recargo' })
  @IsOptional()
  @IsBoolean()
  gravado?: boolean;
}

export class CrearFacturaDto {
  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty({ description: 'Bodega desde la que se descuenta el inventario' })
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ enum: TipoFactura })
  @IsEnum(TipoFactura)
  tipoFactura: TipoFactura;

  @ApiProperty({ type: [LineaFacturaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaFacturaDto)
  lineas: LineaFacturaDto[];

  @ApiProperty({ required: false, description: 'Requerido para notas de crédito/débito' })
  @IsOptional()
  @IsString()
  facturaOrigenId?: string;

  @ApiProperty({
    required: false,
    description:
      'Nivel de precio para resolver el precio vigente de cada línea sin precioUnitario explícito. Si se omite, se usa el listaPrecioId del cliente (o "GENERAL" si no tiene uno asignado).',
  })
  @IsOptional()
  @IsString()
  listaPrecio?: string;

  @ApiProperty({
    required: false,
    enum: ['REGIMEN_ESPECIAL', 'GUBERNAMENTAL'],
    description:
      'Solo si tipoFactura es CONTADO/CREDITO — usa B14/B15 (o su e-CF) en vez del NCF normal (plan de integración Cuadre, ítem B-1). Una Nota de Crédito/Débito siempre usa B03/B04, sin importar este campo.',
  })
  @IsOptional()
  @IsEnum(['REGIMEN_ESPECIAL', 'GUBERNAMENTAL'])
  tipoComprobanteEspecial?: 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL';

  @ApiProperty({
    required: false,
    description:
      'Descuento general de documento en % (0-100, plan de integración Cuadre, ítem B-8) — se prorratea entre las líneas (recalcula ITBIS por línea), además de cualquier descuento por línea/oferta. Excluyente con descuentoGeneralMonto.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoGeneralPct?: number;

  @ApiProperty({
    required: false,
    description: 'Descuento general de documento en RD$ (ítem B-8), mismo criterio que descuentoGeneralPct. Excluyente con descuentoGeneralPct.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoGeneralMonto?: number;

  @ApiProperty({
    required: false,
    default: 30,
    enum: [15, 30, 45, 60, 90],
    description:
      'Condición de pago en días (plan de integración Cuadre, ítem B-6) — el vencimiento se calcula como fecha + este plazo (ya usado por RecordatoriosService para facturas vencidas). Sin enviar, cae al default del schema (30).',
  })
  @IsOptional()
  @IsIn([15, 30, 45, 60, 90])
  plazoPagoDias?: number;

  @ApiProperty({
    required: false,
    default: 'DOP',
    description:
      'Ítem C-2 (multi-moneda) — código ISO de la moneda en la que se le PRESENTA el total al cliente (ej. "USD"). Requiere una TasaCambio configurada para esa moneda (400 si no existe). subtotal/itbis/total siguen siempre en DOP — esto solo agrega subtotalMoneda/itbisMoneda/totalMoneda para el documento impreso; NCF/contabilidad/reportes/pagos no se ven afectados.',
  })
  @IsOptional()
  @IsString()
  moneda?: string;

  @ApiProperty({
    required: false,
    type: [RecargoFacturaDto],
    description: 'Cargos post-subtotal (plan de integración Cuadre, ítem B-4) — se suman después del descuento general de documento, antes del total.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecargoFacturaDto)
  recargos?: RecargoFacturaDto[];
}
