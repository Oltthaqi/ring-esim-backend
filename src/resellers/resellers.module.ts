import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reseller } from './entities/reseller.entity';
import { ResellerRetailOverride } from './entities/reseller-retail-override.entity';
import { BalanceTransaction } from './entities/balance-transaction.entity';
import { PackageTemplate } from '../package-template/entities/package-template.entity';
import { ResellersService } from './resellers.service';
import { AdminResellersController } from './admin-resellers.controller';
import { ResellerMeController } from './reseller-me.controller';
import { TelcoModule } from '../telco/telco.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reseller,
      ResellerRetailOverride,
      BalanceTransaction,
      PackageTemplate,
    ]),
    TelcoModule,
  ],
  controllers: [AdminResellersController, ResellerMeController],
  providers: [ResellersService],
  exports: [ResellersService],
})
export class ResellersModule {}
