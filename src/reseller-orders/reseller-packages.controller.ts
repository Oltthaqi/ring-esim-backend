import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtRolesGuard } from '../auth/utils/jwt\u2011roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { OcsService } from '../ocs/ocs.service';
import { PackageVisibilityService } from '../package-template/package-visibility.service';
import { ResellersService } from '../resellers/resellers.service';
import { Decimal4Util } from '../common/utils/decimal4.util';

@ApiTags('Packages')
@ApiBearerAuth()
@Controller('packages')
@UseGuards(AuthGuard('jwt'), JwtRolesGuard)
@Roles(Role.RESELLER, Role.SUPER_ADMIN)
export class ResellerPackagesController {
  constructor(
    private readonly ocsService: OcsService,
    private readonly visibilityService: PackageVisibilityService,
    private readonly resellersService: ResellersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List package templates (role-aware pricing)' })
  async listPackages(
    @Req() req: { user: { uuid: string; role: string; reseller_id?: string } },
  ) {
    const resellerId = this.ocsService.getDefaultResellerId();
    const templates =
      await this.ocsService.listPrepaidPackageTemplates(resellerId);
    const hiddenIds = await this.visibilityService.getHiddenTemplateIds();

    if (req.user.role === Role.SUPER_ADMIN) {
      return templates.map((t) => ({
        templateId: t.prepaidpackagetemplateid,
        name: t.prepaidpackagetemplatename,
        userUiName: t.userUiName,
        cost: t.cost,
        dataBytes: t.databyte,
        dataGb: +(t.databyte / 1_073_741_824).toFixed(2),
        periodDays: t.perioddays,
        locationZone: t.rdbLocationZones?.locationzonename ?? null,
        hidden: hiddenIds.has(t.prepaidpackagetemplateid),
        deleted: t.deleted,
      }));
    }

    // RESELLER view: filter hidden, compute reseller pricing
    const reseller = await this.resellersService.getResellerById(
      req.user.reseller_id!,
    );
    if (!reseller) throw new NotFoundException('Reseller not found');

    const discountPct = parseFloat(reseller.discountPct);

    return templates
      .filter((t) => !hiddenIds.has(t.prepaidpackagetemplateid) && !t.deleted)
      .map((t) => {
        const ourSellPrice = Decimal4Util.toString(t.cost);
        const discountMultiplier = Decimal4Util.toString(1 - discountPct / 100);
        const resellerPrice = Decimal4Util.multiply(
          ourSellPrice,
          discountMultiplier,
        );
        return {
          templateId: t.prepaidpackagetemplateid,
          name: t.prepaidpackagetemplatename,
          userUiName: t.userUiName,
          ourSellPrice: parseFloat(ourSellPrice),
          resellerPrice: parseFloat(resellerPrice),
          discountPct,
          dataBytes: t.databyte,
          dataGb: +(t.databyte / 1_073_741_824).toFixed(2),
          periodDays: t.perioddays,
          locationZone: t.rdbLocationZones?.locationzonename ?? null,
        };
      });
  }

  @Patch(':templateId/visibility')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle package visibility (superadmin only)' })
  setVisibility(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() body: { hidden: boolean },
    @Req() req: { user: { uuid: string } },
  ) {
    return this.visibilityService.setVisibility(
      templateId,
      body.hidden,
      req.user.uuid,
    );
  }
}
