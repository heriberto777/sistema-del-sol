import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Mismos campos editables de CrearPublicacionSocialDto, sin productoId (no cambia al regenerar). */
export class RegenerarPublicacionSocialDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  plantillaId?: string;

  @ApiProperty({ required: false, description: 'Describe la ambientación deseada — genera el fondo con IA' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  promptIa?: string;

  @ApiProperty({ required: false, enum: ['CUADRADO', 'VERTICAL'] })
  @IsOptional()
  @IsIn(['CUADRADO', 'VERTICAL'])
  formato?: 'CUADRADO' | 'VERTICAL';
}
