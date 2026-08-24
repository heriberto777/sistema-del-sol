import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class ComisionQueryDto {
  @ApiProperty({ required: false, description: 'Default: hace 30 días' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false, description: 'Default: hoy' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
