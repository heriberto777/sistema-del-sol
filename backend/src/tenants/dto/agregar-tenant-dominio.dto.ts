import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AgregarTenantDominioDto {
  @ApiProperty({ description: 'Dominio propio a asignar, ej. "shopy-me.com" o "www.shopy-me.com" — sin protocolo ni ruta' })
  @IsString()
  @MinLength(3)
  dominio!: string;
}
