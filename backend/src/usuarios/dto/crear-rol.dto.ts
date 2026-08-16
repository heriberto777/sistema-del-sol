import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class CrearRolDto {
  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ type: [String], example: ['facturacion.crear', 'facturacion.ver'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permisos: string[];
}
