import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class PrevisualizarNcfQueryDto {
  @ApiProperty({ enum: ['CONSUMO', 'CREDITO_FISCAL', 'REGIMEN_ESPECIAL', 'GUBERNAMENTAL'], required: false })
  @IsOptional()
  @IsIn(['CONSUMO', 'CREDITO_FISCAL', 'REGIMEN_ESPECIAL', 'GUBERNAMENTAL'])
  comprobanteFiscal?: 'CONSUMO' | 'CREDITO_FISCAL' | 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL';

  @ApiProperty({ enum: ['CONTADO', 'CREDITO'], required: false, default: 'CONTADO' })
  @IsOptional()
  @IsIn(['CONTADO', 'CREDITO'])
  tipoFactura?: 'CONTADO' | 'CREDITO';
}
