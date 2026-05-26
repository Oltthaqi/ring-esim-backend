import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleSignInDto {
  @ApiProperty({
    description: 'Google OAuth access token obtained from the mobile client',
    example: 'ya29.a0AfH6SM...',
  })
  @IsNotEmpty()
  @IsString()
  accessToken: string;
}
