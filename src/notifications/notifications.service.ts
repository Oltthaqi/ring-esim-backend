import { Injectable, NotFoundException } from '@nestjs/common';
import * as firebase from 'firebase-admin';
import { SendNotificationDTO } from './dto/send-notification.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsEntity } from './entities/notification.entity';
import { NotificationStatus } from './enum/notification-status.enum';
import PagableParamsDto from 'src/common/dto/pagable-params.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationsEntity)
    private notificationsRepository: Repository<NotificationsEntity>,
  ) {}
  async sendPush(notification: SendNotificationDTO) {
    try {
      await firebase
        .messaging()
        .send({
          notification: {
            title: notification.title,
            body: notification.body,
          },
          token: notification.device_id,
          data: {},
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'default',
            },
          },
          apns: {
            headers: {
              'apns-priority': '10',
            },
            payload: {
              aps: {
                contentAvailable: true,
                sound: 'default',
              },
            },
          },
        })
        .catch((error: any) => {
          console.error(error);
        });

      const newNotification = this.notificationsRepository.create({
        title: notification.title,
        body: notification.body,
        device_id: notification.device_id,
        user_id: notification.user_id,
      });
      await this.notificationsRepository.save(newNotification);
    } catch (error) {
      console.log(error);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return error;
    }
  }
  async getNotificationsForUser(
    user_id: string,
    params: PagableParamsDto,
  ): Promise<{ notifications: NotificationsEntity[]; total: number }> {
    const { page, limit } = params;
    if (!user_id) {
      throw new NotFoundException('User ID is required');
    }
    const [notifications, total] =
      await this.notificationsRepository.findAndCount({
        where: { user_id, is_deleted: false },
        order: { created_at: 'DESC' },
        take: limit,
        skip: (page - 1) * limit,
      });

    if (!notifications.length) {
      throw new NotFoundException('No notifications found for this user');
    }

    return { notifications, total };
  }

  async markNotificationAsRead(
    id: string,
  ): Promise<NotificationsEntity | null> {
    const updateResult = await this.notificationsRepository.update(
      { id, is_deleted: false, status: NotificationStatus.UNREAD },
      { status: NotificationStatus.READ },
    );
    if (!updateResult.affected) {
      throw new NotFoundException('No unread notifications found');
    }

    return this.notificationsRepository.findOne({ where: { id } });
  }

  async markAllNotificationsAsRead(
    user_id: string,
  ): Promise<NotificationsEntity[]> {
    const updateResult = await this.notificationsRepository.update(
      { user_id, is_deleted: false, status: NotificationStatus.UNREAD },
      { status: NotificationStatus.READ },
    );
    if (!updateResult.affected) {
      throw new NotFoundException('No unread notifications found');
    }
    return this.notificationsRepository.find({
      where: {
        user_id,
        is_deleted: false,
        status: NotificationStatus.READ,
      },
    });
  }

  async deleteNotification(id: string): Promise<boolean> {
    const updatedNotification = await this.notificationsRepository.update(
      { id },
      { is_deleted: true },
    );
    if (updatedNotification.affected === 0) {
      throw new NotFoundException('Notification not found or already deleted');
    }
    return true;
  }

  async getUnreadNotificationsWithCount(
    user_id: string,
    params: PagableParamsDto,
  ): Promise<{ notifications: NotificationsEntity[]; total: number }> {
    const { page, limit } = params;
    const [notifications, total] =
      await this.notificationsRepository.findAndCount({
        where: {
          user_id,
          is_deleted: false,
          status: NotificationStatus.UNREAD,
        },
        order: { created_at: 'DESC' },
        take: limit,
        skip: (page - 1) * limit,
      });
    return { notifications, total };
  }
}
