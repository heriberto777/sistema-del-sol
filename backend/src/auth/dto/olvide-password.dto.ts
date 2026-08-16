import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class OlvidePasswordDto {
  @ApiProperty({ example: 'admin@demo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'demo', description: 'Subdominio del tenant' })
  @IsString()
  tenantSubdominio: string;
}
