import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, Min, MinLength, ValidateIf } from 'class-validator';

/** `clienteId`/`leadId` mutuamente excluyentes — una oportunidad nace sobre un prospecto o un cliente ya existente, nunca ninguno o ambos. */
export class CrearOportunidadDto {
  @IsString()
  @MinLength(3)
  titulo: string;

  @ValidateIf((o) => !o.leadId)
  @IsUUID()
  clienteId?: string;

  @ValidateIf((o) => !o.clienteId)
  @IsUUID()
  leadId?: string;

  @IsUUID()
  etapaId: string;

  @IsNumber()
  @IsPositive()
  montoEstimado: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probabilidadPct?: number;

  @IsDateString()
  fechaCierreEstimada: string;

  @IsOptional()
  @IsUUID()
  vendedorId?: string;
}
