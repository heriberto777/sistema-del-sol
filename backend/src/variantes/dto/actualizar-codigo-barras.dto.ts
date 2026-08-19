import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ActualizarCodigoBarrasDto {
  @ApiProperty({ required: false, description: 'null explícito quita el código asignado' })
  @IsOptional()
  @IsString()
  codigoBarras?: string | null;
}
