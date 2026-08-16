import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn } from 'class-validator';

export class GenerarPeriodoDto {
  @ApiProperty({ enum: ['QUINCENAL', 'MENSUAL'] })
  @IsIn(['QUINCENAL', 'MENSUAL'])
  tipo: 'QUINCENAL' | 'MENSUAL';

  @ApiProperty()
  @IsDateString()
  fechaInicio: string;

  @ApiProperty()
  @IsDateString()
  fechaFin: string;
}
