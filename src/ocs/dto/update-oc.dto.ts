import { PartialType } from '@nestjs/swagger';
import { CreateOcDto } from './create-oc.dto';

export class UpdateOcDto extends PartialType(CreateOcDto) {}
