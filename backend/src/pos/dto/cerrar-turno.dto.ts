import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CerrarTurnoDto {
  @ApiProperty({ description: 'Efectivo contado físicamente en caja al cierre' })
  @IsNumber()
  @Min(0)
  montoFinalContado: number;

  @ApiProperty({ required: false, description: 'Obligatoria solo si la diferencia supera la tolerancia configurada del tenant' })
  @IsOptional()
  @IsString()
  justificacionDiferencia?: string;
}
