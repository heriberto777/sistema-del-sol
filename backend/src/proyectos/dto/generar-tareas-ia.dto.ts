import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GenerarTareasIaDto {
  @ApiProperty({ description: 'Nombre del proyecto — contexto para la IA' })
  @IsString()
  nombreProyecto: string;

  @ApiProperty({ description: 'Descripción o prompt libre de qué trata el proyecto' })
  @IsString()
  @MinLength(10)
  descripcion: string;
}
