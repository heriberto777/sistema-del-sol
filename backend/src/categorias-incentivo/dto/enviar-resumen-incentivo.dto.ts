import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class EnviarResumenIncentivoDto {
  @ApiProperty({ description: 'YYYY-MM' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  mes: string;

  @ApiProperty({ enum: ['EMAIL', 'WHATSAPP'] })
  @IsIn(['EMAIL', 'WHATSAPP'])
  canal: 'EMAIL' | 'WHATSAPP';

  @ApiProperty({ description: 'Email o número de teléfono según el canal elegido' })
  @IsString()
  destino: string;

  @ApiProperty({ required: false, description: 'Opcional — nota libre que se agrega al final del reporte' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}
