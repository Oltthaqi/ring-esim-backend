import { PartialType } from '@nestjs/swagger';
import { CreateEsimDto } from './create-esim.dto';

export class UpdateEsimDto extends PartialType(CreateEsimDto) {}
