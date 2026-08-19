import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CrearListaPrecioDto {
  @ApiProperty({ description: 'Debe coincidir exactamente con el string usado en Precio.listaPrecio — sin FK entre ambos.' })
  @IsString()
  @MinLength(2)
  nombre: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
