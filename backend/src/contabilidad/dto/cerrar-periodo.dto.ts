import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class CerrarPeriodoDto {
  @ApiProperty({ description: 'Fecha de corte del período a cerrar (inclusive)' })
  @IsDateString()
  fecha!: string;
}
