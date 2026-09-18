import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class EnviarEstadoCuentaDto {
  @ApiProperty({ enum: ['EMAIL', 'WHATSAPP'] })
  @IsIn(['EMAIL', 'WHATSAPP'])
  canal: 'EMAIL' | 'WHATSAPP';

  @ApiProperty({ description: 'Email o número de teléfono según el canal elegido' })
  @IsString()
  destinatario: string;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
