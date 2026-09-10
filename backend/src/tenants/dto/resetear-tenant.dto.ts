import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export const MODOS_RESETEO_TENANT = ['TRANSACCIONAL', 'COMPLETO'] as const;
export type ModoReseteoTenant = (typeof MODOS_RESETEO_TENANT)[number];

export class ResetearTenantDto {
  @ApiProperty({
    enum: MODOS_RESETEO_TENANT,
    description:
      'TRANSACCIONAL: borra solo lo generado (facturas, pagos, movimientos, etc.), preserva catálogos y configuración. ' +
      'COMPLETO: además vacía Productos/Clientes/Empleados y reinicia Roles/Cuentas contables/Formas de pago/Listas de precio a los valores base.',
  })
  @IsIn(MODOS_RESETEO_TENANT)
  modo: ModoReseteoTenant;

  @ApiProperty({ description: 'Subdominio exacto del tenant, tipeado por el admin como confirmación — mismo criterio que un borrado irreversible.' })
  @IsString()
  confirmacionSubdominio: string;
}
