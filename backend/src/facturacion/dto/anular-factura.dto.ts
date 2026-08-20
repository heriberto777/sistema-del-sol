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
}
