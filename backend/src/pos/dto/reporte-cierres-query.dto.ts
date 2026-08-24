import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/** Filtros del reporte-dashboard de cierres de caja (plan de integración Cuadre, ítem E-6). */
export class ReporteCierresQueryDto {
  @ApiProperty({ required: false, description: 'Filtra por cerradoEn >= desde' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false, description: 'Filtra por cerradoEn <= hasta' })
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  cajeroId?: string;

  @ApiProperty({ required: false, description: 'Bodega ("Caja" en la terminología de Cuadre)' })
  @IsOptional()
  @IsUUID()
  bodegaId?: string;
}
