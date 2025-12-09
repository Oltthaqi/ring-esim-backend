import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Param,
  Body,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtRolesGuard } from '../auth/utils/jwt‑roles.guard';
import { Roles } from '../auth/utils/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { CreditsService } from './credits.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ConfirmReservationDto } from './dto/confirm-reservation.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { AdminRefundDto } from './dto/admin-refund.dto';

@ApiTags('Credits')
@ApiBearerAuth()
@Controller('credits')
@UseGuards(AuthGuard('jwt'))
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get current credit balance with lifetime earned' })
  @ApiResponse({
    status: 200,
    description: 'Current balance, lifetime earned, and currency',
  })
  async getBalance(@Request() req) {
    const userId = req.user.uuid || req.user.id;
    const walletData = await this.creditsService.getBalance(userId);
    return {
      balance: walletData.balance,
      lifetime_earned: walletData.lifetime_earned,
      currency: walletData.currency,
      userId,
    };
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Get credit transaction history' })
  @ApiResponse({ status: 200, description: 'List of ledger entries' })
  async getLedger(@Request() req) {
    const userId = req.user.uuid || req.user.id;
    const ledger = await this.creditsService.getLedger(userId);
    return { ledger };
  }

  @Get('reservations')
  @ApiOperation({ summary: 'Get active credit reservations' })
  @ApiResponse({ status: 200, description: 'List of active reservations' })
  async getReservations(@Request() req) {
    const userId = req.user.uuid || req.user.id;
    const reservations =
      await this.creditsService.getActiveReservations(userId);
    return { reservations };
  }

  @Post('reservations')
  @ApiOperation({ summary: 'Create a credit reservation' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key for idempotent requests',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Reservation created successfully',
  })
  async createReservation(
    @Request() req,
    @Body() dto: CreateReservationDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      return {
        error: 'Idempotency-Key header is required',
        status: 400,
      };
    }
    const userId = req.user.uuid || req.user.id;
    return await this.creditsService.createReservationWithIdempotency(
      userId,
      dto.amount,
      dto.currency || 'EUR',
      idempotencyKey,
      dto.orderId,
      dto.note,
      dto.expiresInSeconds,
    );
  }

  @Post('reservations/:reservationId/confirm')
  @ApiOperation({ summary: 'Confirm a credit reservation' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key for idempotent requests',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Reservation confirmed successfully',
  })
  async confirmReservation(
    @Param('reservationId') reservationId: string,
    @Body() dto: ConfirmReservationDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      return {
        error: 'Idempotency-Key header is required',
        status: 400,
      };
    }
    return await this.creditsService.confirmReservationWithIdempotency(
      reservationId,
      dto.orderId,
      idempotencyKey,
    );
  }

  @Post('reservations/:reservationId/cancel')
  @ApiOperation({ summary: 'Cancel a credit reservation' })
  @ApiResponse({
    status: 200,
    description: 'Reservation canceled successfully',
  })
  async cancelReservation(
    @Param('reservationId') reservationId: string,
    @Body() dto: CancelReservationDto,
  ) {
    return await this.creditsService.cancelReservationWithIdempotency(
      reservationId,
      dto.note,
    );
  }

  @Post('refunds')
  @ApiOperation({ summary: 'Create a credit refund' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key for idempotent requests',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Refund processed successfully',
  })
  async createRefund(
    @Request() req,
    @Body() dto: CreateRefundDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      return {
        error: 'Idempotency-Key header is required',
        status: 400,
      };
    }
    const userId = req.user.uuid || req.user.id;
    return await this.creditsService.refundCreditsWithIdempotency(
      userId,
      dto.orderId,
      dto.amount,
      idempotencyKey,
      dto.note,
    );
  }

  // Admin diagnostic endpoints
  @Get('admin/ledger/:userId')
  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Admin: Get credit ledger for any user (diagnostic)',
  })
  @ApiResponse({ status: 200, description: 'User ledger entries' })
  async getAdminLedger(@Param('userId') userId: string) {
    const ledger = await this.creditsService.getLedger(userId, 100);
    const balance = await this.creditsService.getBalance(userId);
    return {
      userId,
      balance: balance.balance,
      lifetime_earned: balance.lifetime_earned,
      currency: balance.currency,
      ledger,
    };
  }

  @Get('admin/balance/:userId')
  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Get balance for any user' })
  @ApiResponse({ status: 200, description: 'User balance' })
  async getAdminBalance(@Param('userId') userId: string) {
    const balance = await this.creditsService.getBalance(userId);
    return { userId, ...balance };
  }

  @Get('admin/reservations/:userId')
  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Get reservations for any user' })
  @ApiResponse({ status: 200, description: 'User reservations' })
  async getAdminReservations(@Param('userId') userId: string) {
    const reservations =
      await this.creditsService.getActiveReservations(userId);
    return { userId, reservations };
  }

  @Post('admin/add-credits')
  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Manually add credits to a user' })
  @ApiResponse({ status: 200, description: 'Credits added successfully' })
  async addCreditsAdmin(
    @Body() body: { userId: string; amount: number; note?: string },
  ) {
    await this.creditsService.addCredits(
      body.userId,
      body.amount,
      undefined,
      undefined,
      body.note || `Admin manual credit: €${body.amount.toFixed(2)}`,
    );
    const balance = await this.creditsService.getBalance(body.userId);
    return {
      success: true,
      userId: body.userId,
      amountAdded: body.amount,
      newBalance: balance.balance,
      lifetimeEarned: balance.lifetime_earned,
    };
  }

  @Post('admin/refund')
  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Force refund credits to a user' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key for idempotent requests',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Refund processed successfully' })
  async adminRefund(
    @Body() dto: AdminRefundDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      return {
        error: 'Idempotency-Key header is required',
        status: 400,
      };
    }
    return await this.creditsService.refundCreditsWithIdempotency(
      dto.userId,
      dto.orderId,
      dto.amount,
      idempotencyKey,
      dto.note || `Admin refund for order ${dto.orderId}`,
    );
  }
}
