import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ActualizarModuloTenantDto {
  @ApiProperty({
    nullable: true,
    description: 'true = forzar activo, false = forzar apagado, null = quitar la excepción y volver a heredar del plan',
  })
  @IsIn([true, false, null])
  activo: boolean | null;
}
