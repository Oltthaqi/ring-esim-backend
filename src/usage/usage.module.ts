import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { Usage } from './entities/usage.entity';
import { OcsModule } from '../ocs/ocs.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usage]),
    OcsModule,
    forwardRef(() => OrdersModule),
  ],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
