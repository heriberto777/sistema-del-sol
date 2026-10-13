import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

/** CONVERTIDO queda fuera a propósito — reservado para la Fase 2 (conversión a Cliente), ver crm.service. */
export class CambiarEstadoLeadDto {
  @IsEnum(['NUEVO', 'CONTACTADO', 'CALIFICADO', 'DESCARTADO'])
  estado: 'NUEVO' | 'CONTACTADO' | 'CALIFICADO' | 'DESCARTADO';

  // Obligatorio solo si estado = DESCARTADO (validado en el servicio).
  @IsOptional()
  @IsString()
  @MinLength(3)
  motivoDescarte?: string;
}
