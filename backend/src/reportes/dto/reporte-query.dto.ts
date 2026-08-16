import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

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
