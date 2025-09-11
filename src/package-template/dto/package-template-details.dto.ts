import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PackageTemplateDetailsDto {
  @ApiProperty({
    description:
      'Package template ID (UUID) or packageTemplateId (business key) to get details for',
    example: '980681d4-89d6-4472-b5c5-342706d862a7 or 594277',
    required: true,
  })
  @IsString()
  packageTemplateId: string;
}

export class CountryOperatorDto {
  @ApiProperty({ description: 'ISO2 country code', example: 'XK' })
  countryIso2: string;

  @ApiProperty({ description: 'Full country name', example: 'Kosovo' })
  countryName: string;

  @ApiProperty({
    description: 'List of network operator names in this country',
    example: ['Vala', 'IPKO', 'Z Mobile'],
    type: [String],
  })
  operatorNames: string[];
}

export class PackageTemplateDetailsResponseDto {
  @ApiProperty({ description: 'Package template ID', example: '123' })
  packageTemplateId: string;

  @ApiProperty({ description: 'Package name', example: 'Kosova 3GB' })
  packageName: string;

  @ApiProperty({ description: 'Package price', example: 15.5, nullable: true })
  price: number | null;

  @ApiProperty({ description: 'Currency code', example: 'EUR', nullable: true })
  currency: string | null;

  @ApiProperty({
    description: 'Data allowance',
    example: '3GB',
    nullable: true,
  })
  usageAllowed: string | null; // volume like "3GB"

  @ApiProperty({
    description: 'Validity period in days',
    example: 30,
    nullable: true,
  })
  validityDays: number | null;

  @ApiProperty({ description: 'Number of countries covered', example: 2 })
  numberOfCountries: number;

  @ApiProperty({
    description: 'List of countries with their operators',
    type: [CountryOperatorDto],
  })
  countries: CountryOperatorDto[];
}
