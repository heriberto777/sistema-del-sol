import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn } from 'class-validator';

export class GenerarPeriodoDto {
  @ApiProperty({ enum: ['SEMANAL', 'QUINCENAL', 'BIMENSUAL', 'MENSUAL'] })
  @IsIn(['SEMANAL', 'QUINCENAL', 'BIMENSUAL', 'MENSUAL'])
  tipo: 'SEMANAL' | 'QUINCENAL' | 'BIMENSUAL' | 'MENSUAL';

  @ApiProperty()
  @IsDateString()
  fechaInicio: string;

  @ApiProperty()
  @IsDateString()
  fechaFin: string;
}
