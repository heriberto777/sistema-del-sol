import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { TipoCliente } from '@prisma/client';

/**
 * `tipoClienteNuevo`/`rncCedulaClienteNuevo` solo se usan si la
 * oportunidad está sobre un Lead (sin Cliente todavía) — en ese caso
 * primero se lo convierte (ver LeadsService.convertir), después se
 * genera la cotización contra ese Cliente nuevo.
 */
export class ConvertirOportunidadDto {
  @IsDateString()
  fechaVigenciaHastaCotizacion: string;

  @IsOptional()
  @IsEnum(TipoCliente)
  tipoClienteNuevo?: TipoCliente;

  @IsOptional()
  @IsString()
  rncCedulaClienteNuevo?: string;
}
