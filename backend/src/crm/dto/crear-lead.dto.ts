import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { OrigenLead } from '@prisma/client';

export class CrearLeadDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEnum(OrigenLead)
  origen?: OrigenLead;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsUUID()
  vendedorId?: string;
}
