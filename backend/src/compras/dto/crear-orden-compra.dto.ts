import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export class LineaOcDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  costoUnitario: number;
}

export class CrearOrdenCompraDto {
  @ApiProperty()
  @IsUUID()
  proveedorId: string;

  @ApiProperty()
  @IsString()
  numero: string;

  @ApiProperty({ type: [LineaOcDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaOcDto)
  lineas: LineaOcDto[];
}
