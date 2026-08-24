import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class AnularFacturaDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  motivo: string;

  @ApiProperty({ required: false, description: 'Requerido solo si el usuario tiene un PIN configurado (Fase 9)' })
  @IsOptional()
  @IsString()
  pin?: string;

  @ApiProperty({
    required: false,
    description: 'Código de un solo uso enviado por email a un tercero — requerido solo si el tenant activó la segunda capa de autorización (ítem D-1)',
  })
  @IsOptional()
  @IsString()
  codigoAutorizacion?: string;
}
