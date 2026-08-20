import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNumber, IsPositive, Max, Min } from 'class-validator';

/** Tope de 500 por lote — salvavidas contra un request que dispare miles de inserts, no un límite de negocio (mismo criterio que MAX_COMBINACIONES en variantes). */
const MAX_BONOS_POR_LOTE = 500;

export class EmitirLoteBonosDto {
  @ApiProperty({ maximum: MAX_BONOS_POR_LOTE })
  @IsInt()
  @Min(1)
  @Max(MAX_BONOS_POR_LOTE)
  cantidad: number;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  montoPorBono: number;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  fechaVencimiento: Date;
}
