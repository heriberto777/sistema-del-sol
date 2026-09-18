import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegistroClienteTiendaDto {
  // Endpoint público sin login (cualquiera puede registrarse) — este
  // valor llega tal cual a Cliente.nombre y de ahí a variables de email
  // como {{cliente_nombre}} (ver plantilla-renderer.ts, ya escapa HTML,
  // pero igual conviene no aceptar un payload arbitrariamente largo acá).
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telefono?: string;
}
