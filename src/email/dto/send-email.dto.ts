import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendEmailDTO {
  @ApiProperty({
    description: 'The to',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  to: string;
  @ApiProperty({
    description: 'The subject',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({
    description: 'The body',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  body: string;
}
