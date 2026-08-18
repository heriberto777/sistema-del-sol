import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export class LineaFacturaPlataformaManualDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  concepto: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  monto: number;
}

export class CrearFacturaPlataformaManualDto {
  @ApiProperty()
  @IsUUID()
  tenantId: string;

  @ApiProperty({ type: [LineaFacturaPlataformaManualDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaFacturaPlataformaManualDto)
  lineas: LineaFacturaPlataformaManualDto[];

  @ApiProperty({ required: false, description: 'Si se omite, vence el mismo día que se emite' })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
