import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtRolesGuard } from '../auth/utils/jwt\u2011roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { ResellersService } from './resellers.service';

@ApiTags('Reseller - My Account')
@ApiBearerAuth()
@Controller('me')
@UseGuards(AuthGuard('jwt'), JwtRolesGuard)
@Roles(Role.RESELLER)
export class ResellerMeController {
  constructor(private readonly resellersService: ResellersService) {}

  @Get()
  @ApiOperation({ summary: 'Get my reseller profile and balance' })
  async getMyProfile(
    @Req()
    req: {
      user: {
        uuid: string;
        reseller_id: string;
        email: string;
        fullName: string;
      };
    },
  ) {
    const reseller = await this.resellersService.getResellerById(
      req.user.reseller_id,
    );
    if (!reseller) {
      throw new NotFoundException({ message: 'Reseller not found' });
    }
    return {
      userId: req.user.uuid,
      email: req.user.email,
      name: req.user.fullName,
      reseller: {
        id: reseller.id,
        name: reseller.name,
        balance: parseFloat(reseller.balance),
        discountPct: parseFloat(reseller.discountPct),
        allowDebt: reseller.allowDebt,
        creditLimit: reseller.creditLimit
          ? parseFloat(reseller.creditLimit)
          : null,
        currency: reseller.currency,
      },
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get my balance transaction history' })
  getMyTransactions(
    @Req() req: { user: { reseller_id: string } },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.resellersService.getTransactions(
      req.user.reseller_id,
      page ?? 1,
      limit ?? 20,
    );
  }
}
