import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CrearDireccionClienteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  direccion: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;
}

export class ActualizarDireccionClienteDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;
}
