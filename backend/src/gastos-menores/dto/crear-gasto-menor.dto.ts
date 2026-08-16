import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class LineaGastoMenorDto {
  @ApiProperty({ description: 'Cuenta de gasto (tipo GASTO) que se debita' })
  @IsUUID()
  cuentaContableId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  concepto?: string;

  @ApiProperty({ description: 'Monto antes de impuesto, por unidad' })
  @IsNumber()
  @IsPositive()
  valor: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeItbis?: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  cantidad?: number;
}

export class CrearGastoMenorDto {
  @ApiProperty({ description: 'De dónde sale el dinero' })
  @IsUUID()
  cuentaBancariaId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({ type: [LineaGastoMenorDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaGastoMenorDto)
  lineas: LineaGastoMenorDto[];
}
