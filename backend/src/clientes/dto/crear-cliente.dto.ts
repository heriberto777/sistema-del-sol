import { ApiProperty } from '@nestjs/swagger';
import { TipoCliente } from '@prisma/client';
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CrearClienteDto {
  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty({ enum: TipoCliente, default: TipoCliente.PERSONA_FISICA })
  @IsEnum(TipoCliente)
  tipo: TipoCliente;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rncCedula?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteCredito?: number;

  @ApiProperty({ required: false, description: 'Nivel de precio por defecto de este cliente. Si se omite/null, resuelve a "GENERAL" al facturar.' })
  @IsOptional()
  @IsUUID()
  listaPrecioId?: string | null;
}
