import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class ActualizarPlanDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ required: false, type: [String], description: 'Si se envía, reemplaza el set completo de módulos incluidos' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modulos?: string[];
}
