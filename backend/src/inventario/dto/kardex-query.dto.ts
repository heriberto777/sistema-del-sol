import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class KardexQueryDto {
  @ApiProperty({ required: false, description: 'Si se omite, agrega el kardex de la variante en TODAS las bodegas del tenant (plan de integración Cuadre, ítem E-3)' })
  @IsOptional()
  @IsUUID()
  bodegaId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
