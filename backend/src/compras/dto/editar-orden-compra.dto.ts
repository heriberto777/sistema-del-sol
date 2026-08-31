import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { LineaOcDto } from './crear-orden-compra.dto';

/** Editar una OC en BORRADOR (ítem E-1) — el proveedor no se puede cambiar acá, solo las líneas. */
export class EditarOrdenCompraDto {
  @ApiProperty({ type: [LineaOcDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaOcDto)
  lineas: LineaOcDto[];
}
