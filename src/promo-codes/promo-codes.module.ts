import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoCode } from './entities/promo-code.entity';
import { Order } from '../orders/entities/order.entity';
import { PromoCodesService } from './promo-codes.service';
import { PromoCodesController } from './promo-codes.controller';
import { PromoCodesAdminController } from './promo-codes-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PromoCode, Order])],
  controllers: [PromoCodesController, PromoCodesAdminController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
