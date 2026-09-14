import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CrearCategoriaIncentivoDto {
  @ApiProperty()
  @IsString()
  @MaxLength(60)
  nombre: string;

  @ApiProperty({ description: 'Peso en $ del renglón sobre el bono total' })
  @IsNumber()
  @Min(0)
  peso: number;

  @ApiProperty({ required: false, default: 0, description: 'Orden de aparición — menor primero' })
  @IsOptional()
  @IsInt()
  orden?: number;
}
