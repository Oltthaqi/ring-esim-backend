import { PartialType } from '@nestjs/swagger';
import { CreateLocationZoneDto } from './create-location-zone.dto';

export class UpdateLocationZoneDto extends PartialType(CreateLocationZoneDto) {}
