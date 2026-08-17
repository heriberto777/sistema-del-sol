import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CrearPlatformAdminDto {
  @ApiProperty({ example: 'ventas@sistemadelsol.com' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Admin de Ventas' })
  @IsString()
  nombre: string;

  @ApiProperty({ required: false, description: 'Id del PlatformRole a asignar — ver GET /platform/roles' })
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
