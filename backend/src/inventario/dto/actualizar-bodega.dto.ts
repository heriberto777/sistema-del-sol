import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { FormatoImpresion, MetodoAperturaCaja } from '@prisma/client';

export class ActualizarBodegaDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({ required: false, description: 'Mover esta bodega a otra sucursal.' })
  @IsOptional()
  @IsString()
  sucursalId?: string;

  @ApiProperty({ required: false, description: 'Inactivarla la saca de los selectores de bodega de toda la app (GET /inventario/bodegas).' })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @ApiProperty({ enum: FormatoImpresion, required: false, nullable: true })
  @IsOptional()
  @IsEnum(FormatoImpresion)
  formatoImpresion?: FormatoImpresion | null;

  @ApiProperty({ enum: MetodoAperturaCaja, required: false, nullable: true, description: 'null = usa el default de la empresa (Configuracion[CAJA_METODO_APERTURA_DEFAULT]).' })
  @IsOptional()
  @IsEnum(MetodoAperturaCaja)
  metodoAperturaCaja?: MetodoAperturaCaja | null;
}
