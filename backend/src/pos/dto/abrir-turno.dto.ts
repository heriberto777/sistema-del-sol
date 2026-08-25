import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class AbrirTurnoDto {
  @ApiProperty()
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ description: 'Efectivo con el que se abre la caja' })
  @IsNumber()
  @Min(0)
  montoInicial: number;

  @ApiProperty({ required: false, description: 'Ítem E-7 — terminal física; sin esto, el turno no tiene ninguna restricción de catálogo' })
  @IsOptional()
  @IsUUID()
  cajaId?: string;
}
