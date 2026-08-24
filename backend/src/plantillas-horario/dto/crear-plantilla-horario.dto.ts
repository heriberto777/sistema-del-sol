import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CrearPlantillaHorarioDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  codigo: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  nombre: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Se auto-asigna a un Empleado nuevo que no reciba plantillaHorarioId explícito. Como mucho una por tenant debería tenerla en true.',
  })
  @IsOptional()
  @IsBoolean()
  predeterminada?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
