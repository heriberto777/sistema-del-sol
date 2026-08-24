import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class EnviarReciboDto {
  @ApiProperty({ enum: ['EMAIL', 'WHATSAPP'] })
  @IsIn(['EMAIL', 'WHATSAPP'])
  canal: 'EMAIL' | 'WHATSAPP';

  @ApiProperty({ description: 'Email o teléfono a donde entregar el recibo — no depende del Cliente.email/telefono guardado (ej. un consumidor final sin cliente registrado)' })
  @IsString()
  @IsNotEmpty()
  destinatario: string;
}
