import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class KardexQueryDto {
  @ApiProperty()
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
