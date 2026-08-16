import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export class LineaRemisionDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;
}

export class CrearRemisionDto {
  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty()
  @IsUUID()
  bodegaId: string;

  @ApiProperty()
  @IsString()
  numero: string;

  @ApiProperty({ type: [LineaRemisionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaRemisionDto)
  lineas: LineaRemisionDto[];
}
