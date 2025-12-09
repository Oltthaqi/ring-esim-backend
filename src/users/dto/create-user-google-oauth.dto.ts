import {
  IsBoolean,
  IsEmpty,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserGoogleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  first_name: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  last_name: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  email: string;

  @IsNotEmpty()
  @IsBoolean()
  is_verified: boolean;

  @IsEmpty()
  password: string;
}
