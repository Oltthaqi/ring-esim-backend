import { Module } from '@nestjs/common';
import { PackageTemplatesService } from './package-template.service';
import { PackageTemplatesController } from './package-template.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackageTemplate } from './entities/package-template.entity';
import { OcsModule } from 'src/ocs/ocs.module';
import { LocationZoneModule } from 'src/location-zone/location-zone.module';
import { LocationZone } from 'src/location-zone/entities/location-zone.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PackageTemplate, LocationZone]),
    OcsModule,
    LocationZoneModule,
  ],
  controllers: [PackageTemplatesController],
  providers: [PackageTemplatesService],
  exports: [PackageTemplatesService],
})
export class PackageTemplateModule {}
