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

  @ApiProperty({
    required: false,
    description:
      'Requerido solo si el usuario tiene un PIN configurado (Fase 9) y (a) la diferencia supera la tolerancia, o (b) se cierra el turno de otro cajero',
  })
  @IsOptional()
  @IsString()
  pin?: string;
}
