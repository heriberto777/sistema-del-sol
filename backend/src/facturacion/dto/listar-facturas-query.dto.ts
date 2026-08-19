import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { TipoFactura } from '@prisma/client';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

/**
 * `tipoFactura` repetido en el query string (`?tipoFactura=NOTA_CREDITO&tipoFactura=NOTA_DEBITO`)
 * llega como array; un solo valor llega como string suelto — se normaliza
 * acá para que el repositorio siempre reciba un array. Usado por la
 * pantalla de Notas de Crédito/Débito (Fase 4a) para filtrar solo esos
 * dos tipos sin duplicar el endpoint de listado de facturas.
 */
export class ListarFacturasQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsArray()
  @IsEnum(TipoFactura, { each: true })
  @Transform(({ value }) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]))
  tipoFactura?: TipoFactura[];
}
