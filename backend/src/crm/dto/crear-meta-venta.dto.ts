import { IsInt, IsNumber, IsPositive, IsUUID, Max, Min } from 'class-validator';

export class CrearMetaVentaDto {
  @IsUUID()
  vendedorId: string;

  @IsInt()
  @Min(2020)
  anio: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @IsNumber()
  @IsPositive()
  montoMeta: number;
}
