import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PackageTemplatesService } from './package-template.service';
import {
  PackageTemplateDetailsDto,
  PackageTemplateDetailsResponseDto,
} from './dto/package-template-details.dto';
import { UpdatePackageTemplateDto } from './dto/update-package-template.dto';
import { JwtRolesGuard } from 'src/auth/utils/jwt‑roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';

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
  @ApiQuery({
    name: 'resellerId',
    required: false,
    type: Number,
    description:
      'OCS reseller for detailed zones; defaults to OCS_DEFAULT_RESELLER_ID or 590',
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

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), JwtRolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update package template price (OCS cost via modifyPPTCore)',
  })
  @ApiResponse({ status: 200, description: 'Package updated' })
  @ApiResponse({ status: 400, description: 'Validation or OCS error' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async updatePackage(
    @Param('id') id: string,
    @Body() dto: UpdatePackageTemplateDto,
  ) {
    return this.svc.updatePackage(id, dto);
  }
}
