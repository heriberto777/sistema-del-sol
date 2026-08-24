import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ReporteQueryDto {
  @ApiProperty({ required: false, description: 'Default: hace 30 días' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false, description: 'Default: hoy' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}

export class ExportarReporteQueryDto extends ReporteQueryDto {
  @ApiProperty({ enum: ['xlsx', 'pdf'] })
  @IsIn(['xlsx', 'pdf'])
  formato: 'xlsx' | 'pdf';
}

export class FormatoQueryDto {
  @ApiProperty({ enum: ['xlsx', 'pdf'] })
  @IsIn(['xlsx', 'pdf'])
  formato: 'xlsx' | 'pdf';
}

/** Filtro opcional por sucursal (Fase 8d) — Dashboard y Reporte de inventario, los únicos con noción real de bodega/ubicación. */
export class SucursalQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}

export class FormatoConSucursalQueryDto extends FormatoQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}

const DIMENSIONES_VENTAS = ['cliente', 'categoria', 'producto', 'vendedor', 'formaPago', 'codigoAlterno'] as const;

/** Catálogo de reportes ampliado (plan de integración Cuadre, ítem J-2) — ventas agrupadas por una de estas dimensiones. */
export class ReporteVentasAgrupadoQueryDto extends ReporteQueryDto {
  @ApiProperty({ enum: DIMENSIONES_VENTAS })
  @IsIn(DIMENSIONES_VENTAS)
  dimension: (typeof DIMENSIONES_VENTAS)[number];
}
