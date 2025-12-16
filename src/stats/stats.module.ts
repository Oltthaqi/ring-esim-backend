import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { UsersEntity } from '../users/entitites/users.entity';
import { Usage } from '../usage/entities/usage.entity';
import { Order } from '../orders/entities/order.entity';
import { PackageTemplate } from '../package-template/entities/package-template.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsersEntity, Usage, Order, PackageTemplate]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}

