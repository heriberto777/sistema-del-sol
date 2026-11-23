import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class LineaAsientoDto {
  @ApiProperty()
  @IsUUID()
  cuentaContableId: string;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @Min(0)
  debito?: number;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @Min(0)
  credito?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ required: false, description: 'Centro de Costo (docs/PLAN.md, punto 3) — opcional, por línea' })
  @IsOptional()
  @IsUUID()
  centroCostoId?: string;
}

export class CrearAsientoDto {
  @ApiProperty()
  @IsString()
  concepto: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({ type: [LineaAsientoDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => LineaAsientoDto)
  lineas: LineaAsientoDto[];
}
