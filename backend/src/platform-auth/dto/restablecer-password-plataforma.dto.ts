import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RestablecerPasswordPlataformaDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'NuevaClave123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
