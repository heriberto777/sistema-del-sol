import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { TipoCliente } from '@prisma/client';
import { LineaCotizacionDto } from '../../cotizaciones/dto/crear-cotizacion.dto';

/**
 * `tipoClienteNuevo`/`rncCedulaClienteNuevo` solo se usan si la
 * oportunidad está sobre un Lead (sin Cliente todavía) — en ese caso
 * primero se lo convierte (ver LeadsService.convertir), después se
 * genera la cotización contra ese Cliente nuevo.
 *
 * `lineas` reusa el DTO de Cotizaciones (CRM "Cotización conectada") —
 * antes la cotización salía siempre con una única línea manual armada
 * del título/monto estimado de la oportunidad; ahora el vendedor arma
 * líneas reales del catálogo, igual que al crear cualquier otra
 * cotización. Si se omite, se mantiene el comportamiento anterior (línea
 * manual única) por compatibilidad.
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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaCotizacionDto)
  lineas?: LineaCotizacionDto[];
}
