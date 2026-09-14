import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Todos los campos opcionales — solo se actualiza lo que venga. Para
 * smtpPassword: string no vacío = nuevo valor (se cifra server-side), ""
 * = borra el override, omitido = sin cambios. Nunca se acepta/devuelve
 * en texto plano fuera de este flujo.
 */
export class ActualizarEmailConfigTenantDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  habilitado?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  smtpPort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiProperty({ required: false, description: '"" borra el override guardado' })
  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpFrom?: string;
}
