import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'The first name',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  first_name: string;

  @ApiProperty({
    description: 'The last name',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  last_name: string;

  @ApiProperty({
    description: 'The email',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    description: 'The phone number',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message:
      'phoneNumber must be in international E.164 format: “+” followed by 2–15 digits, no spaces',
  })
  phone_number: string;

  @ApiProperty({ description: 'The password', type: String })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
  })
  password: string;

  @ApiProperty({ description: 'The confirm password', type: String })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
  })
  confirm_password: string;

  @ApiProperty({ description: 'The is verified', type: Boolean })
  @IsOptional()
  @IsBoolean()
  is_verified: boolean;

  @IsOptional()
  @ApiProperty({
    description: 'The role of the user',
  })
  role: string;

  @ApiProperty({
    description: 'Optional referral code from the user who referred this user',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  referral_code?: string;
}
