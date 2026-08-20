import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CrearSucursalDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  nombre: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nombreComercial?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ciudad?: string;
}
