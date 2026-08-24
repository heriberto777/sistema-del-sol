import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class ActualizarTipoAusenciaConfigDto {
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Tope de días por año, null = sin límite. Se ignora para VACACIONES (usa el balance legal por antigüedad).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  maximoDiasPorAnio?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  conGoceDeSueldoPorDefecto?: boolean;

  @ApiProperty({ required: false, description: 'Si es false, la ausencia se auto-aprueba al crearse en vez de quedar SOLICITADA' })
  @IsOptional()
  @IsBoolean()
  requiereAprobacion?: boolean;

  @ApiProperty({ required: false, description: 'Si es false, no se puede elegir este tipo al crear una nueva ausencia' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
