import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AplicarConteoDto {
  @ApiProperty({ required: false, description: 'Requerido solo si el usuario tiene PIN configurado (Fase 9) y el neto de las diferencias es una salida de stock' })
  @IsOptional()
  @IsString()
  pin?: string;
}
