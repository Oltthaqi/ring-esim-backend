import { Module } from '@nestjs/common';
import { EsimsService } from './esims.service';
import { EsimsController } from './esims.controller';
import { EsimAllocationService } from './esim-allocation.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Esim } from './entities/esim.entity';
import { PackageTemplate } from '../package-template/entities/package-template.entity';
import { OcsModule } from 'src/ocs/ocs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Esim, PackageTemplate]),
    OcsModule, // so EsimsService can use OcsService
  ],
  controllers: [EsimsController],
  providers: [EsimsService, EsimAllocationService],
  exports: [EsimsService, EsimAllocationService],
})
export class EsimsModule {}
