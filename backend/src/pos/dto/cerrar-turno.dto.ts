import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class CerrarTurnoDto {
  @ApiProperty({ description: 'Efectivo contado físicamente en caja al cierre' })
  @IsNumber()
  @Min(0)
  montoFinalContado: number;
}
