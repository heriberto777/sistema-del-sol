import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResolverEmpresasDto {
  @ApiProperty({ example: 'admin@demo.com' })
  @IsEmail()
  email: string;
}
