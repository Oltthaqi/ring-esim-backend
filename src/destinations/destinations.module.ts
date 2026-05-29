import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DestinationsService } from './destinations.service';
import { DestinationsController } from './destinations.controller';
import { PackageTemplate } from '../package-template/entities/package-template.entity';
import { LocationZone } from '../location-zone/entities/location-zone.entity';
import { PackageTemplateModule } from '../package-template/package-template.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PackageTemplate, LocationZone]),
    PackageTemplateModule,
  ],
  controllers: [DestinationsController],
  providers: [DestinationsService],
})
export class DestinationsModule {}
