import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PackageTemplatesService } from './package-template.service';
import {
  PackageTemplateDetailsDto,
  PackageTemplateDetailsResponseDto,
} from './dto/package-template-details.dto';

@Controller('packages')
export class PackageTemplatesController {
  constructor(private readonly svc: PackageTemplatesService) {}

  @Post('sync')
  sync(@Query('resellerId') resellerId?: string) {
    const id = Number(resellerId);
    if (!id) throw new BadRequestException('resellerId is required');
    return this.svc.syncFromOcs(id);
  }

  /**
   * Get detailed package template information including countries and operators
   * GET /packages/details?packageTemplateId=123
   */
  @Get('details')
  @ApiOperation({
    summary: 'Get detailed package template information',
    description:
      'Returns comprehensive package template details including countries and network operators',
  })
  @ApiQuery({
    name: 'packageTemplateId',
    description:
      'Package template ID (UUID) or packageTemplateId (business key) to get details for',
    example: '980681d4-89d6-4472-b5c5-342706d862a7 or 594277',
    required: true,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Package template details retrieved successfully',
    type: PackageTemplateDetailsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Package template not found',
  })
  async getPackageTemplateDetails(
    @Query() dto: PackageTemplateDetailsDto,
  ): Promise<PackageTemplateDetailsResponseDto> {
    return await this.svc.getPackageTemplateDetails(dto);
  }
}
