import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { firebaseAdminProvider } from './providers/firebase-admin.provider';
import { UsersModule } from 'src/users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsEntity } from './entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationsEntity]), UsersModule],
  controllers: [NotificationsController],
  providers: [firebaseAdminProvider, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
