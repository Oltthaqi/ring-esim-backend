import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './entities/order.entity';
import { UsersEntity } from '../users/entitites/users.entity';
import { OcsModule } from '../ocs/ocs.module';
import { PackageTemplateModule } from '../package-template/package-template.module';
import { UsersModule } from '../users/users.module';
import { EsimsModule } from '../esims/esims.module';
import { UsageModule } from '../usage/usage.module';
import { EmailModule } from '../email/email.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { CreditsModule } from '../credits/credits.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, UsersEntity]),
    OcsModule,
    PackageTemplateModule,
    UsersModule,
    EsimsModule,
    EmailModule,
    PromoCodesModule,
    CreditsModule,
    CartModule,
    forwardRef(() => UsageModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
