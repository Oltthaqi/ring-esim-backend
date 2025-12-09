import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateVerificationDto {
  @ApiProperty({
    description: 'The email address',
    type: String,
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'The code',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;

  @ApiProperty({
    description: 'Expiration date',
    type: Date,
  })
  @IsNotEmpty()
  expires_at: Date;
}
