import { PartialType } from '@nestjs/swagger';
import { CreatePackageTemplateDto } from './create-package-template.dto';

export class UpdatePackageTemplateDto extends PartialType(
  CreatePackageTemplateDto,
) {}
