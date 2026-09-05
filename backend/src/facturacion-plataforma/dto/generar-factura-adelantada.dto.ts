import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class GenerarFacturaAdelantadaDto {
  @ApiProperty({ description: 'Cuántos ciclos del plan (meses o años, según cicloFacturacion) se cobran de una sola vez' })
  @IsInt()
  @Min(1)
  ciclos!: number;
}
