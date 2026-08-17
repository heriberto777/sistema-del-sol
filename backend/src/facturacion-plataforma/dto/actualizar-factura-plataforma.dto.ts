import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ActualizarFacturaPlataformaDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  concepto?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @ApiProperty({ required: false, description: 'Editable a mano — ej. para condonar la mora ya aplicada' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoMora?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
