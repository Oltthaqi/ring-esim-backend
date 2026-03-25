import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reseller } from './entities/reseller.entity';
import { ResellerRetailOverride } from './entities/reseller-retail-override.entity';
import { PackageTemplate } from '../package-template/entities/package-template.entity';
import { ResellersService } from './resellers.service';
import { AdminResellersController } from './admin-resellers.controller';
import { TelcoModule } from '../telco/telco.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reseller,
      ResellerRetailOverride,
      PackageTemplate,
    ]),
    TelcoModule,
  ],
  controllers: [AdminResellersController],
  providers: [ResellersService],
  exports: [ResellersService],
})
export class ResellersModule {}
