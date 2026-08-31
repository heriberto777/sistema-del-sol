import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { LineaAjusteInventarioDto } from './crear-ajuste-inventario.dto';

/** Editar un ajuste en BORRADOR (ítem E-1) — la bodega no se puede cambiar acá, solo las líneas. */
export class ActualizarAjusteInventarioDto {
  @ApiProperty({ type: [LineaAjusteInventarioDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaAjusteInventarioDto)
  lineas: LineaAjusteInventarioDto[];
}
