import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, OrderType } from '../entities/order.entity';

export class OrderResponseDto {
  @ApiProperty({
    description: 'Unique order ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Human-readable order number',
    example: 'ORD-1704110400000-123',
  })
  orderNumber: string;

  @ApiProperty({
    description: 'ID of the user who placed the order',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'ID of the package template purchased',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  packageTemplateId: string;

  @ApiPropertyOptional({
    description: 'Package template details',
    type: 'object',
    properties: {
      packageTemplateId: { type: 'string', example: '12345' },
      packageTemplateName: { type: 'string', example: 'USA 7-Day 5GB' },
      zoneName: { type: 'string', example: 'United States' },
      countriesIso2: {
        type: 'array',
        items: { type: 'string' },
        example: ['US'],
      },
      periodDays: { type: 'number', example: 7 },
      volume: { type: 'string', example: '5GB' },
      price: { type: 'number', example: 25.99 },
      currency: { type: 'string', example: 'USD' },
    },
  })
  packageTemplate?: {
    packageTemplateId: string;
    packageTemplateName: string;
    zoneName: string;
    countriesIso2: string[] | null;
    periodDays: number | null;
    volume: string | null;
    price: number | null;
    currency: string | null;
  };

  @ApiProperty({
    description: 'Type of order',
    enum: OrderType,
    example: OrderType.ONE_TIME,
  })
  orderType: OrderType;

  @ApiProperty({
    description: 'Current order status',
    enum: OrderStatus,
    example: OrderStatus.COMPLETED,
  })
  status: OrderStatus;

  @ApiProperty({
    description: 'Order amount',
    example: 25.99,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Subscriber ID from provider',
    example: 18331,
  })
  subscriberId?: number;

  @ApiPropertyOptional({
    description: 'IMSI of the eSIM',
    example: '123456789012345',
  })
  imsi?: string;

  @ApiPropertyOptional({
    description: 'ICCID of the eSIM',
    example: '893720401615000106',
  })
  iccid?: string;

  @ApiPropertyOptional({
    description: 'Phone number assigned to eSIM',
    example: '+1234567890',
  })
  msisdn?: string;

  @ApiPropertyOptional({
    description: 'Activation code for the eSIM',
    example: 'K2-1JL898-DKUTDC',
  })
  activationCode?: string;

  @ApiPropertyOptional({
    description: 'Validity period in days',
    example: 30,
  })
  validityPeriod?: number;

  @ApiPropertyOptional({
    description: 'Package activation start date',
    example: '2024-01-15T10:00:00Z',
  })
  activePeriodStart?: Date;

  @ApiPropertyOptional({
    description: 'Package expiration date',
    example: '2024-02-15T10:00:00Z',
  })
  activePeriodEnd?: Date;

  @ApiPropertyOptional({
    description: 'Start time for recurring packages',
    example: '2024-01-15T10:00:00Z',
  })
  startTimeUTC?: Date;

  @ApiPropertyOptional({
    description: 'Whether package activates on first use',
    example: false,
  })
  activationAtFirstUse?: boolean;

  @ApiPropertyOptional({
    description: 'Subscriber package ID from provider',
    example: 414,
  })
  subsPackageId?: number;

  @ApiPropertyOptional({
    description: 'eSIM ID from provider',
    example: 37147,
  })
  esimId?: number;

  @ApiPropertyOptional({
    description: 'SM-DP+ server address',
    example: 'smdp.io',
  })
  smdpServer?: string;

  @ApiPropertyOptional({
    description: 'QR code URL for eSIM installation',
    example: 'LPA:1$smdp.io$K2-1JL898-DKUTDC',
  })
  urlQrCode?: string;

  @ApiPropertyOptional({
    description: 'User-friendly SIM name',
    example: 'Sparks_18331',
  })
  userSimName?: string;

  @ApiPropertyOptional({
    description: 'Error message if order failed',
    example: 'Package allocation failed',
  })
  errorMessage?: string;

  @ApiPropertyOptional({
    description: 'Stripe Payment Intent ID',
    example: 'pi_1234567890abcdef',
  })
  paymentIntentId?: string;

  @ApiPropertyOptional({
    description: 'Payment status',
    enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled'],
    example: 'succeeded',
  })
  paymentStatus?: string;

  @ApiProperty({
    description: 'Order creation timestamp',
    example: '2024-01-15T10:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Order last update timestamp',
    example: '2024-01-15T10:05:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Usage tracking data for this order',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      subscriberId: { type: 'number', example: 28345617 },
      totalDataUsed: { type: 'number', example: 524288000 },
      totalDataAllowed: { type: 'number', example: 5368709120 },
      totalDataRemaining: { type: 'number', example: 4844421120 },
      usagePercentage: { type: 'number', example: 9.77 },
      isActive: { type: 'boolean', example: true },
      status: { type: 'string', example: 'active' },
      lastSyncedAt: { type: 'string', format: 'date-time' },
      individualUsage: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            orderId: { type: 'string' },
            packageTemplateId: { type: 'string', nullable: true },
            packageTemplateName: { type: 'string', nullable: true },
            totalDataUsed: { type: 'number' },
            totalDataAllowed: { type: 'number' },
            totalDataRemaining: { type: 'number' },
            usagePercentage: { type: 'number' },
            isActive: { type: 'boolean' },
            status: { type: 'string' },
            lastSyncedAt: { type: 'string', format: 'date-time' },
            lastUsageDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            iccid: { type: 'string', nullable: true },
            activationCode: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  usage?: {
    id: string;
    subscriberId: number;
    totalDataUsed: number;
    totalDataAllowed: number;
    totalDataRemaining: number;
    usagePercentage: number;
    isActive: boolean;
    status: string;
    lastSyncedAt: Date | null;
    individualUsage?: {
      id: string;
      orderId: string;
      packageTemplateId: string | null;
      packageTemplateName: string | null;
      totalDataUsed: number;
      totalDataAllowed: number;
      totalDataRemaining: number;
      usagePercentage: number;
      isActive: boolean;
      status: string;
      lastSyncedAt: Date | null;
      lastUsageDate?: Date | null;
      iccid?: string | null;
      activationCode?: string | null;
    }[];
  };
}
