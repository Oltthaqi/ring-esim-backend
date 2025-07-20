import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SendNotificationDTO } from './dto/send-notification.dto';
import { JwtRolesGuard } from 'src/auth/utils/jwt‑roles.guard';
import PagableParamsDto from 'src/common/dto/pagable-params.dto';
import { NotificationsEntity } from './entities/notification.entity';

@UseGuards(JwtRolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  async pushNotification(@Body() pushNotification: SendNotificationDTO) {
    await this.notificationsService.sendPush(pushNotification);
  }
  @Get(':user_id')
  async getNotificationsForUser(
    @Param('user_id') userId: string,
    @Query() Param: PagableParamsDto,
  ): Promise<{ notifications: NotificationsEntity[]; total: number }> {
    return await this.notificationsService.getNotificationsForUser(
      userId,
      Param,
    );
  }
  @Get('unread/:user_id')
  async getTotalUnread(
    @Param('user_id') userId: string,
    @Query() Param: PagableParamsDto,
  ): Promise<{ notifications: NotificationsEntity[]; total: number }> {
    return await this.notificationsService.getUnreadNotificationsWithCount(
      userId,
      Param,
    );
  }

  @Patch('read/:id')
  async markNotificationAsRead(@Param('id') id: string) {
    return await this.notificationsService.markNotificationAsRead(id);
  }

  @Patch('read-all/:user_id')
  async markAllNotificationsAsRead(@Param('user_id') user_id: string) {
    return await this.notificationsService.markAllNotificationsAsRead(user_id);
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string) {
    return await this.notificationsService.deleteNotification(id);
  }
}
