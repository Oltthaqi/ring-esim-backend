import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'], example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: true })
  verified: boolean;
}

export class EsimStatsResponseDto {
  @ApiProperty({ example: 12, description: 'Total number of eSIMs purchased' })
  totalEsims: number;

  @ApiProperty({ example: 245.8, description: 'Total amount spent' })
  totalSpent: number;

  @ApiProperty({ example: 3, description: 'Number of active eSIMs' })
  activeEsims: number;

  @ApiProperty({ example: 'Turqi Premium', nullable: true })
  lastEsim: string | null;

  @ApiProperty({ example: 'Itali Basic', nullable: true })
  secondLastEsim: string | null;
}

export class PurchaseItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Turqi Premium - 5GB' })
  item: string;

  @ApiProperty({ example: 19.99 })
  price: number;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  date: Date;

  @ApiProperty({
    enum: ['COMPLETED', 'PENDING', 'FAILED'],
    example: 'COMPLETED',
  })
  status: string;
}

export class PurchasesResponseDto {
  @ApiProperty({ type: [PurchaseItemDto] })
  purchases: PurchaseItemDto[];

  @ApiProperty({ example: 25 })
  total: number;
}

export class PaymentItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 19.99 })
  amount: number;

  @ApiProperty({ example: 'Credit Card' })
  method: string;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  date: Date;

  @ApiProperty({
    enum: ['COMPLETED', 'PENDING', 'FAILED'],
    example: 'COMPLETED',
  })
  status: string;
}

export class PaymentsResponseDto {
  @ApiProperty({ type: [PaymentItemDto] })
  payments: PaymentItemDto[];

  @ApiProperty({ example: 25 })
  total: number;
}

export class BillingDetailsDto {
  @ApiProperty({ example: 'John Doe', nullable: true })
  name: string | null;

  @ApiProperty({ example: '123 Main St, City, Country', nullable: true })
  address: string | null;

  @ApiProperty({ example: 'VAT123456789', nullable: true })
  vat: string | null;

  @ApiProperty({ example: '+1234567890', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'Company Name', nullable: true })
  company: string | null;
}
