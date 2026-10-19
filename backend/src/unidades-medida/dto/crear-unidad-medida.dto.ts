import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CrearUnidadMedidaDto {
  @ApiProperty({ description: 'Código corto — ej. "UND", "CAJA", "DOC".' })
  @IsString()
  @MinLength(1)
  codigo: string;

  @ApiProperty({ description: 'Nombre visible — ej. "Unidad", "Caja", "Docena".' })
  @IsString()
  @MinLength(2)
  nombre: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
