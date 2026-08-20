import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const TIPOS_AUSENCIA = ['VACACIONES', 'ENFERMEDAD', 'PERMISO', 'INJUSTIFICADA', 'MATERNIDAD_PATERNIDAD', 'OTRO'] as const;

export class CrearAusenciaDto {
  @ApiProperty()
  @IsString()
  empleadoId: string;

  @ApiProperty({ enum: TIPOS_AUSENCIA })
  @IsIn(TIPOS_AUSENCIA)
  tipo: (typeof TIPOS_AUSENCIA)[number];

  @ApiProperty()
  @IsDateString()
  fechaDesde: string;

  @ApiProperty()
  @IsDateString()
  fechaHasta: string;

  @ApiProperty({
    required: false,
    description: 'Si se omite, se infiere del tipo (INJUSTIFICADA = false, el resto = true)',
  })
  @IsOptional()
  @IsBoolean()
  conGoceDeSueldo?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
