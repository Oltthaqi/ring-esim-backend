import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtRolesGuard } from '../auth/utils/jwt\u2011roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { ResellersService } from './resellers.service';
import { CreateResellerDto } from './dto/create-reseller.dto';
import { UpdateResellerDto } from './dto/update-reseller.dto';
import { AdminAdjustTelcoBalanceDto } from './dto/admin-adjust-telco-balance.dto';
import { InternalLedgerDto } from './dto/internal-ledger.dto';
import { UpsertRetailOverrideDto } from './dto/upsert-retail-override.dto';

@ApiTags('Admin - Resellers')
@ApiBearerAuth()
@Controller('admin/resellers')
@UseGuards(AuthGuard('jwt'), JwtRolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminResellersController {
  constructor(private readonly resellersService: ResellersService) {}

  @Get()
  @ApiOperation({ summary: 'List resellers (with optional telco enrichment)' })
  @ApiResponse({ status: 200, description: 'OK' })
  list() {
    return this.resellersService.listAdmin();
  }

  @Post()
  @ApiOperation({ summary: 'Create reseller row (telco id must exist at provider)' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 409, description: 'Duplicate telcoResellerId' })
  create(@Body() dto: CreateResellerDto) {
    return this.resellersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update reseller metadata' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResellerDto,
  ) {
    return this.resellersService.update(id, dto);
  }

  @Post(':id/balance')
  @ApiOperation({ summary: 'Adjust telco reseller or account balance' })
  @ApiResponse({ status: 502, description: 'Telco error' })
  adjustBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminAdjustTelcoBalanceDto,
  ) {
    return this.resellersService.adjustTelcoBalance(id, dto);
  }

  @Post(':id/internal-ledger')
  @ApiOperation({ summary: 'Adjust internal ledger balance (DB only)' })
  internalLedger(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InternalLedgerDto,
  ) {
    return this.resellersService.adjustInternalLedger(id, dto);
  }

  @Get(':id/retail-overrides')
  listOverrides(@Param('id', ParseUUIDPipe) id: string) {
    return this.resellersService.listRetailOverrides(id);
  }

  @Post(':id/retail-overrides')
  upsertOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertRetailOverrideDto,
  ) {
    return this.resellersService.upsertRetailOverride(id, dto);
  }

  @Delete(':id/retail-overrides/:overrideId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  deleteOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('overrideId', ParseUUIDPipe) overrideId: string,
  ) {
    return this.resellersService.deleteRetailOverride(id, overrideId);
  }

  @Get(':id/tariff')
  @ApiOperation({ summary: 'Proxy getCustomerTariff for telcoResellerId' })
  @ApiResponse({ status: 502, description: 'Telco error' })
  getTariff(@Param('id', ParseUUIDPipe) id: string) {
    return this.resellersService.getCustomerTariffForReseller(id);
  }
}
