import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ActualizarCorrelativoDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  prefijo?: string;

  @ApiProperty({ required: false, description: 'Próximo número a asignar (no el último usado) — igual criterio que NcfAsignado.secuenciaActual.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  siguienteNumero?: number;

  @ApiProperty({ required: false, description: 'Cantidad de dígitos para el padding con ceros a la izquierda.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  digitos?: number;
}
