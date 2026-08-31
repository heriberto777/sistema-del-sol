import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { LineaTransferenciaInventarioDto } from './crear-transferencia-inventario.dto';

/** Editar una transferencia en BORRADOR (ítem E-1) — las bodegas no se pueden cambiar acá, solo las líneas. */
export class ActualizarTransferenciaInventarioDto {
  @ApiProperty({ type: [LineaTransferenciaInventarioDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaTransferenciaInventarioDto)
  lineas: LineaTransferenciaInventarioDto[];
}
