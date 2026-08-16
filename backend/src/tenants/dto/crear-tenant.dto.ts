import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CrearTenantDto {
  @ApiProperty({ example: 'Distribuidora Ejemplo SRL' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: 'distribuidora-ejemplo', description: 'Subdominio único, solo minúsculas/números/guiones' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'El subdominio solo puede tener minúsculas, números y guiones' })
  subdominio: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rnc?: string;

  @ApiProperty({ example: 'admin@distribuidora-ejemplo.com' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'Administrador' })
  @IsString()
  adminNombre: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  adminPassword: string;
}
