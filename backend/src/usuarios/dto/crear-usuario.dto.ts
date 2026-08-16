import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEmail, IsString, IsUUID, MinLength } from 'class-validator';

export class CrearUsuarioDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ type: [String], description: 'IDs de roles a asignar' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  rolIds: string[];
}
