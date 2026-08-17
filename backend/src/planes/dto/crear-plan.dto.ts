import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CrearPlanDto {
  @ApiProperty({ example: 'Profesional' })
  @IsString()
  nombre: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ type: [String], description: 'Claves de módulos incluidos (ver MODULOS_BASE)' })
  @IsArray()
  @IsString({ each: true })
  modulos: string[];
}
