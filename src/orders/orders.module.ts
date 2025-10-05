import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './entities/order.entity';
import { OcsModule } from '../ocs/ocs.module';
import { PackageTemplateModule } from '../package-template/package-template.module';
import { UsersModule } from '../users/users.module';
import { EsimsModule } from '../esims/esims.module';
import { UsageModule } from '../usage/usage.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    OcsModule,
    PackageTemplateModule,
    UsersModule,
    EsimsModule,
    EmailModule,
    forwardRef(() => UsageModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
