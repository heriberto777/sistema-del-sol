import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class AbrirTurnoDto {
  @ApiProperty()
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ description: 'Efectivo con el que se abre la caja' })
  @IsNumber()
  @Min(0)
  montoInicial: number;
}
