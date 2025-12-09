import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    description: 'The first name',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  first_name: string;

  @ApiProperty({
    description: 'The last name',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  last_name: string;

  @ApiProperty({
    description: 'The phone number',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  phone_number: string;
}
