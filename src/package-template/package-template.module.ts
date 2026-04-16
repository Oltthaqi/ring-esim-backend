import { Module } from '@nestjs/common';
import { PackageTemplatesService } from './package-template.service';
import { PackageTemplatesController } from './package-template.controller';
import { PackageVisibilityService } from './package-visibility.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackageTemplate } from './entities/package-template.entity';
import { PackageVisibility } from './entities/package-visibility.entity';
import { OcsModule } from 'src/ocs/ocs.module';
import { LocationZoneModule } from 'src/location-zone/location-zone.module';
import { LocationZone } from 'src/location-zone/entities/location-zone.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PackageTemplate,
      PackageVisibility,
      LocationZone,
    ]),
    OcsModule,
    LocationZoneModule,
  ],
  controllers: [PackageTemplatesController],
  providers: [PackageTemplatesService, PackageVisibilityService],
  exports: [PackageTemplatesService, PackageVisibilityService],
})
export class PackageTemplateModule {}
