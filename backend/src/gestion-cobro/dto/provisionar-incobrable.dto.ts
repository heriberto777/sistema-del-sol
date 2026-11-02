import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ProvisionarIncobrableDto {
  @ApiProperty()
  @IsString()
  facturaId: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  motivo: string;
}
