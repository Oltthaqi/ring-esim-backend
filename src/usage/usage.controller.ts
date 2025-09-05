import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UsageService } from './usage.service';
import { UsageResponseDto } from './dto/usage-response.dto';
import { UsageQueryDto } from './dto/usage-query.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/utils/roles.decorator';
import { JwtRolesGuard } from '../auth/utils/jwt‑roles.guard';
import { Role } from '../users/enums/role.enum';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    uuid: string;
    id?: string;
    role: Role;
    email: string;
  };
}

@ApiTags('Usage')
@ApiBearerAuth()
@Controller('usage')
@UseGuards(AuthGuard('jwt'), JwtRolesGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @ApiOperation({ summary: 'Get usage data for authenticated user' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({
    status: 200,
    description: 'Usage data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/UsageResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('my-usage')
  @Roles(Role.USER, Role.ADMIN)
  async getMyUsage(
    @Request() req: AuthenticatedRequest,
    @Query() query: UsageQueryDto,
  ) {
    const userId = req.user.uuid || req.user.id;

    if (!userId) {
      throw new BadRequestException('User ID not found in JWT token');
    }

    return this.usageService.getUserUsage(userId, query);
  }

  @ApiOperation({ summary: 'Get usage data for a specific order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Usage data retrieved successfully',
    type: UsageResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Usage record not found' })
  @Get('order/:orderId')
  @Roles(Role.USER, Role.ADMIN)
  async getUsageByOrderId(
    @Param('orderId') orderId: string,
  ): Promise<UsageResponseDto> {
    return this.usageService.getUsageByOrderId(orderId);
  }

  @ApiOperation({ summary: 'Manually sync usage data with OCS API' })
  @ApiParam({ name: 'usageId', description: 'Usage record ID' })
  @ApiResponse({
    status: 200,
    description: 'Usage synced successfully',
    type: UsageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Sync failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Usage record not found' })
  @Post(':usageId/sync')
  @Roles(Role.USER, Role.ADMIN)
  async syncUsage(
    @Param('usageId') usageId: string,
  ): Promise<UsageResponseDto> {
    return this.usageService.syncUsageWithOcs(usageId);
  }

  @ApiOperation({
    summary: 'Get real-time usage summary for authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalSubscriptions: {
          type: 'number',
          description: 'Total active subscriptions',
        },
        totalDataUsed: {
          type: 'number',
          description: 'Total data used across all subscriptions (bytes)',
        },
        totalDataAllowed: {
          type: 'number',
          description: 'Total data allowed across all subscriptions (bytes)',
        },
        totalDataRemaining: {
          type: 'number',
          description: 'Total data remaining across all subscriptions (bytes)',
        },
        averageUsagePercentage: {
          type: 'number',
          description: 'Average usage percentage across all subscriptions',
        },
        subscriptions: {
          type: 'array',
          items: { $ref: '#/components/schemas/UsageResponseDto' },
          description: 'Individual subscription usage details',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('summary')
  @Roles(Role.USER, Role.ADMIN)
  async getUsageSummary(@Request() req: AuthenticatedRequest) {
    const userId = req.user.uuid || req.user.id;

    if (!userId) {
      throw new BadRequestException('User ID not found in JWT token');
    }

    // Get all user's usage records
    const userUsage = await this.usageService.getUserUsage(userId, {
      page: 1,
      limit: 100, // Get all subscriptions for summary
    });

    const subscriptions = userUsage.data;
    const activeSubscriptions = subscriptions.filter((sub) => sub.isActive);

    // Calculate summary statistics
    const totalDataUsed = activeSubscriptions.reduce(
      (sum, sub) => sum + sub.totalDataUsed,
      0,
    );
    const totalDataAllowed = activeSubscriptions.reduce(
      (sum, sub) => sum + sub.totalDataAllowed,
      0,
    );
    const totalDataRemaining = activeSubscriptions.reduce(
      (sum, sub) => sum + sub.totalDataRemaining,
      0,
    );

    const averageUsagePercentage =
      activeSubscriptions.length > 0
        ? activeSubscriptions.reduce(
            (sum, sub) => sum + sub.usagePercentage,
            0,
          ) / activeSubscriptions.length
        : 0;

    return {
      totalSubscriptions: activeSubscriptions.length,
      totalDataUsed,
      totalDataAllowed,
      totalDataRemaining,
      averageUsagePercentage: Math.round(averageUsagePercentage * 100) / 100,
      subscriptions: activeSubscriptions,
    };
  }

  @ApiOperation({ summary: 'Create usage record for a completed order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 201,
    description: 'Usage record created successfully',
    type: UsageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Order does not have subscriber ID or usage already exists',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @Post('order/:orderId/create')
  @Roles(Role.USER, Role.ADMIN)
  async createUsageRecord(
    @Param('orderId') orderId: string,
  ): Promise<UsageResponseDto> {
    const usage = await this.usageService.createUsageRecord(orderId);
    return this.usageService.getUsageByOrderId(orderId);
  }

  @ApiOperation({
    summary: 'Trigger manual sync for all user subscriptions (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sync initiated for all subscriptions',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @Post('sync-all')
  @Roles(Role.ADMIN)
  async syncAllUsage() {
    // This will trigger the sync process (handled by the cron job method)
    await this.usageService.syncAllActiveUsage();

    return {
      message: 'Sync initiated for all active subscriptions',
      timestamp: new Date().toISOString(),
    };
  }
}
