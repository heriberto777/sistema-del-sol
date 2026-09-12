import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearPasajeroTravelDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  nombre: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  apellido: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  tipoDocumento?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  numeroDocumento?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;
}
