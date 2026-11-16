import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CerrarPeriodoDto {
  @ApiProperty({ description: 'Período a cerrar — debe ser el ABIERTO más antiguo (ver CierrePeriodoService.cerrarPeriodo)' })
  @IsUUID()
  periodoId!: string;
}
