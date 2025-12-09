import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Status } from '../enums/status.enum';

export default class PagableParamsDto {
  @ApiProperty({ type: Number })
  @IsOptional()
  page = 1;
  @ApiProperty({ type: Number })
  @IsOptional()
  limit = 5;

  @ApiPropertyOptional({
    description: 'Search query',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Status',
    type: Status,
    enum: Status,
    enumName: 'Status',
  })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
