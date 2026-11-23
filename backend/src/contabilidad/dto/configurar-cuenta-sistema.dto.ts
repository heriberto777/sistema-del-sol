import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

/** docs/PLAN.md, punto 4 — `clave` se valida contra CODIGOS_CUENTA en el service, no acá (una lista fija en el DTO se desincronizaría). */
export class ConfigurarCuentaSistemaDto {
  @ApiProperty({ description: 'Una de las claves de CODIGOS_CUENTA (ej. "CAJA_BANCOS")' })
  @IsString()
  clave: string;

  @ApiProperty()
  @IsUUID()
  cuentaContableId: string;
}
