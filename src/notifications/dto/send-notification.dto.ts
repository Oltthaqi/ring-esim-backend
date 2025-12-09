import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
export class SendNotificationDTO {
  @IsString()
  @ApiProperty()
  title: string;

  @IsString()
  @ApiProperty()
  body: string;

  @IsString()
  @ApiProperty()
  device_id: string;

  @IsString()
  @ApiProperty()
  user_id: string;
}
