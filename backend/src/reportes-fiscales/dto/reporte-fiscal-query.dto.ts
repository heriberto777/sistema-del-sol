import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class ReporteFiscalQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}

export class ReporteFiscalExportarQueryDto extends ReporteFiscalQueryDto {
  @ApiProperty({ enum: ['json', 'txt'], required: false, default: 'txt' })
  @IsOptional()
  @IsIn(['json', 'txt'])
  formato?: 'json' | 'txt';
}
