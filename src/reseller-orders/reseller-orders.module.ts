import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResellerOrder } from './entities/reseller-order.entity';
import { ResellerOrdersService } from './reseller-orders.service';
import { ResellerOrdersController } from './reseller-orders.controller';
import { ResellerPackagesController } from './reseller-packages.controller';
import { PdfService } from './pdf.service';
import { OcsModule } from '../ocs/ocs.module';
import { PackageTemplateModule } from '../package-template/package-template.module';
import { ResellersModule } from '../resellers/resellers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ResellerOrder]),
    OcsModule,
    PackageTemplateModule,
    ResellersModule,
  ],
  controllers: [ResellerOrdersController, ResellerPackagesController],
  providers: [ResellerOrdersService, PdfService],
  exports: [ResellerOrdersService],
})
export class ResellerOrdersModule {}
