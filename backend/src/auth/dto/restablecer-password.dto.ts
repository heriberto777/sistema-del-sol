import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RestablecerPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'demo', description: 'Subdominio del tenant' })
  @IsString()
  tenantSubdominio: string;

  @ApiProperty({ example: 'NuevaClave123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
