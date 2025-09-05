import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UsageResponseDto {
  @ApiProperty({
    description: 'Usage record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Order ID that created this subscription',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  orderId: string;

  @ApiProperty({
    description: 'Subscriber ID from OCS',
    example: 28345617,
  })
  subscriberId: number;

  @ApiPropertyOptional({
    description: 'IMSI of the subscriber',
    example: '123456789012345',
  })
  imsi?: string | null;

  @ApiPropertyOptional({
    description: 'ICCID of the eSIM',
    example: '8948010000054019245',
  })
  iccid?: string | null;

  @ApiPropertyOptional({
    description: 'Phone number of the subscriber',
    example: '+1234567890',
  })
  msisdn?: string | null;

  @ApiProperty({
    description: 'Total data used in bytes',
    example: 524288000,
  })
  totalDataUsed: number;

  @ApiProperty({
    description: 'Total data allowed in bytes (package limit)',
    example: 5368709120,
  })
  totalDataAllowed: number;

  @ApiProperty({
    description: 'Remaining data in bytes',
    example: 4844421120,
  })
  totalDataRemaining: number;

  @ApiProperty({
    description: 'Data usage percentage (0-100)',
    example: 9.77,
  })
  usagePercentage: number;

  @ApiProperty({
    description: 'Total call duration in seconds',
    example: 3600,
  })
  totalCallDuration: number;

  @ApiProperty({
    description: 'Total SMS count',
    example: 25,
  })
  totalSmsCount: number;

  @ApiProperty({
    description: 'Total cost for reseller',
    example: 0.5,
  })
  totalResellerCost: number;

  @ApiProperty({
    description: 'Total cost for subscriber',
    example: 0.5,
  })
  totalSubscriberCost: number;

  @ApiPropertyOptional({
    description: 'First usage date',
    example: '2024-01-15T10:00:00Z',
  })
  firstUsageDate?: Date | null;

  @ApiPropertyOptional({
    description: 'Last usage date',
    example: '2024-01-15T18:30:00Z',
  })
  lastUsageDate?: Date | null;

  @ApiPropertyOptional({
    description: 'Package start date',
    example: '2024-01-15T09:00:00Z',
  })
  packageStartDate?: Date | null;

  @ApiPropertyOptional({
    description: 'Package end date',
    example: '2024-01-22T09:00:00Z',
  })
  packageEndDate?: Date | null;

  @ApiProperty({
    description: 'Whether the subscription is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Subscription status',
    example: 'active',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Last sync timestamp with OCS',
    example: '2024-01-15T19:00:00Z',
  })
  lastSyncedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Last usage country code',
    example: 'US',
  })
  lastUsageCountry?: string | null;

  @ApiPropertyOptional({
    description: 'Last usage operator name',
    example: 'Verizon Wireless',
  })
  lastUsageOperator?: string | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T09:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T19:00:00Z',
  })
  updatedAt: Date;
}
