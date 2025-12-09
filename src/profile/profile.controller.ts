import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import {
  ProfileResponseDto,
  EsimStatsResponseDto,
  BillingDetailsDto,
  PurchasesResponseDto,
  PaymentsResponseDto,
} from './dto/profile-response.dto';
import { AuthGuard } from '@nestjs/passport';
import { JwtRolesGuard } from '../auth/utils/jwt‑roles.guard';
import { Roles } from '../auth/utils/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    uuid: string;
    id?: string;
    role: Role;
    email: string;
  };
}

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('profile')
@UseGuards(AuthGuard('jwt'), JwtRolesGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  private validateUserAccess(req: AuthenticatedRequest, userId: string): void {
    const currentUserId = req.user.uuid || req.user.id;
    const isAdmin = req.user.role === Role.ADMIN;

    // Allow admins to access any profile, but users can only access their own
    if (!isAdmin && currentUserId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this profile',
      );
    }
  }

  @ApiOperation({ summary: 'Get user profile information' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Profile information retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot access other user profiles',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':userId')
  @Roles(Role.USER, Role.ADMIN)
  async getProfile(
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<ProfileResponseDto> {
    this.validateUserAccess(req, userId);
    return this.profileService.getProfile(userId);
  }

  @ApiOperation({ summary: 'Get eSIM statistics for user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'eSIM statistics retrieved successfully',
    type: EsimStatsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':userId/esim-stats')
  @Roles(Role.USER, Role.ADMIN)
  async getEsimStats(
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<EsimStatsResponseDto> {
    this.validateUserAccess(req, userId);
    return this.profileService.getEsimStats(userId);
  }

  @ApiOperation({ summary: 'Get billing details for user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Billing details retrieved successfully',
    type: BillingDetailsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':userId/billing-details')
  @Roles(Role.USER, Role.ADMIN)
  async getBillingDetails(
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<BillingDetailsDto> {
    this.validateUserAccess(req, userId);
    return this.profileService.getBillingDetails(userId);
  }

  @ApiOperation({ summary: 'Get purchase history for user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Purchase history retrieved successfully',
    type: PurchasesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':userId/purchases')
  @Roles(Role.USER, Role.ADMIN)
  async getPurchases(
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<PurchasesResponseDto> {
    this.validateUserAccess(req, userId);
    return this.profileService.getPurchases(userId);
  }

  @ApiOperation({ summary: 'Get payment history for user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment history retrieved successfully',
    type: PaymentsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':userId/payments')
  @Roles(Role.USER, Role.ADMIN)
  async getPayments(
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<PaymentsResponseDto> {
    this.validateUserAccess(req, userId);
    return this.profileService.getPayments(userId);
  }
}
