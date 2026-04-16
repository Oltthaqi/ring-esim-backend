import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AppleSignInDto {
  @ApiProperty({
    description: 'Apple identity token received from Apple Sign In',
    example: 'eyJraWQiOiJlWGF1d...',
  })
  @IsNotEmpty()
  @IsString()
  identityToken: string;
}
