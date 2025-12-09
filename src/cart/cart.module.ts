import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [PromoCodesModule, CreditsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService], // Export for use in Orders module
})
export class CartModule {}
