import { Module } from '@nestjs/common';
import { LocationZoneService } from './location-zone.service';
import { LocationZoneController } from './location-zone.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationZone } from './entities/location-zone.entity';
import { OcsModule } from 'src/ocs/ocs.module';

@Module({
  imports: [TypeOrmModule.forFeature([LocationZone]), OcsModule],
  controllers: [LocationZoneController],
  providers: [LocationZoneService],
  exports: [LocationZoneService],
})
export class LocationZoneModule {}
