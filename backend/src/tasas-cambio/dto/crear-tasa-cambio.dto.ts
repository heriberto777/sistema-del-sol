import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, Length, Matches } from 'class-validator';

export class CrearTasaCambioDto {
  @ApiProperty({ description: 'Código ISO 4217, ej. USD, EUR' })
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, { message: 'moneda debe ser un código ISO de 3 letras mayúsculas, ej. USD' })
  moneda: string;

  @ApiProperty({ description: 'Cuántos DOP vale 1 unidad de esta moneda — ej. 58.50 para USD ("el dólar está a 58.50")' })
  @IsNumber()
  @IsPositive()
  tasa: number;
}
